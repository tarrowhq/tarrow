// The query plan is a safety property, not a performance one.
//
// DECISION §2: "All spatial work happens in EPSG:6549 ... Geography casts
// defeat the spatial index and are not used for bulk work." plan.md sharpens
// it: "an EXPLAIN showing a sequential scan over parcels is a defect, not a
// tuning opportunity."
//
// Both halves are asserted here against real plans from the real data, because
// both are the kind of regression that arrives silently: a `::geography` added
// to make a unit conversion read nicely turns a 261,154-row index scan into a
// sequential one, and nothing about the ANSWER changes -- until the query is
// slow enough that somebody adds a timeout, and a timeout on a proximity search
// fails toward silence.

import assert from "node:assert/strict";
import { after, describe, test } from "node:test";

import { pool, query } from "../server/db.ts";
import { NEAR_A_SCHOOL } from "./fixtures.ts";

after(async () => {
  await pool.end();
});

async function planFor(sql: string, params: unknown[]): Promise<string> {
  const { rows } = await pool.query<Record<string, string>>(
    `EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) ${sql}`,
    params,
  );
  return rows.map((r) => r["QUERY PLAN"]).join("\n");
}

describe("resolve_address uses the spatial index and casts nothing to geography", () => {
  test("the plan", async () => {
    const plan = await planFor(query("resolve_address"), [NEAR_A_SCHOOL.typed]);
    // Printed so the evidence is in the test output, not only in an assertion.
    console.log("\n--- EXPLAIN resolve_address ---\n" + plan);

    assert.doesNotMatch(
      plan,
      /geography/i,
      "a geography cast in the plan defeats the spatial index (DECISION §2)",
    );
    assert.doesNotMatch(
      plan,
      /Seq Scan on parcels/i,
      "a sequential scan over 261,154 parcels is a defect, not a tuning opportunity",
    );
    assert.match(
      plan,
      /Index Scan using parcels_measurable_geom_idx|Bitmap Index Scan on parcels_measurable_geom_idx/i,
      "the partial GiST index excluding mineral-rights parcels must be the one used",
    );
    // The address lookup itself rides the normalized btree, not a scan of a
    // quarter of a million points.
    assert.doesNotMatch(plan, /Seq Scan on address_points/i);
  });
});

describe("proximity uses the spatial index and casts nothing to geography", () => {
  test("the plan", async () => {
    const resolved = await pool.query<{
      parcel_id: string | null;
      residence_uncertainty_m: number | null;
    }>(query("resolve_address"), [NEAR_A_SCHOOL.typed]);
    const row = resolved.rows.find((r) => r.parcel_id !== null);
    assert.ok(row, "fixture must resolve to a parcel");

    const plan = await planFor(query("proximity"), [
      [Number(row.parcel_id)],
      [row.residence_uncertainty_m ?? 0],
    ]);
    console.log("\n--- EXPLAIN proximity ---\n" + plan);

    assert.doesNotMatch(
      plan,
      /geography/i,
      "a geography cast in the distance query is the exact regression DECISION §2 forbids",
    );
    assert.doesNotMatch(
      plan,
      /Seq Scan on parcels/i,
      "the residence parcel is fetched by primary key, never by scanning",
    );
    assert.match(
      plan,
      /Index Scan using school_premises_geom_idx|Bitmap Index Scan on school_premises_geom_idx/i,
      "the premises side must be reached through its GiST index",
    );
  });
});

describe("the geometry columns are geometry, in EPSG:6549, everywhere", () => {
  test("no geography column exists in the schema at all", async () => {
    const { rows } = await pool.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name
         FROM information_schema.columns
        WHERE table_schema = 'public' AND udt_name = 'geography'`,
    );
    assert.deepEqual(rows, [], "a geography column cannot be cast away at query time");
  });

  test("every measurement geometry is SRID 6549", async () => {
    const { rows } = await pool.query<{ f_table_name: string; srid: number }>(
      `SELECT f_table_name, srid FROM geometry_columns WHERE f_table_schema = 'public'`,
    );
    assert.ok(rows.length > 0);
    for (const row of rows) {
      assert.equal(
        row.srid,
        6549,
        `${row.f_table_name} is not in EPSG:6549; distances would not be in metres`,
      );
    }
  });
});
