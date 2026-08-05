// Applies sql/schema/*.sql in filename order, each exactly once, tracked in
// a schema_migrations table. This is the runner tasks.md Phase 1 asks for.
//
// Connects as the database OWNER (POSTGRES_USER), never as `somap_app`:
// 010_grants.sql creates that role and revokes its write privileges, so
// running migrations as somap_app would be a chicken-and-egg failure at
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
    user: process.env.POSTGRES_USER ?? "somap",
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB ?? "somap",
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

    console.log("migrations complete");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
