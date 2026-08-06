---
name: constitution-and-principles
description: The seven constitutional principles tarrow is written against, and the specific file or gate in the repository that enforces each one rather than asserting it.
kind: concept
sources:
  - .specify/memory/constitution.md
verified_against: b5b247a6cb390ba505c674f0c77af551dd547949
---

# Constitution and principles

`.specify/memory/constitution.md` is the governing document for this repository: it
supersedes other practice, and where a generic instruction conflicts with it, it wins.
Principles I, II, and III are non-negotiable — they may be clarified or strengthened, never
relaxed for schedule or cost. Version 1.2.0, ratified 2026-08-04.

The document is unusual in that nearly every principle names its own enforcement point in
code. Reading a principle without the mechanism beside it misses the design.

## How it works

**I. Fail safe, and say which way you failed.** Over-restriction costs a house;
under-restriction can cost liberty. When uncertain, restrict. The strongest available answer
is *"outside every buffer we checked"* — never approved, legal, or clear. Enforced by
[[result-type-gate]] and by the sign of the arithmetic in [[measurement-uncertainty]].

**II. Coverage is part of the answer.** Coverage may never be inferred from silence. Every
result states what was checked and what was not. Enforced by [[coverage-manifest]], which is
mandatory on every result variant including failures, and by [[coverage-gap-ledger]].

**III. Privacy is a stance, not a risk calculation.** No PII server-side, ever — not
addresses, not IPs, not coarsened versions. "It's already public" is explicitly rejected as
an argument. Privacy must be verifiable rather than asserted. Enforced by
[[process-output-seal]], [[http-envelope]], [[database-logging-posture]], and checked by
[[privacy-verification]].

**IV. Legal content is authored as files, served from the database.** Rules are reviewable
files compiled into the database by an ETL step; the database is a derived, disposable
projection rebuilt in full. Rule tables are read-only at runtime. Enforced by the
GRANT/REVOKE pair in [[database-schema]] and the truncate-and-reload in [[ingest-pipeline]].

**V. Every answer carries its receipts.** Every rule record carries citation, source URL,
effective date, verification date, and verifier. This release does **not** yet satisfy it —
the file-authored rule pipeline is unbuilt (TASK-0003), and the gap is disclosed on every
answer rather than omitted. See the `rule_content` row in [[coverage-gap-ledger]].

**VI. Complete a jurisdiction before claiming it.** Expansion is by whole jurisdictions,
smallest complete unit first. First jurisdiction: Summit County, Ohio.

**VII. Anyone can run it themselves.** tarrow must remain deployable in full by a stranger,
from freely redistributable inputs, with no managed service in the query path. The container
*is* the environment for everyone including maintainers — nothing installs on a host, images
are pinned and multi-architecture. See [[container-composition]] and [[self-hosting]].

## Connections

- [[overview]] is the system these principles produced.
- [[work-planning]] covers the delivery rules the same document sets: one TASK one PR,
  subtasks never getting their own PR, and the fixed label taxonomy.
- [[data-sources]] shows Principle VII acting as an entry condition on data.

## Operational notes

Amendments happen by editing the file in a PR with the rationale stated, and the amendment
log at the bottom records why each change was made — 1.1.0 and 1.2.0 both arose from
TASK-0001, when standing up PostGIS on a laptop would have made accuracy numbers
unreproducible. A change weakening I, II, or III is a MAJOR amendment requiring explicit
recorded justification.
