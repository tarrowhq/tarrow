---
name: coverage-gap-ledger
description: The table where every known absence becomes a row every answer renders — declared gaps authored in code, per-row gaps discovered during a load, tarrow's disclosure of its own unverified rule, and the two-audience split between a short label and the full record.
kind: concept
sources:
  - app/etl/sources.ts
  - app/sql/schema/005_coverage_gaps.sql
  - app/etl/load.ts
verified_against: ad1085047fbf413d249818b651dcb224725409e3
---

# Coverage gap ledger

`coverage_gaps` is how a limitation somebody knew about at ingest time is prevented from
decaying into a limitation nobody remembers. A gap recorded here is honest; a gap living only
in a commit message is the thing Principle I calls unrecoverable.

## How it works

Rows come from two places. `DECLARED_GAPS` in `app/etl/sources.ts` holds the absences no run
will discover on its own, because they are absences in the sources themselves. The loader
appends the rest during a load — a school with no parcel, a dropped geometry, an unnormalizable
address point, a non-unique source key. Both are written to `coverage_gaps` on every reload,
in the shape the coverage manifest renders.

The declared set covers, among others:

- **Facility classes not loaded at all.** ORC 2950.034 protects preschools, licensed child
  day-care centres, children's crisis care facilities, and residential infant care facilities
  as well as schools. This release loads school premises only.
- **Municipal ordinances not applied.** Only the state buffer. An address outside every buffer
  here may still be barred locally.
- **Outside Summit County.** No data for any other county; such an address cannot be answered.
- **A named missing school.** St. Vincent-St. Mary High School, absent from the federal survey
  and held under a company name no source identifies as a school — a confirmed miss found by
  spot-checking, and evidence that other nonpublic schools are missing too.
- **Source weaknesses**: the owner-name heuristic's blind spot, the absent Ohio chartered
  nonpublic directory, chartering status not distinguished, snapshot years, ORC 2925.01(S)(b)
  unreachable for nonpublic and leased parcels, uneven municipal address-point coverage.

The first entry is the one about tarrow's own work: `subjectType: "rule_content"`,
`subjectRef: "orc_2950_034_buffer_unverified"`. It states that the 304.8 m buffer is not
verified rule data, that no human has signed off the reading of ORC 2950.034 inside tarrow,
that the boundary-to-boundary measurement method is tarrow's own over-restrictive reading of a
statute that does not say how the distance is measured, and that neither has been checked
against Ohio case law. Principle II applied to tarrow rather than only to its sources.

That row is **load-bearing**: `server/manifest.ts` refuses to produce a manifest at all when it
is absent, so deleting it fails every search loudly instead of quietly removing a disclosure.

## Connections

- [[coverage-manifest]] reads these rows and gates on the rule-content one.
- [[data-sources]] is the same file, describing what each source covers.
- [[ingest-assertions]] enforces that every null-geometry premises has a row here.
- [[answer-rendering]] states the gap labels on the finding card itself, unfolded and beside
  the number they qualify — never behind a link.

## Operational notes

Gap rows carry `layer_id` (nullable — a gap can belong to no layer), `subject_type`,
`subject_ref`, `label`, `description`, and `discovered_at`. `label` is added by
`015_coverage_gaps_label.sql`, not by `005` — it was originally added by editing `005` in
place, which every already-migrated database skipped, and the missing column then failed the
manifest query and refused every search on the deployed instance for three days
([[database-schema]], TASK-0027). The table is rebuilt by
`truncateAndReload` like every other derived table, so a gap removed from the source
enumeration disappears on the next load and a new one appears without migration.

**`label` and `description` are two audiences, not a summary and its expansion.** `label` is
two or three words for the person looking up an address — "Preschools and day-care", "City
and village rules" — and it is what reaches the answer surface. `description` is the full
record: why the gap exists, what it means for an answer, what a self-hoster should know, read
by `/faq` and by anyone auditing the instance.

They were one column, written for the second audience, and the result was a paragraph of
internal reasoning rendered to somebody who wanted to know whether they could live somewhere.
Both are `NOT NULL`, and `writeGaps` in `app/etl/load.ts` refuses a gap missing either one by
name rather than letting the constraint fire on an unidentified row — a gap with no label
would reach the answer as a blank entry, which is a limitation rendered as nothing.

Neither may carry an issue number, an internal task id, or a "not yet built". This text ships
to a member of the public who has no idea what the tracker is; a gap is a fact about this
instance's coverage and stays true whether or not anybody files a ticket.
