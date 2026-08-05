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

    const files = readdirSync(SCHEMA_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort(); // zero-padded filenames -> lexical order is application order

    const { rows: applied } = await client.query<{ filename: string }>(
      "SELECT filename FROM schema_migrations",
    );
    const done = new Set(applied.map((r) => r.filename));

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
          "INSERT INTO schema_migrations (filename) VALUES ($1)",
          [file],
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
