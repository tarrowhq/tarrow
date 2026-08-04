# somap Constitution

somap answers one question for one person: *"Am I allowed to live here?"*

Its users are people on a sex offender registry looking for housing. They are subject to a
patchwork of state statutes and municipal ordinances that no single authority publishes, that
frequently contradict each other, and that they are nonetheless required to obey under threat
of injunction, re-arrest, or homelessness. Today the only way to get an answer is to call a
sheriff's office and ask about one address at a time.

somap is a helper, not an authority. It is not legal advice. Its purpose is to turn three days
of guessing into an hour of searching plus one confirming phone call.

Every principle below exists because of that user and that stake.

## Core Principles

### I. Fail Safe, and Say Which Way You Failed

Errors in this system are not symmetric.

- **Over-restriction** (we flag an address that is actually permitted) costs the user a house
  they could have had. Annoying. Recoverable.
- **Under-restriction** (we call an address clear when it is not) can cost the user an
  injunction, a violation, or their liberty. Not recoverable.

Therefore: **when uncertain, restrict.** Prefer a false flag to a false clearance in every
design decision, data-quality tradeoff, and ambiguous statutory reading.

Consequences that bind:

- **somap never says "approved," "legal," or "clear."** The strongest available answer is
  *"outside every buffer we checked."*
- **Data completeness outranks data precision.** A missing daycare is a safety defect. A
  daycare we flagged that turns out not to legally qualify is a disclosure item.
- Work whose failure mode is under-restriction carries the `x:safety` label and gets
  proportionate review.

### II. Coverage Is Part of the Answer

Because incomplete data is dangerous (Principle I), somap may never let coverage be inferred
from silence.

Every result states what was checked and what was not — which rule sources are loaded for that
jurisdiction, which point-of-interest layers were queried, which are absent, and when each was
last verified. Absence of a flag is meaningful only against a stated list of what was searched.

This is also what makes incremental release safe: a build covering three of five protected
facility classes is honestly shippable *because it says so on every answer*. Coverage is data
rendered to the user, never an assumption baked into the code.

Where somap has no verified rules for a jurisdiction, it declines rather than guesses.

### III. Privacy Is a Stance, Not a Risk Calculation

Registry data is already public. That fact does not license somap to be careless with
anything, and it will never be used as an argument to store more.

The reasoning is deliberate: "it's already exposed" is the same logic that justifies the public
registries themselves. somap declines that logic and holds the stricter line on the data it
controls, as a matter of principle and as a model for others.

Two premises about our users are assumed true and not re-litigated:

1. **They are paranoid for good reason.**
2. **They need to *know* their data is private, not be told it is.**

Rules that follow:

- **No personally identifying information is stored server-side. Ever.** Not offense details,
  not tier, not searched addresses, not IP addresses, not derived or coarsened versions of any
  of these.
- **Coarse attributes are still identifying.** County plus tier plus offense class can be
  reverse-joined against a public registry to name a person. "Anonymized" is not a category
  somap recognizes for user attributes.
- **User attributes live on the user's device.** Saved profiles are browser-local. The server
  is never told who is asking or what they are asking about.
- **The uniquely dangerous datum is future intent** — where someone is *trying* to move. It
  exists nowhere else in the world. somap does not create it as a record.
- **Encryption at rest is not a substitute for absence.** It defends against a stolen disk and
  nothing else — not subpoena, not application compromise, not insider access. The control is
  not holding the data.
- **Privacy must be verifiable, not asserted.** No analytics, no third-party scripts, no
  request logs tying a person to a place, source open to inspection, published threat model. A
  competent outsider must be able to *check* our claims, not read a policy about them.
- Work touching this surface carries `x:privacy`.

### IV. Legal Content Is Authored as Files, Served from the Database

Rule content — statutes, ordinances, buffers, protected facility classes, measurement methods —
is authored as reviewable files in version control and compiled into the database by an ETL
step. Both halves are permanent architecture, not a stage to be migrated away from.

- **Files are the source of record.** A legal rule changing requires a human to review a diff
  with old text beside new and approve it. Git provides that natively and keeps providing it at
  national scale, where the binding constraint is review surface, not row count.
- **The database is a derived, disposable projection.** Rebuilt in full from the files on every
  deploy — truncate and reload, never incremental sync. There is no reconciliation logic and
  therefore no possibility of drift.
- **The database is never the authoring surface.** Rule tables are read-only at runtime; the
  application never writes to them. A hand-edited rule row is destroyed by the next deploy, and
  that is the intended behavior — it is what keeps version control genuinely authoritative
  rather than nominally so.
- **Geographic and point-of-interest data is a separate pipeline** with different sources,
  different cadence, and no file-authoring stage. It is machine-sourced and lands directly in
  the spatial database with its own provenance and staleness tracking. The rule pipeline is
  small and review-gated; the POI pipeline is large and freshness-gated. They are not merged.

### V. Every Answer Carries Its Receipts

A result the user cannot verify is a result they must simply trust, and somap has not earned
and does not want that kind of trust.

Every rule record carries, as data: the citation, a resolvable source URL, the effective date,
the date it was last human-verified, and who verified it. Every answer surfaces them — *which*
ordinance, *as of when*, *verified by whom*. This is what lets a user take our output to a
sheriff's office or an attorney and have a real conversation instead of an argument about a
website.

Rules are extracted with machine assistance and **verified by a human before they can ship**.
Rule content is never generated at query time.

The ETL step (Principle IV) is the enforcement point: schema conformance, resolvable citations,
and verification freshness are checked at build. A stale or unverifiable rule fails the build
and does not reach production. Freshness for legal content is measured in calendar time, not
in commits — statutes change on their own schedule.

### VI. Complete a Jurisdiction Before Claiming It

somap expands by whole jurisdictions, smallest complete unit first: a county's municipalities,
then the next county.

A jurisdiction is *claimed* only when its state rules and its municipal layer are both loaded
and verified. Until then it is explicitly listed as partial coverage under Principle II. Broad
shallow coverage is the failure mode this principle exists to prevent — it is precisely the
under-restriction hazard of Principle I, distributed across a map.

First jurisdiction: **Summit County, Ohio.**

### VII. Anyone Can Run It Themselves

Principle III says privacy must be verifiable rather than asserted. The strongest available
form of that is not a policy a user reads, an audit they must trust, or a promise we could
quietly stop keeping. It is somap running on a machine we do not control.

**somap must remain deployable, in full, by someone who has never spoken to us**, from
publicly available inputs. Not as an export, a stripped community edition, or a courtesy — the
whole system, producing the same answers.

Rules that follow:

- **Every data input must be freely redistributable.** Parcel geometry, facility sources, rule
  files. A source we may query but not republish cannot enter the system, however good it is.
- **No managed service in the query path**, and no dependency licensed per seat, per query, or
  per instance. This forecloses commercial geocoding permanently — which Principle III already
  required, and which this principle now also requires for a second, independent reason.
- **Packaging is a deliverable, not documentation.** An instance someone else can actually
  stand up is the artifact that proves this principle; a README describing how one might is
  not.
- **A self-hosted instance must be able to say it is stale.** It carries the build date of its
  data and the verification dates of its rules, and surfaces them per Principles II and V. An
  instance running six-month-old data is a Principle I hazard unless it announces itself as
  one. We cannot update someone else's deployment; we can make it incapable of hiding its age.

This is also the concrete thing to offer the advocacy organizations of the Partners section.
"Trust our privacy policy" asks a population that has been failed by systems claiming to help
it for exactly the kind of faith it has no reason to extend. "Run your own instance, and we
never see anything at all" asks for none.

The cost is real and accepted: it constrains dependency choices we cannot yet foresee, and it
makes packaging permanent work. That is the trade this principle exists to make.

## Delivery

### Pull Requests

**One TASK, one PR.** A top-level TASK is a deliverable and maps to exactly one branch and one
pull request.

**Every PR leaves the main branch deployable and the application working.** No PR leaves the
system half-migrated, broken, or dependent on a follow-up to function.

These two rules together have a consequence worth stating plainly: **a top-level TASK is a
vertical slice, not a horizontal layer.** "Provision the database" is not a TASK, because it
ships nothing on its own — it is breakdown inside the TASK that does. If a proposed TASK cannot
stand up alone, it is a subtask of the one it serves.

A PR may narrow *coverage* — fewer POI layers, fewer jurisdictions — but never *honesty*. A
partial slice states its limits per Principle II, and that is precisely what makes shipping it
safe.

A PR whose product is a document — a spike's findings, a published policy — satisfies the
deployability rule trivially: it leaves the application untouched and working.

### Subtasks

Subtasks (`TASK-XXXX.NN`) are internal work breakdown. They ride the parent TASK's single
branch and merge in the parent's one PR. **A subtask never gets a PR of its own.**

Mint a subtask record only when the breakdown needs tracking of its own — independent status,
its own implementation notes, or a different person doing it. When the breakdown is merely a
work list, keep it in the parent's implementation plan or Definition of Done rather than
creating task records. Records are for work that needs to move on the board; checklists are for
work that only needs to get done.

### Milestones

Milestones are release tiers grouping several TASKs into a coherent capability step. They are
**not** PR boundaries — each TASK inside a milestone lands as its own PR.

### Board

- Tasks are `TASK-XXXX`, zero-padded to four digits.
- Labels come from the **fixed taxonomy** in `backlog/config.yml`: exactly one `area:*`, exactly
  one `kind:*`, and zero or more `x:*` cross-cutting markers. Introducing a new label requires
  amending that list first — it is a governance change, not a typing convenience.
- Backlog markdown is never hand-edited. All board state moves through the `backlog` CLI.

### Partners

somap is built for a population that has been failed by systems claiming to help it. Advocacy
organizations and reentry programs are the credibility path, and their review is treated as a
gate on public launch, not as marketing. Work here carries `x:partnership`.

## Governance

This constitution supersedes other practice in this repository. Where it conflicts with a
planted or generic instruction block, this document wins and the conflict is recorded here.

- Amendments are made by editing this file in a pull request with the rationale stated. Version
  bumps: MAJOR for removing or reversing a principle, MINOR for adding one or materially
  expanding scope, PATCH for clarification that changes no behavior.
- Principles I, II, and III are **non-negotiable**. They may be clarified or strengthened. They
  may not be relaxed for schedule, cost, or convenience. A change that weakens them is a MAJOR
  amendment requiring explicit, recorded justification.
- Specs, plans, and pull requests are expected to comply. Where compliance is genuinely
  impossible, the deviation is documented in the spec with its reasoning — not omitted.

**Version**: 1.1.0 | **Ratified**: 2026-08-04 | **Last Amended**: 2026-08-04

### Amendment log

- **1.1.0** — Added Principle VII (*Anyone Can Run It Themselves*). MINOR: adds a principle and
  materially expands scope. Raised during TASK-0001, where choosing a geocoding stack that
  sends no user address to a third party (Principle III) turned out to require exactly the
  same property as being self-hostable — every input freely redistributable, nothing licensed
  per query. Ratifying it as a principle rather than leaving it an incidental property of the
  current design, so that it binds future dependency choices and can be offered to partners as
  a commitment rather than an observation. No existing principle is weakened or reversed.
