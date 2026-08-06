---
name: measurement-uncertainty
description: The three SQL functions holding the buffer and both uncertainty radii, written exactly once so the measurement cannot drift from the disclosure of the measurement.
kind: concept
sources:
  - app/sql/schema/013_measurement_uncertainty.sql
verified_against: b5b247a6cb390ba505c674f0c77af551dd547949
---

# Measurement uncertainty

`sql/schema/013_measurement_uncertainty.sql` defines three IMMUTABLE functions so that each
safety-critical constant is written down exactly once. `sql/query/proximity.sql` performs the
arithmetic and `sql/query/manifest.sql` renders it; neither restates a number. A radius
appearing in two files could drift; a buffer appearing in two files could disagree with
itself — the class of defect producing a confident wrong answer rather than a loud one.

## How it works

**`tarrow_unverified_state_buffer_m()` → 304.8.** ORC 2950.034's 1,000 feet, exactly, in the
metre CRS all spatial work uses. The word `unverified` in the name is a load-bearing
disclosure, not a style choice: Principle V requires every rule to carry citation, source
URL, effective date, verification date, and verifier as data, and no such record exists yet
(TASK-0003 builds the file-authored pipeline). The file states that renaming it to drop
`unverified` must not happen before TASK-0003 lands.

**`tarrow_residence_uncertainty_m(match_basis)` → r_a.** `point_in_parcel` → 0 (the parcel
is established by containment and the measurement is exact). `point_near_parcel` → 5 (the
point falls in no parcel but within 5 m of one, so attribution is inferred between two
independently digitised layers and the true boundary may lie that much nearer a premises).
Any other basis returns NULL, which propagates through the subtraction so the row disappears
rather than being measured on a guessed radius. tarrow never measures a residence from a bare
point at all — measuring from a point overstates distance and therefore under-restricts, so
a point with no parcel within 5 m is declined upstream.

**`tarrow_premises_uncertainty_m(match_basis, match_corroboration)` → r_b.** Every value is
the larger of the available readings, because a missing or undersized premises silently
shrinks a buffer and produces a false "outside every buffer".
`board_of_education_parcel`, `named_exempt_parcel`, and `point_in_parcel` → 0 (all establish
a real surveyed county parcel). `point_near_parcel` → 5. `none` → NULL, which is how the
prohibition on assumed school radii is enforced: a premises with no geometry is a declared
coverage gap and is never measured.

Corroboration adds and never subtracts. `uncorroborated` — the school's point matched a
parcel that is **not** tax-exempt — adds 126 m. A school premises essentially always is
exempt, so the match is probably a mailing-address geocode landing on a neighbouring
property, and the boundary tarrow holds probably understates the real premises. 126 m is the
measured p95 extent of a typical suburban lot: the displacement one mis-geocoded parcel can
account for. The file is explicit that this is *not* an assumed radius for a school known
only by a point — those are forbidden at any value, and the `none` branch is the enforcement.

## Connections

- [[proximity-measurement]] calls all three; [[address-resolution]] calls the residence one.
- [[search-orchestration]]'s `assertPessimistic` re-checks the sign of the same arithmetic in
  TypeScript.
- [[coverage-manifest]] renders the bases and their radii to the user.
- [[ingest-pipeline]] assigns the `match_basis` and `match_corroboration` values these read.

## Operational notes

The functions live in a migration rather than `sql/query/` because the runtime role
`tarrow_app` has every write privilege revoked and cannot CREATE anything at startup, and
because authored content compiled in by a build step is the shape Principle IV sets. All
three are `IMMUTABLE PARALLEL SAFE` and carry `COMMENT ON FUNCTION` text restating their
role.
