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

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;

/**
 * Find `sql/query/` by walking up from this module.
 *
 * This used to be a fixed `../sql/query` from `import.meta.url`, which was
 * correct for exactly one location: `server/db.ts` run directly. Phase 5's
 * route imports `server/search.ts`, which imports this file, so Vite's SSR
 * build now also bundles this module into `build/server/index.js` -- two
 * directories deeper, where `../sql/query` does not exist and the process
 * would have failed at startup rather than at a query.
 *
 * Walking up looking for the directory itself is deliberately not a fallback
 * to a *different* directory: there is one `sql/query` in this image and this
 * finds it or throws. A missing query directory is a broken image, and it
 * fails loudly at startup rather than becoming a search that cannot run.
 */
function findQueryDir(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const candidate = path.join(dir, "sql", "query");
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        "No sql/query directory found above " +
          fileURLToPath(import.meta.url) +
          ". The spatial queries are authored as files (plan.md R4) and are " +
          "read at startup; without them this process cannot answer anything " +
          "and must not pretend otherwise.",
      );
    }
    dir = parent;
  }
}

const QUERY_DIR = findQueryDir();

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
