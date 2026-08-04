// The application's database access surface.
//
// Two things live here on purpose:
//
//   1. A `pg` pool connecting as `somap_app` -- the role sql/schema/010_grants.sql
//      grants SELECT to and explicitly revokes every write privilege from.
//      Principle IV is enforced by that grant, not by this file's care.
//
//   2. A loader that reads every query in sql/query/*.sql at startup. Query
//      text is never assembled as a template literal (plan.md R4): the
//      safety-critical spatial queries live as files so a reviewer reads a
//      diff, the same posture Principle IV takes toward rule content.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;

const QUERY_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "sql",
  "query",
);

function loadQueries(dir: string): ReadonlyMap<string, string> {
  const queries = new Map<string, string>();
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".sql")) continue;
    const name = entry.name.slice(0, -".sql".length);
    queries.set(name, readFileSync(path.join(dir, entry.name), "utf8"));
  }
  return queries;
}

const queries = loadQueries(QUERY_DIR);

/**
 * Look up a query loaded from sql/query/<name>.sql at startup. Throws at
 * call time (never returns a coarse fallback) if the file is missing --
 * a typo here is a defect to surface loudly, not to guess past.
 */
export function query(name: string): string {
  const sql = queries.get(name);
  if (sql === undefined) {
    throw new Error(
      `No SQL query file named "${name}.sql" in ${QUERY_DIR}. ` +
        `Known queries: ${[...queries.keys()].join(", ") || "(none loaded)"}`,
    );
  }
  return sql;
}

/**
 * The single pool for this process, connecting as the read-only `somap_app`
 * role. There is no second, more-privileged pool anywhere in server/ --
 * writes belong to the ETL pipeline (etl/), which connects as the database
 * owner instead.
 */
export const pool = new Pool({
  host: process.env.PGHOST ?? "db",
  port: Number(process.env.PGPORT ?? 5432),
  user: process.env.PGUSER ?? "somap_app",
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE ?? "somap",
  max: Number(process.env.PGPOOL_MAX ?? 10),
});
