---
name: coverage-manifest
description: What was and was not checked, read from the database on every answer and mandatory on every result variant — including a gate that refuses to build a manifest without the rule-content disclosure.
kind: component
sources:
  - app/server/manifest.ts
  - app/sql/query/manifest.sql
  - app/server/result.ts
  - app/tests/manifest.test.ts
verified_against: ad1085047fbf413d249818b651dcb224725409e3
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

Each gap carries a short `label` and a full `description` — two audiences, not a summary and
its expansion. `readManifest` threads both through from `coverage_gaps`; the answer surface
renders the labels and `/faq` renders the descriptions. See [[coverage-gap-ledger]].

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

`ManifestRuleContent` has no `verified: true` inhabitant. A file-authored, human-verified rule
pipeline would add that variant along with the data that earns it; until one exists, the type
cannot express a verified rule. Dates are normalized to ISO strings by the module's `iso()`
helper; counts arrive as strings from `pg` and are coerced with `Number`.

The withdrawn-manifest statement is written for a member of the public: no issue numbers, no
internal task ids, no "not yet built". It says what is true — no rule record checked by a
person exists here — rather than what somebody plans to do about it.
