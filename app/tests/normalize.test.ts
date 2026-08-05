// The ported normalizer, and the property that makes the port meaningful.
//
// sql/schema/012_address_normalization.sql is a port of
// spikes/task-0001-geocoding/sql/02_normalize.sql -- the rule-based normalizer
// that reached 96.79% correct / 0.20% wrong over 151,904 probes. DECISION §1:
// libpostal is not adopted, and RESULTS.md is the bar any replacement must
// beat.
//
// The port is only worth anything if BOTH SIDES of a match go through it. These
// tests assert that: address_points.normalized is the function's output over
// the county's own label, and sql/query/resolve_address.sql applies the same
// function to what the user typed. A normalizer applied to one side is a
// different string-handling library, not a canonical form.

import assert from "node:assert/strict";
import { after, describe, test } from "node:test";

import { pool } from "../server/db.ts";

after(async () => {
  await pool.end();
});

describe("the ported normalizer behaves as the spike measured it", () => {
  test("the rules that produced the 96.79%", async () => {
    const cases: readonly [string, string | null][] = [
      // Street-type canonicalisation (USPS Publication 28).
      ["4718 Krancz Drive", "4718 KRANCZ DR"],
      // A full postal address reduces to the county's bare label: state, ZIP,
      // and city are all stripped.
      ["4718 KRANCZ DRIVE, Akron, OH 44319", "4718 KRANCZ DR"],
      // Numeric ordinals lose their suffix; a leading directional survives.
      ["168 SW 31st Street", "168 SW 31 ST"],
      // Unit designators are DISCARDED, deliberately: every unit in a building
      // sits on the same parcel and is the same distance from every premises.
      ["2200 high st apt 4b, cuyahoga falls oh", "2200 HIGH ST"],
      ["15 N Maple St #200", "15 N MAPLE ST"],
      // A SUFFIX directional after the street type still canonicalises the
      // type -- the case the spike measured as ~3pp of avoidable no-matches.
      ["1 Wooster Road West", "1 WOOSTER RD W"],
      // Longest place name wins, so CUYAHOGA FALLS beats FALLS.
      ["123 Main St, Cuyahoga Falls, OH", "123 MAIN ST"],
      // Nothing at all normalizes to nothing -- never to a partial string that
      // might match something.
      ["   ,,, --- ", null],
      [null as unknown as string, null],
    ];

    for (const [input, expected] of cases) {
      const { rows } = await pool.query<{ n: string | null }>(
        "SELECT somap_normalize_address($1) AS n",
        [input],
      );
      assert.equal(rows[0].n, expected, `normalizing ${JSON.stringify(input)}`);
    }
  });

  test("no fuzzy matching: two different house numbers stay different", async () => {
    // DECISION §4 rejects fuzzy matching as a safety decision. 50.1% of the
    // text-matching approach's failures were house-number disagreements between
    // county datasets (4921 vs 4932 FRIAR RD); edit distance cannot tell a typo
    // from a different building, and converts a safe no-match into a confident
    // wrong match on exactly those.
    const { rows } = await pool.query<{ a: string; b: string }>(
      "SELECT somap_normalize_address('4921 Friar Rd') AS a, " +
        "somap_normalize_address('4932 Friar Rd') AS b",
    );
    assert.notEqual(rows[0].a, rows[0].b);
  });
});

describe("both sides of every match go through the same function", () => {
  test("address_points.normalized is the function's output over the county label", async () => {
    const { rows } = await pool.query<{ mismatched: string; nulls: string }>(
      `SELECT count(*) FILTER (
                WHERE normalized IS DISTINCT FROM somap_normalize_address(full_address)
              ) AS mismatched,
              count(*) FILTER (WHERE normalized IS NULL) AS nulls
         FROM address_points`,
    );
    assert.equal(
      Number(rows[0].mismatched),
      0,
      "a stored normalized form that disagrees with the live function means the " +
        "index and the query are matching different strings",
    );
    // The rows the normalizer cannot reduce are a declared coverage gap, not a
    // silent hole: they are unfindable by search and the ledger says so.
    const unnormalizable = Number(rows[0].nulls);
    if (unnormalizable > 0) {
      const { rows: gap } = await pool.query<{ n: string }>(
        `SELECT count(*) AS n FROM coverage_gaps
          WHERE subject_ref = 'address_points_without_normalized_form'`,
      );
      assert.equal(
        Number(gap[0].n),
        1,
        `${unnormalizable} address points normalize to nothing and must be declared`,
      );
    }
  });

  test("resolve_address applies the same function to what the user typed", async () => {
    const { query } = await import("../server/db.ts");
    assert.match(query("resolve_address"), /somap_normalize_address\(\$1::text\)/);
  });
});
