// Applies sql/schema/*.sql in filename order, each exactly once, tracked in
// a schema_migrations table. This is the runner tasks.md Phase 1 asks for.
//
// Connects as the database OWNER (POSTGRES_USER), never as `tarrow_app`:
// 010_grants.sql creates that role and revokes its write privileges, so
// running migrations as tarrow_app would be a chicken-and-egg failure at
// best and a Principle IV violation at worst.
//
// Run as its own one-shot compose service (see docker-compose.yml) so
// `docker compose up` reaching a healthy `app` implies migrations already
// applied -- never a background race between the two.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;

const SCHEMA_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "sql",
  "schema",
);

/**
 * The content hash of a migration, as applied.
 *
 * Line endings are normalised and trailing whitespace stripped before hashing,
 * so a checkout on a machine configured for CRLF does not report every
 * migration as edited. Anything that changes what PostgreSQL actually executes
 * changes this value; a reformat that does not, does not.
 *
 * SHA-256 rather than a shorter digest for no security reason -- nothing here
 * is adversarial. It is simply the hash that is already in the standard
 * library and that nobody has to think about.
 */
function checksumOf(file: string): string {
  const raw = readFileSync(path.join(SCHEMA_DIR, file), "utf8");
  const normalised = raw.replace(/\r\n/g, "\n").trimEnd();
  return createHash("sha256").update(normalised, "utf8").digest("hex");
}

async function main(): Promise<void> {
  const client = new Client({
    host: process.env.PGHOST ?? "db",
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.POSTGRES_USER ?? "tarrow",
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB ?? "tarrow",
  });

  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
          filename    text PRIMARY KEY,
          applied_at  timestamptz NOT NULL DEFAULT now()
      )
    `);

    // The checksum of the file AS APPLIED, added by TASK-0027.
    //
    // Nullable, and added separately rather than folded into the CREATE above,
    // because every existing database already has this table without it. A
    // row predating this change carries NULL and is treated as "unknown, not
    // mismatched" below -- the check can only speak about migrations applied
    // since it existed, and pretending otherwise would fail every deployment
    // on its next run.
    await client.query(
      "ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum text",
    );

    const files = readdirSync(SCHEMA_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort(); // zero-padded filenames -> lexical order is application order

    const { rows: applied } = await client.query<{
      filename: string;
      checksum: string | null;
    }>("SELECT filename, checksum FROM schema_migrations");
    const done = new Map(applied.map((r) => [r.filename, r.checksum]));

    // EDITING AN APPLIED MIGRATION IS A SILENT NO-OP, AND THIS IS THE ALARM.
    //
    // Migrations are keyed by filename, so a file edited after it was applied
    // is skipped forever on every database that already ran it -- while
    // applying whole on every fresh one. That asymmetry is what makes it so
    // dangerous: CI and the test suite build a fresh database every time, so
    // an edit looks correct in every check this repository runs and reaches
    // only long-lived deployments, which are exactly the ones nobody can
    // inspect quickly.
    //
    // It has now happened twice. TASK-0016 hit it with 010_grants.sql and
    // solved that one case by re-applying the password on every run (below).
    // TASK-0022 edited 005_coverage_gaps.sql to add a column; demo.tarrow.org
    // never got it, `manifest.sql` selected a column that did not exist, and
    // the manifest gate refused EVERY search for three days while returning
    // HTTP 200.
    //
    // So the drift is detected rather than trusted, and it FAILS rather than
    // warns. A warning on a one-shot container that exits 0 is a line in a log
    // nobody reads; the whole failure mode here is that everything looked fine.
    const drifted: string[] = [];
    for (const file of files) {
      const recorded = done.get(file);
      if (recorded === undefined) continue; // not applied yet
      if (recorded === null) continue; // applied before checksums existed
      const actual = checksumOf(file);
      if (recorded !== actual) drifted.push(file);
    }

    if (drifted.length > 0) {
      throw new Error(
        `These migrations were applied and have since been edited:\n` +
          drifted.map((f) => `  ${f}`).join("\n") +
          `\n\n` +
          `They will NOT be re-applied -- migrations are keyed by filename, so this\n` +
          `database will never receive the change while a fresh one gets it whole.\n` +
          `That difference is invisible to CI, which builds a fresh database every\n` +
          `run.\n\n` +
          `Do not "fix" this by editing the row or reverting the file to silence it.\n` +
          `Write a NEW migration that brings an existing database to the state the\n` +
          `edited file now describes, the way 015_coverage_gaps_label.sql does for\n` +
          `005_coverage_gaps.sql.`,
      );
    }

    for (const file of files) {
      if (done.has(file)) {
        console.log(`skip  ${file} (already applied)`);
        continue;
      }

      const sql = readFileSync(path.join(SCHEMA_DIR, file), "utf8");
      console.log(`apply ${file}`);

      await client.query("BEGIN");
      try {
        // Simple-query protocol: a multi-statement file runs as one message,
        // inside the transaction already opened above.
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)",
          [file, checksumOf(file)],
        );
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(
          `Migration ${file} failed: ${(err as Error).message}`,
          { cause: err },
        );
      }
    }

    // The runtime role's password, re-set on every migrate.
    //
    // 010_grants.sql creates `tarrow_app` with the literal password
    // `tarrow_app` and says so in its own comment: it was written when
    // plan.md R3 ruled public deployment out of scope, so "secret management
    // for a real deployment" was explicitly deferred. TASK-0016 puts an
    // instance on the public internet, which brings that deferral due.
    //
    // This runs here rather than as an edit to 010_grants.sql because that
    // file has already been applied everywhere it is going to be applied.
    // schema_migrations makes a changed migration a no-op on every existing
    // database, so editing it would silently fix nothing for precisely the
    // long-lived deployments where a published credential matters most. An
    // ALTER ROLE on every migrate is idempotent, reaches fresh and existing
    // clusters alike, and is checkable from outside by connecting with the
    // old password and being refused.
    //
    // Unset means unchanged. The development composition supplies no
    // PGAPPPASSWORD and keeps the credential 010_grants.sql wrote, which is
    // correct for a database bound to loopback holding public county data --
    // and it keeps `docker-compose.yml` working with no secret to invent,
    // which Principle VII requires of the path a stranger takes first.
    //
    // The value is escaped as a literal rather than bound as a parameter
    // because ALTER ROLE takes no bind parameters. It is never logged: the
    // line below names the variable, not its contents.
    const appPassword = process.env.PGAPPPASSWORD;
    if (appPassword) {
      await client.query(
        `ALTER ROLE tarrow_app WITH PASSWORD ${client.escapeLiteral(appPassword)}`,
      );
      console.log("tarrow_app password set from PGAPPPASSWORD");
    }

    console.log("migrations complete");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
