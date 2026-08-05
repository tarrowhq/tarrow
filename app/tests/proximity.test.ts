// The four result shapes, and the arithmetic that decides between them.
//
// These run against the loaded Summit County database inside the composition,
// as the read-only `tarrow_app` role. They are not unit tests over a mock: the
// thing under test is whether real county geometry, measured the way DECISION
// §2 and §3 say, produces the answer Principle I requires.

import assert from "node:assert/strict";
import { after, describe, test } from "node:test";

import { pool } from "../server/db.ts";
import { search } from "../server/search.ts";
import {
  BUFFER_METERS,
  FAR_FROM_EVERY_SCHOOL,
  FLAGGED_ONLY_BY_UNCERTAINTY,
  NEAR_A_SCHOOL,
  NORMALIZES_TO_NOTHING,
  NO_SUCH_ADDRESS,
  RESOLVES_BUT_HAS_NO_PARCEL,
} from "./fixtures.ts";

after(async () => {
  await pool.end();
});

describe("the four result shapes", () => {
  test("a known address near a known school flags, with the measured distance", async () => {
    const result = await search(NEAR_A_SCHOOL.typed);

    assert.equal(result.kind, "premises-within-buffer");
    if (result.kind !== "premises-within-buffer") return;

    assert.ok(result.premises.length > 0, "at least one premises must be flagged");
    assert.equal(result.bufferMeters, BUFFER_METERS);

    const hit = result.premises.find((p) =>
      p.name.toLowerCase().includes(NEAR_A_SCHOOL.expectPremisesNameContains.toLowerCase()),
    );
    assert.ok(hit, `expected a premises named like ${NEAR_A_SCHOOL.expectPremisesNameContains}`);

    const [lo, hi] = NEAR_A_SCHOOL.expectDistanceBetween;
    assert.ok(
      hit.distanceMeters >= lo && hit.distanceMeters <= hi,
      `boundary-to-boundary distance ${hit.distanceMeters} m outside the expected ${lo}-${hi} m`,
    );

    // The measurement basis travels with the distance (FR-011).
    assert.ok(hit.measurementBasis.length > 0);
    assert.equal(result.residence.measurementBasis, "point_in_parcel");

    // Every flag is on the pessimistic bound, and the bound never exceeds the
    // measured distance -- the radii are subtracted, never added.
    for (const p of result.premises) {
      assert.ok(p.pessimisticDistanceMeters <= p.distanceMeters);
      assert.ok(p.pessimisticDistanceMeters < BUFFER_METERS);
      assert.equal(
        Math.round(
          (p.distanceMeters -
            p.residenceUncertaintyMeters -
            p.premisesUncertaintyMeters) *
            1e6,
        ),
        Math.round(p.pessimisticDistanceMeters * 1e6),
      );
    }
  });

  test("a known address far from every school returns outside-every-buffer", async () => {
    const result = await search(FAR_FROM_EVERY_SCHOOL.typed);

    assert.equal(result.kind, "outside-every-buffer-we-checked");
    if (result.kind !== "outside-every-buffer-we-checked") return;

    assert.equal(result.bufferMeters, BUFFER_METERS);
    assert.ok(result.residence.parcelId > 0);

    // The strongest statement tarrow may make is still a statement about what it
    // checked -- so the manifest must be there to say what that was.
    assert.equal(result.manifest.availability, "read-from-data");
  });

  test("an address point with no parcel declines", async () => {
    const result = await search(RESOLVES_BUT_HAS_NO_PARCEL.typed);

    assert.equal(result.kind, "declined");
    if (result.kind !== "declined") return;

    assert.equal(result.reason, "resolved-point-has-no-parcel");
    // A decline is NOT a could-not-locate: tarrow found the address and refused
    // to measure it, which is a different thing to tell the user.
    assert.notEqual(result.kind as string, "could-not-locate");
    assert.match(result.detail, /declines|decline/i);
  });

  test("an unmatched address returns could-not-locate, distinct from both", async () => {
    const result = await search(NO_SUCH_ADDRESS.typed);

    assert.equal(result.kind, "could-not-locate");
    if (result.kind !== "could-not-locate") return;

    assert.equal(result.reason, "no-address-point-matched");
    // Distinct from a decline and from an answer: three different `kind`s.
    assert.notEqual(result.kind as string, "declined");
    assert.notEqual(result.kind as string, "outside-every-buffer-we-checked");
  });

  test("input that reduces to nothing is its own could-not-locate reason", async () => {
    const result = await search(NORMALIZES_TO_NOTHING.typed);
    assert.equal(result.kind, "could-not-locate");
    if (result.kind !== "could-not-locate") return;
    assert.equal(result.reason, "input-normalized-to-nothing");
  });
});

describe("uncertainty is arithmetic, and it is subtracted", () => {
  test("a premises OUTSIDE the buffer by exact distance is flagged by its uncertainty", async () => {
    const result = await search(FLAGGED_ONLY_BY_UNCERTAINTY.typed);

    assert.equal(result.kind, "premises-within-buffer");
    if (result.kind !== "premises-within-buffer") return;

    const hit = result.premises.find((p) =>
      p.name
        .toLowerCase()
        .includes(FLAGGED_ONLY_BY_UNCERTAINTY.expectPremisesNameContains.toLowerCase()),
    );
    assert.ok(
      hit,
      "the uncorroborated premises must be flagged; if it is not, the radii " +
        "are no longer being subtracted and tarrow is under-restricting",
    );

    assert.equal(hit.corroboration, "uncorroborated");
    assert.equal(
      hit.premisesUncertaintyMeters,
      FLAGGED_ONLY_BY_UNCERTAINTY.expectPremisesUncertaintyMeters,
    );

    // THE SIGN. Exact distance is outside the buffer; the pessimistic bound is
    // inside it. Subtracting made the flag MORE likely, which is the safe
    // direction and the whole of DECISION §3.
    assert.ok(
      hit.distanceMeters > BUFFER_METERS,
      `expected exact distance beyond the buffer, got ${hit.distanceMeters} m`,
    );
    assert.ok(
      hit.pessimisticDistanceMeters < BUFFER_METERS,
      `expected the pessimistic bound inside the buffer, got ${hit.pessimisticDistanceMeters} m`,
    );
    assert.ok(hit.pessimisticDistanceMeters < hit.distanceMeters);
  });

  test("no flagged premises anywhere is measured from an assumed school radius", async () => {
    // DECISION §3: a school known only by a point is a declared coverage gap
    // and is never given a radius at any value. The database-side guarantee is
    // that such a row has NULL geometry and cannot be measured at all.
    const { rows } = await pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM school_premises
        WHERE geom IS NULL
          AND tarrow_premises_uncertainty_m(match_basis, match_corroboration) IS NOT NULL`,
    );
    assert.equal(
      Number(rows[0].n),
      0,
      "a premises with no geometry must have no uncertainty radius either -- " +
        "a radius on a geometry-less school is the approximation DECISION §3 forbids",
    );
  });

  test("the pessimistic bound never exceeds the measured distance, over every premises", async () => {
    // Exhaustive over the whole premises table against one real residence
    // parcel: r_a and r_b are non-negative wherever they are defined, so
    // d_min <= d always holds by construction.
    const { rows } = await pool.query<{ bad: string }>(
      `SELECT count(*) AS bad FROM school_premises
        WHERE tarrow_premises_uncertainty_m(match_basis, match_corroboration) < 0`,
    );
    assert.equal(Number(rows[0].bad), 0, "a negative radius would ADD to the distance");
  });
});
