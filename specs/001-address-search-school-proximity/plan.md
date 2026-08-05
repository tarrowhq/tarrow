# Implementation Plan: Address search returns school proximity with a coverage manifest

**Branch**: `task-0002-walking-skeleton` | **Date**: 2026-08-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-address-search-school-proximity/spec.md`

**Runbook**: `docs/design/task-0002-walking-skeleton-runbook.md` — the orchestration
contract. Implementers read *this* file; the runbook's binding rulings are restated here
in full rather than referenced, because an implementer reads the spec directory, not the
runbook.

## Summary

Ship the first vertical slice: a typed Summit County address resolves against the county
Address Points layer, its parcel is found geometrically, and school premises parcels
within 304.8 m are returned — together with a coverage manifest naming everything this
release does not check. Privacy architecture is built into the same slice rather than
after it.

The technical approach is settled by two prior artifacts and is not re-derived here: the
constitution (v1.2.0, ratified) and `spikes/task-0001-geocoding/DECISION.md`. What was
genuinely open — the application stack — was decided by the operator on 2026-08-04 and is
recorded below as R1–R4.

## Technical Context

**Language/Version**: TypeScript on Node.js 22 (`node:22-bookworm-slim`, pinned,
multi-arch).

**Primary Dependencies**: React Router 7 in SSR mode (owns the HTTP server); `pg` for
PostgreSQL. Tailwind CSS and shadcn/ui (vendored source, not a runtime dependency) for the
interface. **No ORM. No query builder over the spatial path. No HTTP framework beneath
RR7 and no adapter in the request path.**

**Storage**: PostgreSQL 17 + PostGIS 3 (`docker/db`, built on the official postgres image
plus PGDG packages — already established, unchanged by this feature).

**Testing**: Node's built-in test runner, executed inside the composition. Tests that
assert over rendered HTML operate on **raw response bodies**, never on a hydrated DOM.

**Target Platform**: Container composition only, `linux/amd64` and `linux/arm64`.

**Project Type**: Server-rendered web application plus an ingest pipeline, sharing one
image.

**Performance Goals**: A single-address query must return within a page-load budget on a
laptop-class container. The spatial index must be used — an EXPLAIN showing a sequential
scan over parcels is a defect, not a tuning opportunity.

**Constraints**: No outbound network call in the query path. No request logging. No
third-party origin. Full truncate-and-reload for derived tables. Everything runs in
containers.

**Scale/Scope**: Summit County only — roughly 250k parcels and 190k address points, plus a
few hundred school premises.

## Binding rulings (operator, 2026-08-04) — do not reopen inside a phase

### R1 — React Router 7 (SSR) owns the HTTP server

The query surface is React Router 7 in server-side-render mode, on its own Node server.
**No Fastify, no Express, no adapter in the request path.** RR7's form-action model
degrades to working HTML with JavaScript disabled, which for this user population is a
safety property rather than an ergonomic one (FR-015, User Story 4 scenario 4). An adapter
bridging RR7 to another HTTP server would sit in the safety-critical request path and is
the piece most likely to rot under Principle VII.

CSP headers and the no-logging posture are set in the RR7 server entry.

### R2 — TypeScript ETL; the spike's Python container is frozen

Production ingest is TypeScript, shipped in the same `docker/app` image as the query
surface. `docker/tools` (Python 3.12 + psycopg) stays **byte-identical**, moved behind a
compose profile named `spike`, for one reason: `spikes/task-0001-geocoding/README.md` must
keep reproducing the numbers in `RESULTS.md`, which are the standing evidence for the
96.79% match rate (FR-032).

### R3 — "Deployed and working end to end" means the container composition

`docker compose up --build` from a clean clone stands up db + app and serves the full
flow. **No public internet deployment in this feature.**

### R4 — No ORM; spatial SQL is authored as files

Raw parameterized SQL over `pg`. Spatial queries live in `.sql` files loaded at startup
rather than inline template literals, so the safety-critical query is reviewed as a file
diff — the same posture Principle IV takes toward rule content. DECISION §2 makes
EPSG:6549 and the avoidance of geography casts load-bearing, and an ORM abstraction is
exactly where a geography cast reappears unnoticed.

## Constitution Check

The constitution is **ratified at v1.2.0** — a real document, not an unfilled template.
Planning is checked against it directly.

| Principle | How this plan satisfies it | Enforcement artifact |
|---|---|---|
| **I — Fail safe, say which way** | Decline when no parcel within 5 m; no fuzzy matching; no coarse fallback; uncertainty compared on the pessimistic bound; ambiguity declared not guessed; a geometry-less school becomes a declared gap, never a radius | FR-005 to FR-008, FR-012; tests in P3 |
| **II — Coverage is part of the answer** | Manifest on every result including declines, naming absent layers explicitly; present in the server-rendered document, never behind hydration | FR-009, FR-015; raw-HTML test in P5 |
| **III — Privacy is a stance** | No request logging anywhere; no outbound call in the query path; CSP permitting only own origin; self-hosted fonts; error paths carry no query context; published outsider-verification procedure | FR-023 to FR-028; log-grep test in P4 |
| **IV — Files authored, database derived** | Truncate-and-full-reload; application DB role holds **no write grant** on derived tables; spatial SQL authored as files | FR-021, FR-022; grant assertion in P1 |
| **V — Every answer carries receipts** | Layer provenance and refresh dates in the manifest. **Partially satisfied and stated as such** — see Complexity Tracking | FR-019, FR-031 |
| **VI — Complete a jurisdiction before claiming it** | Summit County only; coverage explicitly partial and declared on every answer; out-of-county addresses decline | Spec Assumptions; FR-013 |
| **VII — Anyone can run it themselves** | Container composition is the only supported way to run; images pinned and multi-arch; every input freely redistributable; spike reproducibility preserved | FR-029, FR-030, FR-032 |

**Delivery rules**: one TASK, one PR — subtasks .01–.04 ride this branch and merge in its
single PR. Every PR leaves main deployable: this feature's phases are internally ordered
so that the branch is only *opened* as a PR once the whole slice works.

## Project Structure

### Documentation (this feature)

```text
specs/001-address-search-school-proximity/
├── spec.md      # requirements, mapped to TASK-0002's eight ACs
├── plan.md      # this file
└── tasks.md     # the five phases, as checkboxes the bridge derives from
```

### Source code (repository root)

```text
docker/
├── db/                     postgres:17-bookworm + PostGIS      UNCHANGED
├── tools/                  python:3.12-slim   profile: spike   FROZEN (R2)
└── app/                    node:22-bookworm-slim               NEW
    └── Dockerfile          multi-stage: build deps discarded from the runtime image

app/
├── package.json            pinned; lockfile committed
├── react-router.config.ts  SSR mode
├── vite.config.ts
├── server/
│   ├── entry.ts            RR7 node server; CSP headers; logging explicitly off
│   └── db.ts               pg pool; reads SQL files at startup
├── sql/
│   ├── schema/             migrations, applied in filename order
│   │   ├── 001_layers.sql          layer registry + freshness
│   │   ├── 002_address_points.sql
│   │   ├── 003_parcels.sql
│   │   ├── 004_school_premises.sql
│   │   ├── 005_coverage_gaps.sql
│   │   └── 010_grants.sql          REVOKE writes on derived tables from the app role
│   └── query/              the safety-critical queries, reviewed as file diffs
│       ├── resolve_address.sql     address point -> parcel
│       └── proximity.sql           nearest-boundary distance in EPSG:6549
├── etl/
│   ├── fetch.ts            pages the county ArcGIS FeatureServers to NDJSON
│   ├── load.ts             COPY into staging, then truncate-and-reload derived
│   └── layers.ts           per-layer source definitions, provenance, gap ledger
├── app/                    RR7 routes
│   ├── root.tsx
│   └── routes/
│       ├── _index.tsx      the address form
│       └── search.tsx      action + result; manifest rendered server-side
└── tests/
    ├── proximity.test.ts   distance, uncertainty, decline paths
    ├── copy.test.ts        no permission vocabulary in rendered strings
    ├── manifest.test.ts    manifest present in raw HTML on every result shape
    └── privacy.test.ts     no address or IP in any captured log stream

docs/
├── design/task-0002-walking-skeleton-runbook.md
└── privacy/verification.md  how an outsider checks the claims   NEW (P4)
```

**Structure Decision**: One application directory holding both the query surface and the
ingest pipeline, because R2 puts them in one image and one language. SQL is deliberately
*outside* the TypeScript tree in `app/sql/`, split into `schema/` (migrations) and
`query/` (the safety-critical statements), so that a reviewer auditing distance
measurement reads SQL files rather than hunting template literals.

## Phases

Implementation dispatches **one fresh agent per phase**, at the model the runbook pins.
Nothing passes between phases except artifacts: a ticked box in `tasks.md`, a committed
slice, or a note in this directory or on the board card.

| Phase | Scope | Model |
|---|---|---|
| P1 | PostGIS baseline and deploy pipeline | `claude-sonnet-5` |
| P2 | Summit County school premises ingest | `claude-opus-5` |
| P3 | Proximity query and coverage manifest | `claude-opus-5` |
| P4 | No-log privacy architecture, CSP, verification | `claude-opus-5` |
| P5 | Web surface and end to end | `claude-opus-5` |

## Gates every phase must respect

- Everything runs through `docker compose`. Nothing is installed on a host. A phase that
  verifies itself by running a tool on the host has not verified itself.
- Images pinned; both architectures build.
- **Rebases are forbidden repo-wide** by the root-guard hook; freshen by merging
  `origin/main` in. No force-push. No squash merge.
- No writes to the root checkout — all authoring happens in the worktree.
- The board moves only through the `backlog` CLI.
- **The coverage manifest may never be gated behind hydration.** Radix/shadcn interactive
  primitives render an empty shell without JavaScript; using one for the limitations
  disclosure would produce a Principle II failure arriving through a UI component rather
  than a data gap. Use `<details>` or CSS.
- A gate cannot be softened inside a phase. If one cannot be met, stop and report it.

## Complexity Tracking

| Violation | Why needed | Simpler alternative rejected because |
|---|---|---|
| **Principle V is only partially satisfied** — the manifest carries layer provenance and refresh dates, but the 304.8 m buffer is applied without a file-authored, human-verified rule record carrying its citation, effective date, and verifier | TASK-0003 builds the rule-as-data pipeline; blocking this slice on it would invert the milestone order and leave the walking skeleton unshippable | Hand-writing a rule record here would create an unverified rule row that TASK-0003's ETL is designed to destroy, and would let the interface claim a verification that never happened. The honest alternative — and the one taken — is that the manifest **states that rule content is not yet verified data**, which is Principle II applied to our own gap rather than only to the county's |
| **Two container images carry a language runtime** (`docker/app` Node, `docker/tools` Python) | `spikes/task-0001-geocoding` is the standing evidence for the 96.79% match rate and must keep reproducing (FR-032) | Porting the spike to TypeScript would make RESULTS.md unreproducible as published, which Principle V's "a measurement produced in an environment nobody else can reconstruct is an anecdote" forbids. Mitigated by putting `tools` behind a `spike` compose profile so the production composition remains one runtime |
