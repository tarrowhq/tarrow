// A database migrated in stages must end up where a fresh one starts.
//
// WHY THIS SUITE EXISTS, AND WHY NOTHING ELSE COULD HAVE CAUGHT IT
//
// Every other test in this repository runs against a database built in one
// pass from the current schema/ directory. That is the shape a CI run has and
// the shape a developer's `docker compose up` has -- and it is the ONE shape in
// which an edited-in-place migration is invisible, because a fresh database
// applies the edited file whole and gets the right answer.
//
// A long-lived deployment does not. Migrations are keyed by filename, so a file
// edited after it was applied is skipped forever there. TASK-0022 added
// `coverage_gaps.label` by editing 005; demo.tarrow.org never received the
// column; `manifest.sql` selected it anyway; and the manifest gate refused
// EVERY search for three days while returning HTTP 200 to every request. The
// suite was green throughout.
//
// So this suite deliberately builds the shape CI otherwise never has: a
// database migrated to an OLD revision, then brought forward with the current
// runner, compared column-for-column against one built fresh. It is the only
// test here that would have failed before the fix.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, test } from "node:test";
import pg from "pg";

const { Client } = pg;

const SCHEMA_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "sql",
  "schema",
);

const OWNER = {
  host: process.env.PGHOST ?? "db",
  port: Number(process.env.PGPORT ?? 5432),
  // Migrations run as the OWNER, never as the read-only runtime role -- the
  // same rule server/migrate.ts states and for the same reason.
  user: process.env.POSTGRES_USER ?? "tarrow",
  password: process.env.POSTGRES_PASSWORD,
};

const FRESH_DB = "tarrow_drift_fresh";
const STAGED_DB = "tarrow_drift_staged";

/** The migration filenames, in application order. */
function migrations(): string[] {
  return readdirSync(SCHEMA_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

async function withAdmin<T>(run: (c: pg.Client) => Promise<T>): Promise<T> {
  const client = new Client({ ...OWNER, database: "postgres" });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

async function recreate(name: string): Promise<void> {
  await withAdmin(async (c) => {
    await c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await c.query(`CREATE DATABASE ${name}`);
  });

  // PostGIS is enabled by an initdb script in docker/db (see its Dockerfile),
  // which runs once against the DEFAULT database only. A database created here
  // is not that one, so the extension has to be enabled explicitly or
  // 002_address_points.sql fails with `type "geometry" does not exist`.
  //
  // This is setup, not the thing under test: both databases in a comparison get
  // it identically, so it cannot mask a difference between them.
  const client = new Client({ ...OWNER, database: name });
  await client.connect();
  try {
    await client.query("CREATE EXTENSION IF NOT EXISTS postgis");
  } finally {
    await client.end();
  }
}

/**
 * Apply migrations by hand, up to and including `through`, recording them in
 * schema_migrations exactly as the runner does but WITHOUT a checksum -- which
 * is precisely the state every database applied before TASK-0027 is in. The
 * runner must cope with those rows rather than treating them as drift.
 */
async function migrateByHand(database: string, through: string): Promise<void> {
  const client = new Client({ ...OWNER, database });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
          filename    text PRIMARY KEY,
          applied_at  timestamptz NOT NULL DEFAULT now()
      )
    `);
    for (const file of migrations()) {
      await client.query(readFileSync(path.join(SCHEMA_DIR, file), "utf8"));
      await client.query(
        "INSERT INTO schema_migrations (filename) VALUES ($1)",
        [file],
      );
      if (file === through) break;
    }
  } finally {
    await client.end();
  }
}

/**
 * Run the real migration runner against a named database.
 *
 * `PGDATABASE` is deleted from the child's environment, not merely overridden.
 * The compose `test` service sets it to `tarrow` for the read-only pool that
 * every other suite uses, and libpq reads it as the default database for any
 * connection that does not name one — so leaving it in place sent the runner
 * at the REAL database while this suite believed it was migrating a throwaway
 * one. The symptom was misleading in the worst way: migrations "failed" with
 * `type "geometry" does not exist`, which reads like a broken PostGIS install
 * rather than a test pointed at the wrong target.
 *
 * The same applies to `PGUSER`/`PGPASSWORD`, which name the read-only role
 * here; migrations must run as the owner. Passing the connection explicitly
 * and stripping the ambient ones leaves nothing for libpq to fall back on.
 */
function runMigrator(database: string): void {
  const env = { ...process.env };
  delete env.PGDATABASE;
  delete env.PGUSER;
  delete env.PGPASSWORD;

  execFileSync(
    process.execPath,
    [path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "server", "migrate.ts")],
    {
      env: {
        ...env,
        PGHOST: String(OWNER.host),
        PGPORT: String(OWNER.port),
        POSTGRES_USER: String(OWNER.user),
        POSTGRES_PASSWORD: String(OWNER.password ?? ""),
        POSTGRES_DB: database,
      },
      stdio: "pipe",
      encoding: "utf8",
    },
  );
}

type Column = { table_name: string; column_name: string; data_type: string; is_nullable: string };

async function columnsOf(database: string): Promise<Column[]> {
  const client = new Client({ ...OWNER, database });
  await client.connect();
  try {
    const { rows } = await client.query<Column>(`
      SELECT table_name, column_name, data_type, is_nullable
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name <> 'schema_migrations'
       ORDER BY table_name, column_name
    `);
    return rows;
  } finally {
    await client.end();
  }
}

describe("a staged database converges with a fresh one", () => {
  after(async () => {
    await withAdmin(async (c) => {
      await c.query(`DROP DATABASE IF EXISTS ${FRESH_DB} WITH (FORCE)`);
      await c.query(`DROP DATABASE IF EXISTS ${STAGED_DB} WITH (FORCE)`);
    });
  });

  test("every table has the same columns either way", async () => {
    // Fresh: one pass over the current schema directory, as CI builds it.
    await recreate(FRESH_DB);
    runMigrator(FRESH_DB);

    // Staged: stopped at 005 -- the migration that was later edited in place --
    // with no checksums recorded, then brought forward by the current runner.
    // This is demo.tarrow.org's history in miniature.
    await recreate(STAGED_DB);
    await migrateByHand(STAGED_DB, "005_coverage_gaps.sql");

    // AND THEN THE COLUMN IS DROPPED, which is the whole point of the fixture.
    //
    // Applying the CURRENT 005 produces a table that already has `label`,
    // because 005 is whatever it says today -- so a staged run alone proves
    // nothing about a database that applied the file BEFORE it was edited.
    // That older shape is the one every long-lived deployment actually has,
    // and it cannot be reconstructed from the schema directory at all.
    //
    // Dropping the column reproduces it exactly, and does so without reaching
    // into git history for an old revision of the file -- so this fixture keeps
    // describing the production state even after 005 is edited again.
    const preEdit = new Client({ ...OWNER, database: STAGED_DB });
    await preEdit.connect();
    try {
      await preEdit.query(
        "ALTER TABLE coverage_gaps DROP COLUMN IF EXISTS label",
      );
    } finally {
      await preEdit.end();
    }

    runMigrator(STAGED_DB);

    const fresh = await columnsOf(FRESH_DB);
    const staged = await columnsOf(STAGED_DB);

    // Compared as a whole rather than column by column: the failure being
    // guarded against is "a column exists in one and not the other", and
    // asserting on a named column would only ever catch the one instance
    // already known about.
    assert.deepEqual(
      staged,
      fresh,
      "a database migrated in stages has a different schema from a fresh one -- " +
        "an applied migration was probably edited in place instead of being " +
        "followed by a new one",
    );
  });

  test("coverage_gaps.label survives the staged path", async () => {
    // The specific column whose absence took the instance down. Named
    // explicitly as well as covered by the comparison above, so a regression
    // reports the actual symptom rather than a large diff.
    const staged = await columnsOf(STAGED_DB);
    const label = staged.find(
      (c) => c.table_name === "coverage_gaps" && c.column_name === "label",
    );
    assert.ok(label, "coverage_gaps.label is missing from the staged database");
    assert.equal(label.is_nullable, "NO");
  });
});

describe("an edited migration is refused, not skipped", () => {
  const DB = "tarrow_drift_edited";

  after(async () => {
    await withAdmin((c) => c.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`));
  });

  test("the runner fails when an applied file no longer matches its checksum", async () => {
    await recreate(DB);
    runMigrator(DB); // full run: every migration recorded WITH a checksum

    // Corrupt one recorded checksum, which is indistinguishable to the runner
    // from somebody having edited the file on disk.
    const client = new Client({ ...OWNER, database: DB });
    await client.connect();
    try {
      await client.query(
        "UPDATE schema_migrations SET checksum = 'not-the-real-checksum' WHERE filename = $1",
        ["005_coverage_gaps.sql"],
      );
    } finally {
      await client.end();
    }

    assert.throws(
      () => runMigrator(DB),
      /applied and have since been edited/,
      "the runner should refuse to continue when an applied migration has changed",
    );
  });
});
