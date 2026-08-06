---
name: search-orchestration
description: The control flow of answering one address — manifest first, refuse on empty layers, resolve, decline without a parcel, measure pessimistically, resolve ambiguity to the most restrictive candidate.
kind: pipeline
sources:
  - app/server/search.ts
verified_against: b5b247a6cb390ba505c674f0c77af551dd547949
---

# Search orchestration

`app/server/search.ts` exports one function, `search(rawAddress, connect?)`, which turns a
typed string into a `SearchResult`. The module header states that its ordering *is* the
safety argument, not an implementation detail. Nothing in it logs — not the address, not a
normalized form, not a parcel id, not a timing.

## How it works

The order is fixed:

1. **Read the coverage manifest first.** Every answer carries it, including answers that
   found nothing, so it is a precondition of producing a result rather than something
   appended later. A missing rule-content disclosure returns `search-failed` with
   `MissingRuleDisclosureError`'s reasoning surfaced as `detail`.
2. **Refuse on an empty layer.** If `addressPointCount`, `measurableParcelCount`, or
   `premises.measurable` is zero, the result is `declined` / `data-not-loaded`. An unloaded
   database must say its data is absent, never return an empty confident-looking result.
3. **Resolve** via `query("resolve_address")`. No fuzzy match, no coarse fallback — see
   [[address-resolution]].
4. **Decline when a resolved point has no parcel.** All candidates without a parcel →
   `resolved-point-has-no-parcel`; *some* without → `some-candidates-have-no-parcel`,
   because answering for the rest would state a result while silently leaving one possible
   location unchecked.
5. **Measure** via `query("proximity")`, passing parallel arrays of candidate parcel ids and
   their residence uncertainties.

Candidates are keyed by distinct parcel: several address points on one parcel are one
answer, not an ambiguity, since every unit of a building is the same distance from every
premises. When more than one parcel remains, `declareAmbiguity` records every candidate and
`mostRestrictiveFirst` sorts them — more flags beats fewer, then nearer pessimistic distance,
then parcel id so two identical searches cannot disagree between runs. tarrow never silently
picks one.

`assertPessimistic(row)` is a runtime guard on the arithmetic's direction. It recomputes
`d - r_a - r_b`, and throws if the value drifts, if `d_min > d`, or if `d_min >= buffer`.
Both radii are subtracted, so `d_min` can never exceed `d`; a larger value would mean a
radius was added somewhere, which shrinks the flagged set and under-restricts.

The function **never throws to its caller**. Every failure is a variant carrying a manifest,
because a thrown error might be rendered as nothing at all, and a blank page after typing an
address reads like a clean answer. The `connect` parameter exists only so tests can reach the
failure variants; there is no production caller that passes it.

## Connections

- [[result-type-gate]] defines every variant this returns and forbids a clearance-shaped one.
- [[coverage-manifest]] is read in step 1; [[address-resolution]] and
  [[proximity-measurement]] are steps 3 and 5.
- [[answer-rendering]] receives the result and decides nothing.
- [[database-access]] supplies the pool and the query registry.

## Operational notes

`bufferMeters` on the result is taken from the flagged rows, falling back to the manifest —
never a literal. Both sources are the same SQL function
(`tarrow_unverified_state_buffer_m`), so the measurement cannot disagree with the disclosure
of the measurement. Every error branch draws `detail` from fixed strings and interpolates
nothing the user typed.
