---
name: proximity-measurement
description: The spatial query measuring nearest parcel boundary to nearest parcel boundary in a projected metre CRS, subtracting uncertainty radii so flagging is always the more likely outcome.
kind: pipeline
sources:
  - app/sql/query/proximity.sql
  - app/tests/proximity.test.ts
  - app/tests/explain.test.ts
verified_against: b5b247a6cb390ba505c674f0c77af551dd547949
---

# Proximity measurement

`sql/query/proximity.sql` finds school premises within the state buffer of a residence
parcel. It takes `$1` as candidate residence parcel ids and `$2` as each candidate's
residence uncertainty `r_a`, in the same order.

## How it works

**The measurement.** Distance is from the nearest point of the residence parcel to the
nearest point of the premises parcel — never centroid to centroid, never point to point.
`ST_Distance` between two polygons in a projected metre CRS is exactly that.

ORC 2950.034 defines protected premises as "the parcel of real property on which [the
facility] is situated" and does not say how the 1,000 feet is measured. Nearest-boundary
distance is always ≤ centroid distance, so this reading flags a strict superset: if the
property-line reading is legally correct tarrow is right, and if a laxer one is permitted
tarrow was over-restrictive, which Principle I classifies as recoverable. The magnitude is
not academic — a 10+ acre school campus has a median extent of 578 m and a p95 of 1,575 m
against a 304.8 m buffer, so point-based measurement is not an approximation of the legal
standard but a different calculation, wrong by more than the thing being measured.

**The projection.** Every geometry is EPSG:6549, NAD83(2011) Ohio North, in metres. There is
no `::geography` cast in the file and must never be one: it defeats the spatial index and
silently turns an index scan into a sequential scan over a quarter of a million parcels.
`tests/explain.test.ts` asserts the plan contains no cast and does use the index.

**The arithmetic.** `d_min = d(a,b) - r_a - r_b`, flag when `d_min < buffer`. Both radii are
subtracted, which shrinks the distance and makes the flag more likely — Principle I as a
formula rather than a judgement call. The file states that an edit finding itself adding a
radius here is the unrecoverable defect and must stop.

`search_bound` derives the widest premises uncertainty from the loaded data
(`max(tarrow_premises_uncertainty_m(...))`) rather than writing a number down. It is only a
prefilter bound for `ST_DWithin`, wide enough that no row the exact test would flag is
discarded first — so adding a premises class with a larger radius automatically widens the
search instead of silently dropping flags.

**What is not measured, and not estimated either.** A premises with no parcel geometry is
excluded and reported by the manifest as not checked. Giving a school an assumed radius is
forbidden at any value: at a p95 campus extent of 1,575 m an honest number flags most of a
city and a convenient one under-restricts. The exclusion is doubly enforced — `geom IS NOT
NULL` in the join, and `tarrow_premises_uncertainty_m()` returning NULL for such a row so the
subtraction could not produce a distance even if the WHERE clause were lost.

Zero rows means nothing was within the buffer; the caller renders that as "outside every
buffer we checked", never as clear, and never without the manifest.

## Connections

- [[measurement-uncertainty]] defines the buffer and both radii — this file restates no
  number.
- [[address-resolution]] produces the candidate parcels; [[search-orchestration]] guards the
  arithmetic's sign again in TypeScript.
- [[result-type-gate]] types the returned fields.
- [[database-schema]] holds the GiST indexes the plan depends on.

## Operational notes

Results are ordered by residence parcel, then `d_min_m`, then premises name and id, so two
runs cannot disagree. Mineral-rights parcels are excluded from the residence side as well.
The buffer comes from `tarrow_unverified_state_buffer_m()` in three places in the file and is
never a literal.
