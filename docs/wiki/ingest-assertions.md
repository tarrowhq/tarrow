---
name: ingest-assertions
description: Load-time checks that abort the ingest rather than warn — key usability, row accounting, mandatory gap rows for null geometry, and a guard against the schema growing an assumed school radius.
kind: pattern
sources:
  - app/etl/assert.ts
  - app/etl/ingest.ts
verified_against: b5b247a6cb390ba505c674f0c77af551dd547949
---

# Ingest assertions

`app/etl/assert.ts` exists because the failure it catches is invisible: a pipeline that drops
or collapses rows runs green, and the only symptom is a school that is never flagged. That
class of error is unrecoverable, so these abort rather than warn. All throw
`IngestAssertionError`.

## How it works

**`assertKeyUnique(client, table, column, declaredNonUnique)`** measures how well a column
behaves as a key — total, distinct, duplicated, empty — and throws unless the column is named
in that layer's `declaredNonUniqueKeys`. The error text explains the choice: collapsing or
dropping rows removes premises from the answer. The exemption preserves rows rather than
tidying labels — 30,426 duplicate `ADDR_ID` values would otherwise collapse into addresses
that silently stop resolving. Removing a column from that list makes the assertion fire on
real data, which is how it is shown to be live rather than decorative. `auditKey` is the same
measurement without the throw.

**`assertNoRowsLost(label, fetched, loaded, droppedWithReason)`** requires every fetched
feature to be accounted for: loaded, or dropped for a reason the caller names and has
recorded. Silence is not an option — a row that disappears between the source and the database
is a coverage gap nobody will ever see.

**`assertEveryNullGeomIsDeclared(client)`** enforces the invariant that a school premises row
with no geometry must have a `coverage_gaps` row explaining it, matched on
`layer_id || ':' || source_ref`. A NULL geometry that nothing declares is a school that
quietly stops existing. The NULL is permitted precisely *because* the ledger entry is
mandatory, never because the school may be approximated. Returns the count so the ingest can
report it.

**`assertNoAssumedSchoolRadius(client)`** queries `information_schema.columns` for any
`school_premises` column matching `%radius%`, `%uncertain%`, or `%buffer%`. There is no such
column to check, which is the point: the assertion is that the table's shape has not drifted
into offering one. A school radius is forbidden at any value, because a campus's p95 extent
(1,575 m) exceeds the entire 304.8 m buffer.

## Connections

- [[ingest-pipeline]] calls all four, per-layer and as closing checks.
- [[data-sources]] holds the `declaredNonUniqueKeys` exemption lists.
- [[coverage-gap-ledger]] is what the null-geometry assertion requires to exist.
- [[measurement-uncertainty]] is the other half of the no-assumed-radius rule, enforced by a
  NULL return in SQL.

## Operational notes

`auditKey` interpolates table and column names into SQL; both come from pipeline constants,
not user input, and `etl/load.ts` guards identifiers separately with `ident()` against a
`^[a-z_][a-z0-9_]*$` pattern. Audit lines are printed at the end of every ingest run so
duplicate and empty counts are visible without querying.
