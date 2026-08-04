// The only refresh primitive derived tables get. Constitution Principle IV
// forbids incremental sync and reconciliation logic -- there is no upsert
// path anywhere in this codebase, and this function is the reason: every
// ETL phase reloads a table by calling through here instead of writing its
// own UPDATE/MERGE/upsert.
//
// Callers connect as the database owner (see server/migrate.ts for why --
// the same reasoning applies to ETL writes, which somap_app is revoked
// from performing at all).

import type { PoolClient } from "pg";

const IDENT_RE = /^[a-z_][a-z0-9_]*$/;

function quoteIdent(name: string): string {
  if (!IDENT_RE.test(name)) {
    throw new Error(`Refusing to interpolate unsafe identifier: ${name}`);
  }
  return `"${name}"`;
}

/**
 * Truncate `table`, then run `load` to repopulate it, inside one
 * transaction -- so a failed load leaves the previous full table intact
 * rather than a half-reloaded one. CASCADE is deliberate: reloading a table
 * a foreign key depends on must not leave orphaned dependent rows behind.
 */
export async function truncateAndReload(
  client: PoolClient,
  table: string,
  load: (client: PoolClient) => Promise<void>,
): Promise<void> {
  await client.query("BEGIN");
  try {
    await client.query(
      `TRUNCATE TABLE ${quoteIdent(table)} RESTART IDENTITY CASCADE`,
    );
    await load(client);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}
