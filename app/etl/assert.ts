// Load-time assertions. These exist because the failure they catch is
// invisible: a pipeline that drops or collapses rows runs green, and the only
// symptom is a school that is never flagged. Constitution Principle I calls
// that class of error unrecoverable, so these abort the ingest rather than
// warn.

import type { PoolClient } from "pg";

export class IngestAssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IngestAssertionError";
  }
}

export interface KeyAudit {
  readonly table: string;
  readonly column: string;
  readonly total: number;
  readonly distinct: number;
  /** Rows whose value repeats another row's value. */
  readonly duplicated: number;
  /** Rows whose value is NULL or empty string. */
  readonly empty: number;
}

/** Measure how well `column` behaves as a key. Never throws on its own. */
export async function auditKey(
  client: PoolClient,
  table: string,
  column: string,
): Promise<KeyAudit> {
  const { rows } = await client.query<{
    total: string;
    distinct: string;
    duplicated: string;
    empty: string;
  }>(
    `SELECT count(*)                                            AS total,
            count(DISTINCT ${column})                           AS distinct,
            count(*) FILTER (
              WHERE ${column} IN (
                SELECT ${column} FROM ${table}
                WHERE ${column} IS NOT NULL AND ${column} <> ''
                GROUP BY ${column} HAVING count(*) > 1))        AS duplicated,
            count(*) FILTER (
              WHERE ${column} IS NULL OR ${column} = '')         AS empty
       FROM ${table}`,
  );
  const row = rows[0];
  return {
    table,
    column,
    total: Number(row.total),
    distinct: Number(row.distinct),
    duplicated: Number(row.duplicated),
    empty: Number(row.empty),
  };
}

/**
 * Assert that `column` is a usable key: no duplicates, no empties.
 *
 * `declaredNonUnique` is the ONLY exemption, and it is a per-layer list in
 * etl/sources.ts. A column named there is audited and ledgered instead of
 * aborting -- because somap keys on none of them, and preserving the rows is
 * what keeps 30,426 duplicate ADDR_ID values from collapsing into 15,000
 * addresses that silently stop resolving (DECISION §7). Remove a column from
 * that list and this assertion fires on the real data, which is how it is
 * shown to be live rather than decorative.
 */
export async function assertKeyUnique(
  client: PoolClient,
  table: string,
  column: string,
  declaredNonUnique: readonly string[] = [],
): Promise<KeyAudit> {
  const audit = await auditKey(client, table, column);
  if (declaredNonUnique.includes(column)) return audit;

  if (audit.duplicated > 0 || audit.empty > 0) {
    throw new IngestAssertionError(
      `${table}.${column} is not a usable key: ${audit.duplicated} rows carry a ` +
        `duplicated value and ${audit.empty} carry none, over ${audit.total} rows ` +
        `(${audit.distinct} distinct). Either the source changed or this column is ` +
        `being keyed on when it should not be. Refusing to load: collapsing or ` +
        `dropping rows here removes premises from the answer, which Principle I ` +
        `classifies as an unrecoverable error. To ingest a genuinely non-unique ` +
        `column, name it in that layer's declaredNonUniqueKeys in etl/sources.ts.`,
    );
  }
  return audit;
}

/**
 * Assert that every fetched feature is accounted for: loaded, or dropped for
 * a reason the caller can name and has recorded. Silence is not an option --
 * an unexplained shortfall aborts.
 */
export function assertNoRowsLost(
  label: string,
  fetched: number,
  loaded: number,
  droppedWithReason: number,
): void {
  if (loaded + droppedWithReason !== fetched) {
    throw new IngestAssertionError(
      `${label}: ${fetched} features fetched but ${loaded} loaded and only ` +
        `${droppedWithReason} accounted for as dropped. ${fetched - loaded - droppedWithReason} ` +
        `rows vanished without explanation. A row that disappears between the source ` +
        `and the database is a coverage gap nobody will ever see; refusing to continue.`,
    );
  }
}

/**
 * Assert the invariant Phase 2's verification exists to prove: a school
 * premises row with no geometry must have a coverage_gaps row explaining it.
 * A NULL geometry that nothing declares is a school that quietly stops
 * existing -- DECISION §3 permits the NULL precisely because this ledger
 * entry is mandatory, never because the school may be approximated.
 */
export async function assertEveryNullGeomIsDeclared(
  client: PoolClient,
): Promise<number> {
  const { rows } = await client.query<{ id: string; name: string }>(
    `SELECT s.id::text, s.name
       FROM school_premises s
      WHERE s.geom IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM coverage_gaps g
           WHERE g.subject_type = 'school_premises'
             AND g.subject_ref = s.layer_id || ':' || s.source_ref)`,
  );
  if (rows.length > 0) {
    throw new IngestAssertionError(
      `${rows.length} school premises rows have no geometry and no coverage_gaps ` +
        `row explaining it, e.g. ${rows.slice(0, 5).map((r) => r.name).join(", ")}. ` +
        `An undeclared gap is exactly what Principle II forbids.`,
    );
  }
  const { rows: counted } = await client.query<{ n: string }>(
    "SELECT count(*) AS n FROM school_premises WHERE geom IS NULL",
  );
  return Number(counted[0].n);
}

/**
 * Assert that no school premises row was given an assumed radius. There is no
 * radius column to check, which is the point: this asserts the shape of the
 * table has not drifted into offering one. DECISION §3 forbids a school
 * radius at any value, because a campus's p95 extent (1,575 m) exceeds the
 * entire 304.8 m buffer.
 */
export async function assertNoAssumedSchoolRadius(
  client: PoolClient,
): Promise<void> {
  const { rows } = await client.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'school_premises'
        AND (column_name LIKE '%radius%' OR column_name LIKE '%uncertain%'
             OR column_name LIKE '%buffer%')`,
  );
  if (rows.length > 0) {
    throw new IngestAssertionError(
      `school_premises has grown ${rows.map((r) => r.column_name).join(", ")}. ` +
        `DECISION §3 forbids approximating a school premises from a point at any ` +
        `radius; a school without parcel geometry is a declared coverage gap.`,
    );
  }
}
