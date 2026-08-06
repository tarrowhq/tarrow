---
name: address-resolution
description: Normalizing a typed address and matching it against county address points, then attributing a parcel — with fuzzy matching and coarse fallbacks made structurally impossible rather than merely unused.
kind: pipeline
sources:
  - app/sql/query/resolve_address.sql
  - app/sql/schema/012_address_normalization.sql
  - app/tests/normalize.test.ts
  - app/tests/no-fallback.test.ts
verified_against: b5b247a6cb390ba505c674f0c77af551dd547949
---

# Address resolution

`sql/query/resolve_address.sql` takes the raw typed string as `$1` and returns the parcel or
parcels distance may be measured from. The shape is fixed: *typed address → normalize →
Address Points match → that point's parcel*.

## How it works

The dataset choice is measured, not stylistic. Over 151,904 probes this path is 96.79%
correct and 0.20% wrong; matching typed input against `parcels.site_address` instead is
69.16% correct and 3.34% **wrong** — a 17× higher rate of confidently measuring from
somebody else's house. `site_address` is a situs label on a tax record; an address point is a
unit of addressable location maintained by the office that assigns addresses. Nothing in the
file reads `site_address` as a match key.

`tarrow_normalize_address(text)` in `sql/schema/012_address_normalization.sql` is applied to
**both** sides, so a match compares two canonical forms. It is a byte-faithful port of the
TASK-0001 spike's normalizer, and the file states that changing a token rule invalidates the
published measurement. It strips a trailing state/ZIP tail, drops unit designators and
everything after them (every unit in a building sits on the same parcel, so apartment 4B and
apartment 12 correctly get the same answer), reduces punctuation to spaces, strips one
trailing place name longest-match-first, and canonicalizes ordinals, directionals, and the
street type. The street type position accounts for a suffix directional — "WOOSTER ROAD W" —
because treating the last token as the type left `ROAD` un-canonicalized and cost roughly 3
percentage points of avoidable no-matches. It lives in a migration because the runtime role
cannot CREATE anything, and because authored content compiled in by a build step is the shape
Principle IV sets.

Three things the query **cannot** do, structurally:

- **No fuzzy matching.** No `similarity()`, `levenshtein()`, soundex, trigram operator, or
  `LIKE` against user input. This is a safety decision: 50.1% of text-matching failures are
  house-number disagreements between county datasets (4921 vs 4932 FRIAR RD), and edit
  distance cannot distinguish a typo from a different building.
- **No coarse fallback.** No ZIP, street, or city centroid, no "nearest parcel anyway". The
  parcel search is bounded by `ST_DWithin(..., 5)` with no `ORDER BY ... LIMIT 1` escape
  outside that bound, so a point with no parcel within 5 m yields a NULL parcel and the
  caller declines.
- **No silent pick between candidates.** Every matching address point returns one row;
  resolving several to one answer is the caller's job, and it resolves to the most
  restrictive candidate. One normalized address can map to as many as 505 parcels — "2200
  HIGH ST" appears 218 times.

The parcel lateral excludes mineral-rights parcels (`NOT p.is_mineral_rights`, spelled that
way so the partial GiST index is chosen) and orders deterministically and over-restrictively:
containment beats proximity, then the *larger* parcel (it reaches closer to any premises, so
it flags more), then the county identifier and surrogate key.

The query **always returns at least one row**. When nothing matched, that row carries a NULL
`address_point_id`, so "we looked and found nothing" is a value the caller receives rather
than an empty set it must interpret.

## Connections

- [[search-orchestration]] consumes these rows and decides the decline branches.
- [[proximity-measurement]] takes the resolved parcel ids.
- [[measurement-uncertainty]] supplies `tarrow_residence_uncertainty_m`, called here.
- [[database-schema]] holds `address_points.normalized` and the indexes.

## Operational notes

The 5 m bound is a coordinate-noise tolerance between two independently digitised county
layers, deciding *which* surveyed polygon a point belongs to. It is not an assumed parcel
radius and never enlarges a polygon; widening it would start attributing residences to
parcels they are not on. `match_basis` is `point_in_parcel` or `point_near_parcel`; NULL is
the decline signal.
