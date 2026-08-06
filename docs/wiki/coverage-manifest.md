---
name: coverage-manifest
description: What was and was not checked, read from the database on every answer and mandatory on every result variant — including a gate that refuses to build a manifest without the rule-content disclosure.
kind: component
sources:
  - app/server/manifest.ts
  - app/sql/query/manifest.sql
  - app/server/result.ts
  - app/tests/manifest.test.ts
verified_against: b5b247a6cb390ba505c674f0c77af551dd547949
---

# Coverage manifest

Constitution Principle II says coverage may never be inferred from silence: absence of a
flag is meaningful only against a stated list of what was searched. The manifest is that
list, and it is data rendered to the user rather than an assumption baked into code.

## How it works

`app/server/manifest.ts` is almost entirely shape translation from `sql/query/manifest.sql`.
There is deliberately no list of layers, no list of gaps, and no hardcoded set of what this
release covers — a constant in that file would be exactly the assumption Principle II
forbids.

The one thing the module adds is a **gate**. `readManifest(client)` searches the gaps for a
row whose `subjectType` is `rule_content` (`RULE_CONTENT_SUBJECT_TYPE`) and throws
`MissingRuleDisclosureError` when it is absent. That row is how every answer discloses that
tarrow's 304.8 m buffer is applied without the file-authored, human-verified rule record
Principle V requires. Deleting it does not quietly remove a paragraph from a page; it fails
every search loudly. The file names the difference: honesty held as a gate rather than as a
habit.

A `LoadedCoverageManifest` carries `layers` (each with source URL, jurisdiction, `fetchedAt`,
`verifiedAt`, `rowCount`, and whether it was `queried`), `gaps`, `measurementBases`,
`premises` counts split into `total` / `measurable` / `notMeasurable`, `ruleContent`,
`bufferMeters`, `addressPointCount`, `measurableParcelCount`, and both the newest and oldest
layer fetch dates — the last two are how a self-hosted instance can say it is stale.

`verifiedAt` is null for every layer in this release and is rendered as exactly that. A fetch
date is not permitted to stand in for a verification date.

`unreadableManifest(statement)` is the manifest when the ledger itself could not be read.
Still mandatory, still on the result, and it says the only true thing available: nothing was
checked, and tarrow cannot even tell you what it would have checked. It is not the hardcoded
coverage list Principle II forbids because it claims no coverage — it withdraws every claim.
`manifestWasRead()` is the type guard distinguishing the two.

## Connections

- [[coverage-gap-ledger]] supplies the gaps, including the `rule_content` row this gate
  requires.
- [[result-type-gate]] makes the manifest a mandatory, non-optional field on every variant.
- [[search-orchestration]] reads it before anything else.
- [[answer-rendering]] is where it reaches the page.
- [[ingest-pipeline]] writes the layer registry and freshness stamps it reports.

## Operational notes

`ManifestRuleContent` has no `verified: true` inhabitant. When TASK-0003 lands the
file-authored rule pipeline, it adds that variant along with the data that earns it. Dates
are normalized to ISO strings by the module's `iso()` helper; counts arrive as strings from
`pg` and are coerced with `Number`.
