# Tasks: Address search returns school proximity with a coverage manifest

**Input**: [spec.md](spec.md), [plan.md](plan.md)

**Board task**: TASK-0002 · **Runbook**: `docs/design/task-0002-walking-skeleton-runbook.md`

Five phases, strictly ordered. **One fresh implementer agent per phase**, dispatched at
the model the runbook pins. Nothing passes between phases except artifacts: a ticked box
here, a committed slice, or a note in this directory or on the board card.

Every phase runs its verification through `docker compose`. A phase that verifies itself
by running a tool on the host has not verified itself.

---

## Phase 1: PostGIS baseline and deploy pipeline

**Subtask**: TASK-0002.01 · **Model**: `claude-sonnet-5` (mechanical tier — work to the
container pattern this repo already establishes, constraints stated rather than discovered)

**Goal**: The composition everything else sits on, with Principle IV's read-only-at-runtime
rule enforced by grant rather than by convention.

- [x] Add `docker/app/Dockerfile` on pinned `node:22-bookworm-slim`, multi-stage so build
      dependencies are discarded from the runtime image
- [x] Restructure `docker-compose.yml`: production composition is `db` + `app`; move the
      existing `tools` service behind a `spike` profile, leaving `docker/tools/` and
      `docker/tools/requirements.txt` **byte-identical**
- [x] Scaffold `app/` — `package.json` with a committed lockfile, `react-router.config.ts`
      in SSR mode, `vite.config.ts`, and the RR7 server entry that owns HTTP (no Fastify,
      no adapter)
- [x] Add `app/sql/schema/` migrations applied in filename order, and the runner that
      applies them: layer registry with per-layer freshness, address points, parcels,
      school premises, coverage gaps
- [x] Add `app/sql/schema/010_grants.sql`: a distinct application role with `SELECT` only
      on derived tables, and an explicit `REVOKE` of `INSERT`/`UPDATE`/`DELETE`/`TRUNCATE`
- [x] Add the SQL-file loader in `app/server/db.ts` — queries are read from
      `app/sql/query/*.sql` at startup, never inlined as template literals
- [x] Add the truncate-and-full-reload primitive the ETL will use; no incremental sync,
      no upsert path, no reconciliation logic anywhere in the codebase
- [x] Verify `docker compose up --build -d` reaches a healthy `db` and a serving `app`,
      and that migrations apply from an empty volume
- [x] Verify the application role **cannot** write: connect as it and assert an `INSERT`
      into a derived table is rejected
- [x] Verify both architectures build (`docker buildx build --platform
      linux/amd64,linux/arm64` for `docker/app` and `docker/db`)
- [x] Verify `spikes/task-0001-geocoding` still runs under the `spike` profile — the
      README's command sequence, unmodified (see Notes: the *engine* reproduces
      RESULTS.md's numbers; the README's documented step list itself has a pre-existing
      gap, unrelated to this phase's changes)

---

## Phase 2: Summit County school premises ingest

**Subtask**: TASK-0002.02 · **Model**: `claude-opus-5` (`x:safety` — a missing school is
an under-restriction defect, which Principle I classifies as unacceptable)

**Goal**: The data the answer is made of, with every known gap recorded as data rather
than discovered by a user.

- [x] Port the ArcGIS paging fetcher to TypeScript (`app/etl/fetch.ts`), preserving the
      spike's retry behaviour and its handling of ArcGIS signalling failure in a 200 body
- [x] Ingest Summit County **Address Points** with geometry and provenance — required by
      DECISION §6, not optional for this slice
- [x] Ingest Summit County **tax parcels** with geometry and provenance
- [x] Assert `ADDR_ID` uniqueness at load and **fail loudly** rather than silently
      collapsing rows (30,426 duplicates and 26,660 empty values exist in the source)
- [x] Exclude mineral-rights parcels (`usecd` 200-series) from measurement geometry
- [x] Derive each parcel's municipality by spatial join to municipal boundaries —
      `siteaddress` is not unique county-wide
- [x] Enumerate and ingest **school premises** covering public, nonpublic, and chartered
      nonpublic schools, with geometry and provenance. Record in this file's Notes which
      sources were used and what each one covers
- [x] Attach real parcel geometry to every school premises. A school resolvable only to a
      point is written to the **coverage-gap ledger** and is never given an assumed radius
- [x] Record every known source gap as data in the coverage-gap ledger, in the shape the
      manifest will render
- [x] Stamp per-layer fetch dates into the layer registry so freshness is queryable
- [x] Verify: full reload from empty runs end to end in the composition, row counts are
      reported, and the uniqueness assertion actually fails on injected duplicate input
- [x] Verify: no school premises row has null geometry unless a matching coverage-gap row
      explains it

---

## Phase 3: Proximity query and coverage manifest

**Subtask**: TASK-0002.03 · **Model**: `claude-opus-5` (`x:safety` — this phase is
Principle I expressed as arithmetic; a sign error here is the unrecoverable failure)

**Goal**: Given a typed address, the honest answer plus the machine-readable statement of
what produced it.

- [x] Port address normalization from `spikes/task-0001-geocoding/sql/02_normalize.sql`
      into `app/sql/query/resolve_address.sql` — the rule-based normalization that reached
      96.8% on its own; libpostal is not adopted
- [x] Resolve typed address → Address Points match → that point's parcel. Never match
      typed addresses against `parcel.siteaddress`
- [x] Implement `app/sql/query/proximity.sql`: nearest boundary of the residence parcel to
      nearest boundary of the premises parcel, in EPSG:6549, buffer 304.8 m
- [x] Confirm by `EXPLAIN` that the spatial index is used and that no geography cast
      appears in the plan
- [x] Carry an uncertainty radius on every geometry and compare on the pessimistic bound
      `d_min = d(a,b) − r_a − r_b`, flagging when `d_min < buffer`
- [x] Decline when the resolved address point has no parcel within 5 m
- [x] Declare ambiguity when one normalized address maps to several parcels, resolving to
      the most restrictive candidate rather than silently selecting one
- [x] Ensure there is **no code path** that returns a coarse fallback — no ZIP centroid,
      no street centroid, no fuzzy match, no nearby-parcel consolation
- [x] Define the result type as a discriminated union in which **no inhabitant means
      approved, legal, permitted, or clear**, and in which the coverage manifest is a
      mandatory field on every variant including declines
- [x] Build the manifest from data: layers queried, layers absent, per-layer verification
      and refresh dates, the coverage-gap ledger, which delivery path answered, and the
      per-geometry measurement basis
- [x] State in the manifest that rule content is **not yet verified data** — the 304.8 m
      buffer is applied without the file-authored rule record Principle V requires, which
      TASK-0003 builds
- [x] Test: a known address near a known school flags, with the measured distance
- [x] Test: a known address far from every school returns outside-every-buffer
- [x] Test: an address point with no parcel declines
- [x] Test: an unmatched address returns could-not-locate, distinct from both of the above
- [x] Test: the manifest is non-empty and complete on **every** result variant
- [x] Test: attempting to construct a result meaning "clear" fails to type-check —
      recorded as a compile-failure fixture, not merely asserted in prose

---

## Phase 4: No-log privacy architecture, CSP, and verification

**Subtask**: TASK-0002.04 · **Model**: `claude-opus-5` (`x:privacy` — Principle III is
non-negotiable and this phase is its whole enforcement surface)

**Goal**: Make Principle III true and checkable across the whole request path, including
the layers people forget.

- [x] Disable request logging in the RR7 node server explicitly, as a single greppable
      line rather than an emergent default (`REQUEST_LOGGING` in `app/server/http.ts`) —
      and, because auditing was not enough, seal the process's output entirely after
      startup (`app/server/silence.ts`; see Notes)
- [x] Configure PostgreSQL to log neither statements nor connections
      (`log_statement=none`, `log_connections=off`, `log_disconnections=off`), so the
      searched address cannot reach the database log — as **command-line flags**, plus
      the two non-default settings that actually carried the leak (see Notes)
- [x] Ensure error handling carries **no query context** into logs or error output — an
      error may say what failed, never what was searched
- [x] Set the CSP on every response: `default-src 'self'; script-src 'self'; style-src
      'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action
      'self'; frame-ancestors 'none'`
- [x] Self-host fonts or use a system font stack. No Google Fonts, no CDN, nothing that
      resolves off-origin (`app/app/styles.css`, a system stack; no `@font-face`, no
      `@import`, no `url()`)
- [x] Add the build-output scan that fails the build on any external origin in built
      assets — the second layer behind CSP, not a replacement for it
      (`app/scripts/scan-external-origins.mjs`, run as a `docker/app/Dockerfile` step)
- [x] Confirm the query path makes no outbound network call, structurally — three ways,
      and one stronger way that could not be had (see Notes: `internal: true`)
- [x] Test: run a full end-to-end search in the composition, capture **every** log stream
      (app, HTTP server, PostgreSQL, container stdout/stderr), and assert neither the
      searched address nor the client IP appears in any of them
      (`app/tests/no-logging.test.ts` — **it found three real leaks**)
- [x] Test: assert the CSP header is present on every response, including error responses
      (`app/tests/http-headers.test.ts` — 200, 404, 405, a protocol-level 400, a static
      asset, and a thrown/rejected handler's 500)
- [x] Write `docs/privacy/verification.md` — how a competent outsider checks these claims
      from network traffic and the composition alone, with the exact steps and what they
      should see

---

## Phase 5: Web surface and end to end

**Covers**: parent ACs #1, #4, #7, #8 (no subtask — this work moves with its parent) ·
**Model**: `claude-opus-5` (the task's own framing: the hardest part is not the map, it is
the language)

**Goal**: The interface, and proof the whole slice works from a clean clone.

- [x] Build the address form as a plain RR7 route with a form action — working HTML,
      functional with JavaScript disabled
- [x] Build the result view rendering: flagged premises with distances and measurement
      basis, or the outside-every-buffer statement — never approved, legal, permitted, or
      clear
- [x] Render could-not-locate and decline as **visually and textually distinct** from a
      located address with no nearby facilities, distinguishable by more than wording
- [x] Render the coverage manifest in the **server-rendered document** on every result.
      It may be visually collapsed with `<details>` or CSS, but must not require
      JavaScript to reveal. Radix/shadcn interactive primitives are not permitted for this
- [x] Render sheriff-confirmation guidance on every result, including declines and errors
- [x] Surface the data build date and per-layer verification dates, so a stale self-hosted
      instance cannot hide its age
- [x] Wire Tailwind and any vendored shadcn source with no off-origin asset
- [x] Test over **raw response bodies**: no permission vocabulary appears in any rendered
      result (approved, legal, permitted, clear, allowed, OK to live, and the phrasings a
      reader would take as those)
- [x] Test over **raw response bodies**: the manifest strings and the sheriff guidance are
      present on every result shape, with JavaScript never executed
- [x] Verify the whole flow from a clean clone: `docker compose up --build`, run the
      documented ingest, submit an address, read the answer — and record the exact command
      sequence in the repository README
- [x] Make a zero-collection test run **fail**, and document the `test` compose profile as
      the only sanctioned way to run the suite. Found by the orchestrator verifying P3:
      `docker compose run --rm app npm test` exits 0 having collected 0 tests, because the
      runtime image excludes `tests/` by design. A wrong invocation currently reads as
      "everything passes", which is harmless while a human reads the count and dangerous
      the moment it reaches CI or the README
- [x] Verify the flow on both `linux/amd64` and `linux/arm64`
- [x] Tick TASK-0002's eight acceptance criteria on the board, each against a real
      artifact — a passing test, a running container, or a committed document

---

## Notes

Phases record here anything a later phase must know that does not fit in a ticked box —
a source enumeration, a deviation and its reason, a constraint discovered. A phase's
transcript is not an artifact; this section is.

### Phase 1 (TASK-0002.01), 2026-08-04 — implemented by a `claude-sonnet-5` session

**Dependency versions pinned** (checked against the npm registry at implementation time,
since "React Router 7" alone is ambiguous once 8.x is current): `react-router`,
`@react-router/dev`, `@react-router/node` all `7.18.2` (latest 7.x); `react`/`react-dom`
`19.2.8`; `vite` `8.2.0`; `typescript` `6.0.3` (peer range is `^5.1.0 || ^6.0.0` —
TypeScript's own `latest` is now 7.x and does not satisfy it); `pg` `8.22.0`; `isbot`
`5.2.1`. `app/package-lock.json` is committed; regenerate it inside a container
(`docker run --rm -v $PWD/app:/app -w /app node:22-bookworm-slim npm install`), never on
the host.

**`isbot` had to be added as an explicit dependency, not left implicit.** RR7's default
`entry.server` imports it, and `@react-router/dev` will auto-`npm install` it mid-build if
it's missing — but that live install races the same process's own `import()` of
`@react-router/dev/module-sync-enabled/index.mjs` and deletes the file out from under
itself, failing the build with `ERR_MODULE_NOT_FOUND` (reproduced consistently on
`@react-router/dev@7.18.2`). Pinning `isbot` up front in `package.json` avoids the
mid-build install entirely. If a future dependency bump reintroduces an "adding X to your
package.json" message during `npm run build`, add that package as an explicit pinned
dependency rather than letting the auto-install run.

**Server and ETL code runs as `.ts` directly under Node 22's built-in type stripping** —
no `tsc` compile step, no `ts-node`/`tsx`. Confirmed working for relative imports as long
as the specifier carries the literal `.ts` extension (e.g.
`import { x } from "./mod.ts"`). This keeps `docker/app/Dockerfile`'s runtime stage to
`server/`, `sql/`, `etl/` copied verbatim plus `node_modules` from `npm ci --omit=dev` —
nothing else executes them. Only the RR7 app itself (`app/app/**`) goes through
`vite`/`@react-router/dev` at build time, per R1.

**Schema shape landed by this phase** (`app/sql/schema/001`–`005`), grounded in
`spikes/task-0001-geocoding/DECISION.md` and `sql/01_schema.sql`, for Phase 2/3 to build
on rather than redesign: `layers` (registry + freshness/provenance, Principle II/V),
`address_points` and `parcels` (structured on the spike's fields, `geom` typed
`geometry(_, 6549)` per DECISION §2 — no geography casts), `parcels.is_mineral_rights`
as a stored/indexed boolean rather than a repeated `usecd` filter (DECISION §6),
`school_premises.geom` nullable by design (DECISION §3 — a school known only by a point
gets no geometry and no assumed radius, ever), and `coverage_gaps` as the declared-gap
ledger Principle II requires. `address_points.normalized` and the `resolve_address` /
`proximity` query files are Phase 3's to fill in (R4). Additive `ALTER`/new numbered
migrations are the expected way for Phase 2/3 to extend this, not edits to files already
applied.

**`somap_app` role and credentials**: `app/sql/schema/010_grants.sql` creates
`somap_app LOGIN PASSWORD 'somap_app'` — a fixed local-dev credential matching the
existing plaintext `somap`/`somap` convention already in `docker-compose.yml` (R3 rules
out public deployment for this task). `server/migrate.ts` connects as the database owner
(`POSTGRES_USER`/`POSTGRES_PASSWORD`, default `somap`/`somap`) and is the only thing
permitted to run schema DDL; `server/db.ts`'s pool connects as `somap_app` and nothing in
`server/` ever holds owner credentials. ETL writers (Phase 2's `etl/load.ts`, via
`etl/reload.ts`'s `truncateAndReload`) must connect as the owner too, for the same reason
`somap_app` cannot `TRUNCATE`.

**`migrate` is a one-shot compose service**, not logic inside `app`'s startup:
`docker compose up` only reaches a healthy `app` after `migrate` exits 0
(`depends_on: migrate: condition: service_completed_successfully`). Verified idempotent —
re-running `migrate` against an already-migrated database prints `skip` for every file via
a `schema_migrations` tracking table and exits 0.

**Verification used a temporary, uncommitted compose override** to work around an
unrelated port conflict, not a change to the shipped composition: another already-merged
task's (`TASK-0001`) orphaned `db` container from a since-removed worktree was still
bound to `127.0.0.1:55432`, the same host port `docker-compose.yml` publishes for `db`.
Rather than stopping a container outside this task's scope, verification ran with
`docker compose -f docker-compose.yml -f <tmp-override>.yml up`, where the override set
only `db.ports: !reset []`; the override file was never committed and `docker-compose.yml`
itself still publishes `127.0.0.1:55432:5432` as before. Flagging for the operator: an
orphaned `task-0001` container/volume is still running on this host and should be cleaned
up (`docker stop/rm`) by someone with authority over that task's resources — this session
declined to remove it itself.

**Finding — `spikes/task-0001-geocoding/README.md`'s documented reproduction sequence is
incomplete, pre-existing this phase.** Running exactly the commands the README lists
(`load.py`, `sql/02_normalize.sql`, `sql/07_measure_final.sql`) fails:
`07_measure_final.sql` reads `parcel.geom_m`/`addrpoint.geom_m` (created by
`sql/04_measure_v2.sql`) and `parcel.norm_addr`/`addrpoint.norm_addr` (created by
`sql/03_measure.sql`), neither of which the README's listed sequence ever runs. Adding
`sql/03_measure.sql` and `sql/04_measure_v2.sql` before `07_measure_final.sql` (undocumented,
but necessarily what actually produced `RESULTS.md`) lets the full sequence complete and
the scoreboard query reproduces the published numbers closely: Approach B
(`B_addrpoint_spatial`) measured 96.79% correct / 0.21% wrong / 1.75% ambiguous / 1.24% no-match
here, against RESULTS.md's published 96.79% / 0.20% / 1.75% / 1.26% — same conclusion,
trivial variance. **`docker/tools/` and `docker/tools/requirements.txt` are confirmed
byte-identical** (`git diff` empty) and the `tools` service builds and starts cleanly
under the `spike` profile — R2's actual requirement is intact. The defect is narrower:
the README's *documented command list* omits two files, and both instructions and
requirements-following forbid this phase from editing `spikes/` (out of scope, freezing
is the point). Recommend a follow-up task to fix `README.md`'s step list (or fold 03/04
into 07 to make it truly self-contained, matching its own "self-contained" claim) so a
future from-scratch reproduction doesn't hit this.

### Phase 2 (TASK-0002.02), 2026-08-04 — implemented by a `claude-opus-5` session

**Everything ran through `docker compose`.** New job service `etl` (profile `etl`):
`docker compose run --rm etl` fetches every source then loads; `--skip-fetch` reloads from
the NDJSON already on the `etldata` volume. The volume is mounted read-only into `db` as
well, because the bulk load is a **server-side `COPY`** — PostgreSQL reads the NDJSON
itself, so no streaming client library enters the image that also serves the request path
(R1/R4 left the dependency list where it is, and this keeps it there).

#### School source enumeration — what was used, what each covers, what it misses

ORC 2950.034 bars residence within 1,000 ft of *school premises*, which ORC 2925.01(S)
defines as the **parcel** a school sits on, plus **(S)(b)** any other parcel owned or leased
by the school on which school functions occur. ORC 2925.01(R) defines *school* as one
operated by a board of education, a community school (Ch. 3314), a STEM school (Ch. 3326),
or a nonpublic school for which the state board prescribes minimum standards (Ohio's
chartered nonpublic). Four sources are loaded, chosen so their weaknesses do not coincide.
Definitions and provenance live in `app/etl/sources.ts`; the layer registry is queryable.

| Layer id | Source | Rows | Covers | Known to miss |
|---|---|---:|---|---|
| `nces_public_schools_2425` | NCES EDGE geocoded public school locations 2024-25, `CNTY='39153'` | 148 | district-operated, community (charter), and STEM schools — all "public" in the federal CCD universe | schools opened/moved since the 2024-25 snapshot; locates by **geocoded mailing address**, so a point can land in a road or on a neighbour |
| `nces_private_schools_2324` | NCES EDGE geocoded private school locations 2023-24 (PSS), `STFIP='39' AND CNTY='153'` | 36 | nonpublic schools, including Ohio chartered nonpublic | **survey nonresponse — confirmed, see below**; does not distinguish chartered from non-chartered |
| `summit_board_of_education_parcels` | Summit County tax parcels, `usecd='650'` ("exempt — board of education") | 375 | public school district property with **surveyed geometry and county-authoritative ownership**, and the only reach into ORC 2925.01(S)(b) | nonpublic equivalents; any parcel a school **leases** rather than owns |
| `summit_named_school_parcels` | Summit County tax parcels, exempt (`6xx`, excluding 650), owner of record matching `SCHOOL\|ACADEMY\|MONTESSORI\|PREPARATORY` | 60 | nonpublic and community school property the county records regardless of any survey response | property held under a name that is neither the school's nor school-like |

**619 school premises rows total. Every one carries real parcel geometry.**

**The fourth source exists because the second one demonstrably misses schools.**
Spot-checking the first load found that **St. Vincent–St. Mary High School (15 N Maple St,
Akron)** — one of Akron's largest chartered nonpublic schools — is **absent from the federal
PSS file entirely**, in every wave checked. Its campus is in the county tax roll (use code
670, 131 acres) but held by `SVSM FOUNDATION PROPERTIES LLC`, which no name heuristic
should be tuned to match. The owner-name source was added as the structural answer (it
recovered Western Reserve Academy's outlying campus parcels, Cuyahoga Valley Christian
Academy, Lawrence School, Spring Garden Waldorf, Summit Academy buildings, and others), and
**St. Vincent–St. Mary is recorded in `coverage_gaps` by name** as a confirmed miss.

**Operator decision, not a phase-local one** (the runbook names this checkpoint
explicitly). One confirmed missing school is proof that the nonpublic enumeration is
incomplete, and the honest close is Ohio DEW's **chartered nonpublic school directory** as a
file-authored source — it is published only as spreadsheets, so it is real work, not a
fetch. The alternative considered and **rejected** here: blanket-ingesting all 580
`usecd='670'` (charitable/educational) parcels would have caught it, but it also flags every
hospital, YMCA, and charity in the county — over-restriction on a scale DECISION §3 warns
stops being an answer. **Recommend carding the ODEW directory before this slice is offered
to real users.**

#### Coverage-gap ledger

29 rows in `coverage_gaps`, written as data in the shape the manifest renders — 8 authored
in `sources.ts`, the rest measured at load. Notable contents:

- **0 schools without parcel geometry.** All 184 point-sourced schools matched a parcel
  (183 point-in-parcel, 1 within 5 m); the other 435 are parcels to begin with. The
  never-assume-a-radius path is nonetheless implemented, asserted, and exercised — see
  verification below.
- **15 schools matched to a parcel that is not tax-exempt**, one ledger row each. A school
  is essentially always exempt, so this flags a probable geocoding error whose attached
  boundary may be a neighbour's and may **understate** the premises.
- St. Vincent–St. Mary, by name (above).
- ORC 2925.01(S)(b) unreachable for nonpublic schools and for leased parcels.
- ORC 2950.034's other protected classes (preschools, child day-care, children's crisis
  care, residential infant care) **not loaded at all** — TASK-0005.
- Municipal ordinances not loaded — TASK-0007. `RICHFIELD` and `TWINSBURG` each name both a
  municipality and a township, so a jurisdiction name is not an identifier.
- `ADDR_ID` non-uniqueness, measured: 4,527 of 258,862 rows share a duplicated value, 26,660
  carry none. 11 published address points have no coordinate; 6 parcels have no polygon.

#### Row counts (full reload from an empty volume)

`municipalities 31` · `parcels 261,154` (6 of 261,160 without usable geometry; **1,128
mineral-rights excluded from measurement**; 0 without a municipality) · `address_points
258,862` (11 without geometry) · `school_premises 619` · `coverage_gaps 29`.

#### Deviation: how "assert ADDR_ID uniqueness" was implemented

`ADDR_ID` **cannot** be asserted unique — it is not, and never will be (DECISION §7). A
literal assertion would abort every run. What the box protects against is rows being
**collapsed** on it, so the guard is built in two halves, both hard:

1. `assertNoRowsLost` — fetched must equal loaded plus explicitly-counted drops, per layer.
   Nothing may vanish between the source and the database.
2. `assertKeyUnique` — throws on any duplicate or empty value, and the **only** exemption is
   a per-layer `declaredNonUniqueKeys` list in `sources.ts`, one greppable line per column.
   `addr_id` is named there with its reason; the audit still runs and its counts go to the
   ledger. Deleting that line turns the audit back into a hard failure, which is how the
   assertion is kept live rather than decorative — and is exactly how it was proved (below).

Measured aside: `parcel_id` turned out to have **no** duplicates in the source (261,153
distinct over 261,154 rows); it is declared non-unique only because exactly one published
parcel carries no identifier at all — kept, because its polygon is measurement geometry.

#### Verification actually run (commands and results)

- `docker compose run --rm etl` — full fetch of all five services: 258,873 + 261,160 + 31 +
  148 + 36 features, each matching the server's reported count. The fetcher **throws** on a
  short fetch rather than warning, unlike the spike.
- `docker volume rm task-0002_pgdata` → `docker compose run --rm migrate` (all 11 migrations
  applied from empty) → `docker compose run --rm etl --skip-fetch` → **completes, row counts
  above**. Re-run produces identical counts (determinism was a real bug: overlapping parcels
  of equal area tied in the match ordering; fixed with explicit tiebreakers).
- **Duplicate input fails loudly.** Appended a duplicate school record to
  `/data/nces_public_schools_2425.ndjson`, re-ran: `duplicate key value violates unique
  constraint "school_premises_source_idx" … Key (layer_id, source_ref)=(…, 390002701572)`,
  transaction rolled back, exit 1. Nothing collapsed, nothing loaded.
- **The uniqueness assertion is live.** Removed `"addr_id"` from `declaredNonUniqueKeys`,
  rebuilt, re-ran: `IngestAssertionError: address_points.addr_id is not a usable key: 4527
  rows carry a duplicated value and 26660 carry none, over 258862 rows (228436 distinct)`.
  Restored.
- **A geometry-less school becomes a declared gap, never a radius.** Injected a school at a
  coordinate with no parcel: it loaded with `geom IS NULL`, `match_basis='none'`, and a
  `coverage_gaps` row naming it. Deleting that ledger row made
  `assertEveryNullGeomIsDeclared` fire: *"1 school premises rows have no geometry and no
  coverage_gaps row explaining it … An undeclared gap is exactly what Principle II
  forbids."* Fixture restored.
- **Principle IV still holds on the new tables.** `psql -U somap_app -c "INSERT INTO
  municipalities …"` → `ERROR: permission denied for table municipalities`; `SELECT` works.
  `ALTER DEFAULT PRIVILEGES` from 010 covers tables created by later migrations.
- `docker compose up -d` → `db` healthy, `app` healthy, `GET / → 200`.
- Spot checks: Firestone/Buchtel/Ellet CLCs, Archbishop Hoban, Walsh Jesuit, Old Trail,
  Our Lady of the Elms, St Vincent de Paul all present with plausible campus geometry
  (min matched parcel 2.2 acres, median 98).

#### What Phase 3 needs from this

- **`school_premises.geom` is `MultiPolygon(6549)` and is never NULL today, but the NULL
  path is real.** A NULL means *declared coverage gap*, never *measure from a point*. There
  is no radius column on the table and `assertNoAssumedSchoolRadius` fails the ingest if one
  appears. The manifest must render those rows as **not checked**.
- **`match_basis` is the per-geometry measurement basis DECISION §3 asks the manifest to
  render**: `board_of_education_parcel` | `named_exempt_parcel` | `point_in_parcel` |
  `point_near_parcel` | `none`. `match_corroboration = 'uncorroborated'` marks the 15 rows
  whose boundary may understate the premises — surface it.
- **`school_type` has a fourth value, `unclassified`**, on the 60 owner-name rows. The tax
  roll does not say whether the owner runs a nonpublic or a community school; claiming
  either would be a receipt somap has not earned.
- **A school can appear as several premises rows** (one per parcel — Western Reserve Academy
  has seven). That is ORC 2925.01(S) working as written, not duplication to collapse. A
  result listing flagged premises should expect repeated names.
- **`parcels.municipality` is a display name, not an identifier** — join on
  `parcels.municipality_id` (added in `008`). Two Summit County names are shared between a
  city and a township.
- **Mineral-rights parcels are flagged, not filtered at query time**: use
  `WHERE NOT is_mineral_rights`, which has its own partial GiST index
  (`parcels_measurable_geom_idx`).
- **`address_points.normalized` is still NULL** — Phase 3 fills it, and its index exists.
- Migrations `006`–`009` and `011` are Phase 2's; `001`–`005` and `010` were not touched.
  `008`, `009`, and `011` are corrections found by *running* the load, and each says so.

### Phase 3 (TASK-0002.03), 2026-08-04 — implemented by a `claude-opus-5` session

**Everything ran through `docker compose`.** New job service `test` (profile `test`):
`docker compose run --rm test`. It builds from the Dockerfile's **`build` stage**, not the
runtime stage, because that is the only stage carrying `tsc` — which the compile-failure
fixture needs in order to prove a clearance does not type-check. The runtime image still
has no dev dependencies. Tests connect as **`somap_app`**, the read-only role, so the
query is exercised under the privileges it actually has. **43 tests, 13 suites, 0
failures.**

#### Where each thing lives, and why it is not where the box said

- **`sql/schema/012_address_normalization.sql`** — the normalizer ported from the spike,
  byte-faithful (four lookup tables + `somap_normalize_address`). The box said "port into
  `app/sql/query/resolve_address.sql`". It is a plpgsql function plus tables, and
  `somap_app` has `CREATE` revoked (010) — the query loader physically cannot define it.
  Authored content compiled into the database by a build step is also the exact shape
  Principle IV sets. `resolve_address.sql` is the query file that **calls** it, and is
  where a reviewer auditing resolution reads the logic. R4's requirement — the
  safety-critical statement is reviewed as a file diff — holds either way.
- **`sql/schema/013_measurement_uncertainty.sql`** — three functions, and each
  safety-critical constant is written down **exactly once** anywhere in the repo:
  `somap_unverified_state_buffer_m()` (304.8), `somap_residence_uncertainty_m(basis)`,
  `somap_premises_uncertainty_m(basis, corroboration)`. Duplicating a radius or the buffer
  across two files is precisely how a sign or a value drifts, so
  `tests/no-fallback.test.ts` asserts `304.8` and `126` appear in **that one file and
  nowhere else** — including in the TypeScript.
- **The function name `somap_unverified_state_buffer_m` is a load-bearing disclosure.**
  Do not rename it to drop `unverified` before TASK-0003 lands.

#### The uncertainty radii, and the one judgement call in them

`d_min = d(a,b) − r_a − r_b`, flag when `d_min < 304.8`. Both radii subtract.

| Side | Basis | r |
|---|---|---:|
| residence | `point_in_parcel` | 0 m |
| residence | `point_near_parcel` | 5 m |
| premises | `board_of_education_parcel`, `named_exempt_parcel`, `point_in_parcel` | 0 m |
| premises | `point_near_parcel` | 5 m |
| premises | `none` (no geometry) | **NULL** — never measured |
| premises | `+ uncorroborated` | **+126 m** |

**The +126 m is a Phase-3 decision and the only value DECISION §3 did not already fix.**
The 15 `uncorroborated` rows are schools whose geocoded point landed on a parcel the county
does **not** record as tax-exempt — probably a neighbour's lot, so the boundary somap holds
probably **understates** the premises, which is the under-restricting direction. 126 m is
DECISION §3's own measured p95 extent for a typical suburban lot, and the figure it already
adopts as the assumed radius for a residential-lot facility. It is **not** an assumed
radius for a school known only by a point — DECISION §3 forbids those at any value, and the
`none` → NULL branch is how that prohibition is enforced in arithmetic rather than in a
`WHERE` clause somebody could drop.

#### Resolution policy, decided from measured data rather than taste

Measured over all 258,859 normalized address points:

- 5,579 points (**2.16%**) have no parcel within 5 m — matching DECISION §3's 2.15%.
- 232,728 distinct normalized forms; 5,817 (2.5%) carry more than one point.
- **5,451** normalized forms are entirely unmeasurable → `resolved-point-has-no-parcel`.
- **61** normalized forms (**0.026%**) mix measurable and unmeasurable points.

Those 61 are the only case where "answer for the candidates we can measure" was even
tempting. Doing so would state a result while leaving one possible location unchecked —
a false *outside every buffer*. They **decline** (`some-candidates-have-no-parcel`). The
measured cost of the safe choice is 0.026% of searches, so it was not a trade at all.

Where several candidates are all measurable, the ambiguity is **declared** (every candidate
listed, with its flag count and nearest pessimistic distance) and the answer shown is the
**most restrictive** candidate: more flags first, then nearest `d_min`, then parcel id so
two runs cannot disagree. Several address points on **one** parcel are not an ambiguity —
every unit of a building is the same distance from every premises.

#### The type-level gate (spec FR-010)

`app/server/result.ts`. Beyond the closed union, a set of compile-time assertions rejects
any **kind, reason, basis, or field name** in the result or the manifest whose text carries
permission vocabulary (`clear`, `approv`, `permit`, `legal`, `allow`, `lawful`, `eligib`,
`authoriz`, …, matched as substrings). Adding a `kind: "clear"` variant, or a
`permitted: boolean` field, breaks the build **in `result.ts`**, in code the author of that
variant never opened. `ManifestRuleContent` has **no `verified: true` inhabitant** —
TASK-0003 adds it along with the data that earns it.

Two proofs, deliberately both:

- `tests/types/clearance.compile-failure.ts` — excluded from the main tsconfig, compiled
  by `tests/types/tsconfig.compile-failure.json`, and `tests/result-type.test.ts` asserts
  `tsc` **fails** with one diagnostic per case. Case 5 is the load-bearing one: it widens
  the union with a clearance variant and the vocabulary assertion rejects it
  (`Type 'true' is not assignable to type '"clear-to-live-here"'`).
- `tests/types/clearance-guard.ts` — the same cases behind `@ts-expect-error`, **inside**
  the main tsconfig, so `npm run typecheck` fails the moment any of them starts compiling,
  with no dedicated test run.

#### Deviations and pre-existing defects fixed (all outside Phase 3's own surface)

1. **`app/tsconfig.json` had `baseUrl`**, which TypeScript 6 reports as a hard error
   (TS5101) — `npm run typecheck` aborted before checking a single file and had evidently
   never been green. Removed; nothing declared `paths`.
2. **`allowImportingTsExtensions` was missing.** Every relative import carries the literal
   `.ts` extension because Node 22's type stripping requires it (Phase 1's note), and the
   typechecker rejected exactly what the runtime demands. Added.
3. **`app/server/entry.ts`** — one `@ts-ignore` on the generated RR7 bundle import, which
   has no declarations and lives outside the typechecked tree. Phase 4 owns this file;
   nothing else in it was touched.
4. **`app/package.json`** — `"test": "node --test tests/"` does not work (Node 22 resolves
   the directory as a module and throws `MODULE_NOT_FOUND`). Now
   `node --test tests/*.test.ts`.
5. **`app/etl/sources.ts`, `load.ts`, `ingest.ts`** — Phase 2 files, extended not rewritten:
   a `rule_content` declared gap (below), `normalizeAddressPoints()`, and its call **inside**
   `address_points`' truncate-and-reload. There is deliberately no way to refresh
   `normalized` on its own; a partially re-normalized index would silently stop finding
   addresses, and an incremental refresh is the reconciliation path Principle IV forbids.

#### The rule-content disclosure is a gate, not a paragraph

`DECLARED_GAPS` gained one row: `subject_type='rule_content'`,
`subject_ref='orc_2950_034_buffer_unverified'`, stating that the 304.8 m buffer **and the
nearest-boundary measurement method** are applied without the file-authored, human-verified
rule record Principle V requires, and that neither has been checked against Ohio case law.

`server/manifest.ts` **refuses to build a manifest at all** when that row is absent
(`MissingRuleDisclosureError`), so every search fails loudly rather than quietly losing a
disclosure. Tested both ways.

#### `EXPLAIN`: index used, no geography cast

`tests/explain.test.ts` runs `EXPLAIN (ANALYZE, BUFFERS)` on both queries, prints the plans
into the test output, and asserts them.

- `resolve_address` → `Index Scan using address_points_normalized_idx` then
  `Index Scan using parcels_measurable_geom_idx`, `Index Cond: (geom && st_expand(ap.geom,
  '5'::double precision))`. **No `Seq Scan on parcels`. No `geography` anywhere.**
- `proximity` → `Index Scan using parcels_pkey` for the residence, then
  `Index Scan using school_premises_geom_idx` with the expanded search box. **No
  `geography`.** The one `Seq Scan` in the plan is over `school_premises` (619 rows) inside
  the `search_bound` CTE that takes `max(r_b)` over the whole table — an aggregate over
  every row is a full scan by definition and is not on a measurement path.
- Also asserted structurally: **no `geography` column exists in the schema at all**, and
  **every** geometry column is SRID 6549.

#### What Phase 4 (privacy) needs from this

- **Nothing in the query path logs, by construction.** `server/search.ts` writes nothing —
  not the address, not a normalized form, not a parcel id, not a timing. Every `detail`
  string on every result variant is a **fixed constant**; none interpolates user input, and
  the `catch` blocks deliberately do **not** inspect or forward the caught error, because a
  driver message could carry query text (FR-027). Keep it that way when adding the error
  boundary.
- **`search()` takes an optional connection factory** (`search(raw, connect?)`), used only
  by tests to reach the failure variants. No production caller passes it.
- The `test` compose service is where Phase 4's log-capture test can also live; it already
  runs as `somap_app` against the real composition.
- `docker compose exec db psql` currently logs nothing about statements, but that is the
  image default and not yet asserted — Phase 4's box.

#### What Phase 5 (web surface) needs from this

- **`import { search } from "../server/search.ts"`** returns a `SearchResult`. It **never
  throws**: a failure is a variant carrying the manifest, because a thrown error rendered
  as a blank page after typing an address reads like a clean answer.
- **Five variants to render**, and `SEARCH_RESULT_KINDS` is exported for exhaustiveness:
  `premises-within-buffer`, `outside-every-buffer-we-checked`, `declined`,
  `could-not-locate`, `search-failed`. `declined` and `could-not-locate` are **different
  answers** and spec User Story 3 requires them to look different, not merely read
  differently.
- **The manifest is on every variant**, in two availabilities. `read-from-data` carries
  `layers` (with `verifiedAt` — currently `null` on **every** layer, which must render as
  *never human-verified*, not as a blank), `gaps` (31 rows, already written as
  manifest-ready prose), `measurementBases`, `premises` counts, `bufferMeters`,
  `dataFetchedAt`/`oldestLayerFetchedAt` (Principle VII's "cannot hide its age"), and
  `ruleContent`. `could-not-be-read` carries `ruleContent` and a withdrawal `statement`
  only — render it as *nothing was checked*.
- **`ruleContent.statement` must appear on every result.** It is the disclosure that the
  rule is not verified data. It is long; it is not a footnote.
- **A school can appear as several premises rows** (Western Reserve Academy has seven).
  Repeated names in a flag list are ORC 2925.01(S) working as written.
- **Render `corroboration: 'uncorroborated'`.** Those premises were flagged with a 126 m
  uncertainty because their boundary may be a neighbour's — the user is entitled to know
  the flag rests on that.
- `ambiguity` is non-null when one address matched several parcels; it names the count, the
  candidates, and that the answer shown is the most restrictive one.
- **Do not compute anything in the route.** A renderer that derives "no flags ⇒ fine" is
  the failure the type gate exists to prevent; it cannot construct a clearance, but it can
  still write one as a sentence. That is Phase 5's own test (`copy.test.ts`).

#### Still open, and carded nowhere yet

- **Municipality is discarded at normalization.** The place name is stripped, so
  "100 MAIN ST" in two municipalities becomes one ambiguity resolved to the most
  restrictive candidate. That is safe but imprecise, and `address_points.city` is loaded
  and unused. Narrowing candidates by a typed city would improve precision — and must be
  shown not to increase the wrong-match rate before it is adopted (DECISION §4).
- **An out-of-county address is indistinguishable from a misspelt one**: both return
  `could-not-locate`. The gap ledger names `outside_summit_county`, so the manifest covers
  it, but a dedicated variant would be a better answer.

### Phase 4 (TASK-0002.04), 2026-08-04 — implemented by a `claude-opus-5[1m]` session

**Everything ran through `docker compose`.** Suite: `docker compose --profile test run
--rm test` → **107 tests, 25 suites, 0 failures** (was 43 before this phase).

#### The headline: the log-capture test found three real leaks, and none of them was in somap's code

Phase 3's note said the query path writes nothing, and it was right. somap's code was never
the problem. Driving a probe address at the running composition and reading it back out of
`docker logs` found the searched address printed by **dependencies**, from three places:

1. **React Router's default `handleError`** — `console.error(error)` where the error is
   `No route matches URL "/search/8675309%20ZZYZX%20SENTINEL%20PRIVACY%20WAY..."`. Closed by
   ejecting the server entry (`react-router reveal`) into `app/app/entry.server.tsx` with a
   `handleError()` that takes **no arguments**, so there is nothing to print rather than
   something declined.
2. **React Router's default root error boundary** — `console.error`s the same object again
   while server-rendering the 404. Closed by `ErrorBoundary` in `app/app/root.tsx`, which
   deliberately does **not** call `useRouteError()`. That default also emits an inline
   `<script>`, which `script-src 'self'` blocks, so every error page was shipping dead code.
3. **`@mjackson/node-fetch-server`'s `defaultErrorHandler`** — reached through
   `@react-router/node`'s `createRequestListener`, which **does not expose the `onError`
   option** that would replace it. Not closable at its source without dropping
   `@react-router/node` from the request path (an R1 question, not a phase-local one).

Three log sites, in one 7.x minor, in code nobody in this repository wrote. **A fourth
arrives with any dependency bump.** So the process is sealed instead:
`app/server/silence.ts` replaces `process.stdout.write`, `process.stderr.write`, and every
`console` method after the startup line prints. Nothing loaded into the request process can
put a byte on those streams. `docker compose logs app` is now exactly one line, for the
life of the container.

**The trade is real and is stated everywhere it applies:** a fault in the running server is
not diagnosable from its output. That is deliberate and is the same trade Principle III
makes throughout — an error report that *usually* omits the address is a control an outsider
cannot check. `migrate` and `etl` are separate processes with separate entrypoints and are
**not** sealed; they need to report row counts and assertion failures and never see a typed
address. Reproduce request-path faults against fixture addresses.

#### PostgreSQL: the two settings that were not on the checklist

The three the box names were already the image default, which is not a control. The two
that were **not** default are the ones that carried the leak:

- `log_min_error_statement` defaults to `error` — **any** failing statement is logged in
  full. Set to `panic`.
- `log_parameter_max_length` defaults to `-1` — bind parameters logged **in full** wherever
  a statement is logged at all. Set to `0`. (The searched address travels as a bind
  parameter.)

Plus `log_line_prefix=%m [%p]` (no `%h`/`%r`, which would put the client IP on every line
regardless of `log_connections`), and `logging_collector=off` (a collector writes log
*files* into the volume, where the container-stream capture would not look).

They are **command-line flags in `docker-compose.yml`**, not an init script and not
`ALTER SYSTEM`. Verified: `pg_settings.source` reads `command line`, and
`ALTER SYSTEM SET log_statement='all'; SELECT pg_reload_conf();` leaves `SHOW log_statement`
at `none` — a compromised superuser cannot quietly turn statement logging on. An init
script would have been silently absent on an existing volume.

#### The gate bites (proof, not assertion)

Overriding the composition with `command: ["postgres", "-c", "log_statement=all"]` and
re-running the suite: **11 failures**, and `docker compose logs db` contains
`DETAIL:  Parameters: $1 = '1464 Garman Rd, Akron, OH 44313'` in as many words. Override
removed, all green again. The override file was never committed.

The log-capture test also refuses to conclude anything from an empty capture: it asserts
PostgreSQL's startup banner and the app's listen line are *present* before it greps for a
single address, and asserts the search it ran actually resolved and flagged. (Same class of
hazard as the zero-collection test run the orchestrator found.)

#### CSP forced a decision: somap ships no client-side JavaScript

`script-src 'self'` with no `'unsafe-inline'` and no nonce is incompatible with React
Router's hydration bootstrap, which is **three inline `<script>` blocks**. The three ways
out were: soften the operator-signed policy (forbidden), leave the scripts and let the
browser block them (works by accident, unverifiable), or ship no client JS. Took the third:
`<Scripts />` and `<ScrollRestoration />` are gone from `app/app/root.tsx`.

It costs nothing this application wanted — R1 chose RR7 SSR *because* it degrades to working
HTML with JS disabled, and every Phase 5 box requires that. Removing `<Scripts />` also
removed the `modulepreload` links, so the served document is now the HTML plus one
same-origin stylesheet, full stop.

**This binds Phase 5** — see below.

#### Pre-existing defect fixed: the client build was never served

`createRequestListener` bridges RR7 onto Node's http server and does **not** serve
`build/client`. Every `/assets/*` URL had 404'd since Phase 1 (nothing noticed, because
nothing referenced one until this phase added a stylesheet). A 404 stylesheet is a privacy
defect, not a cosmetic one: the next person to find the page unstyled reaches for a CDN,
which is the accidental AC #6 violation the runbook names as most likely. `app/server/static.ts`
serves GET/HEAD from `build/client` only, with resolved-path containment, a fixed
content-type table, no directory listing, and no logging. It is not an adapter — R1 forbids
something in the request path *between* the socket and the router; this is the router's own
process answering for its own assets.

#### Headers beyond the CSP, and why each is not decoration

`Referrer-Policy: no-referrer` (Phase 5 adds sheriff guidance, guidance grows links, and a
link would otherwise tell a county which somap page a reader was on).
`Cache-Control: no-store` (a result page in a browser or proxy cache is a durable record of
where somebody is trying to move — on a shared or library computer especially).
`Permissions-Policy: geolocation=()` (somap asks where you want to live; it must never be
able to ask where you are). Plus `nosniff`, `X-Frame-Options`, and the `Cross-Origin-*`
isolation pair.

#### A control that was implemented and could not be kept

A docker network declared `internal: true` would be the strongest form of FR-024 — no
gateway, no NAT, nowhere to call. **The engine will not publish a port for a container on an
internal network**: it accepts the binding and binds nothing (`HostConfig.PortBindings`
populated, `NetworkSettings.Ports` empty, host connection refused — reproduced). `app` cannot
be both isolated that way and reachable by a browser, so it was reverted. The reasoning sits
in `docker-compose.yml` beside the `app` service and in `docs/privacy/verification.md` §6,
where somebody wondering why the obvious control is missing will find it. A self-hoster
behind their own reverse proxy *can* have it, and §6 says so.

FR-024 stands on three checkable things instead: no module in the request path names a
network client API (asserted file by file), the production dependency set is pinned to six
packages and asserted, and `connect-src 'self'` plus no client JS closes the client half.

#### What Phase 5 must know

- **You may not add a component that requires hydration.** There is no client runtime.
  Forms are plain `<Form method="post">` (a real `<form>`, submitted natively); progressive
  disclosure is `<details>`/`<summary>` and CSS. Anything genuinely needing script is an
  **operator checkpoint** — a CSP amendment, not a component choice. This is stated at
  length at the top of `app/app/root.tsx`.
- **Submit the address by POST, never GET.** A GET puts it in the URL, and a URL reaches
  browser history, the `Referer` header, and any future proxy's access log — none of which
  somap's controls reach. The form-action model does this naturally; do not "improve" it
  into a query string.
- **`app/app/root.tsx` has a placeholder `ErrorBoundary`.** It is the minimum that is safe,
  not finished copy: Phase 5 owns the words and must add the sheriff-confirmation guidance
  every result carries. Do **not** make it render anything from the error — it carries the
  request that produced it.
- **Tailwind must not introduce an off-origin asset.** Its font stack stays a system stack
  or becomes genuinely self-hosted files served from `build/client`. The build-output scan
  fails `docker compose build` otherwise, before an image exists.
- **`app/tests/http-headers.test.ts` will fail if a route emits an inline `<script>` or an
  off-origin `src`/`href`.** That is intended. It also asserts the linked stylesheet is
  actually served, which is how the 404-asset defect above was found.
- **The `test` service now depends on `app: service_healthy`** and mounts
  `/var/run/docker.sock:ro` (test profile only — `docker compose up` never starts it).
  Container output only exists outside the container, so a suite that cannot reach the
  engine could only re-assert that somap does not log, which is the claim rather than the
  evidence. `captureLogs()` excludes exactly one stream — the `test` service's own
  containers, which print the probe address by name in every assertion message.
- The suite is **107 tests**. If a run reports fewer, something was not collected.

#### Still open, and carded nowhere yet

- **`react-router/dist/development/*` is what loads in the runtime image**, despite
  `NODE_ENV=production` in `docker/app/Dockerfile`. Visible in stack traces captured while
  debugging the leaks. Not a privacy defect (the seal covers it either way) but it is the
  slower, chattier build in production, and worth a card.
- **The `Date` response header is still served.** Harmless, but it is the one piece of
  per-response server state that is not suppressed, and a completeness-minded reviewer will
  ask.

### Phase 5 (no subtask), 2026-08-04 — implemented by a `claude-opus-5[1m]` session

**Everything ran through `docker compose`.** Suite: `docker compose --profile test run
--rm test` → **146 tests, 33 suites, 0 failures** (was 107 before this phase).

#### The copy is the artifact, so here is where each rule lives as a gate

`app/app/result-view.tsx` is the deliverable of this phase and its header states the four
rules it is written under. Each has a gate in `app/tests/copy.test.ts`, which reads the
**raw response body** of **ten** served shapes — the form, two flagged results, the
unflagged result, a decline, two could-not-locates, the 404 error boundary, a GET to
`/answer` with nothing submitted, and `search-failed`.

- **Never state or imply permission.** Two lists. `HARD_DENY` runs against the untouched
  body and no allowlist can excuse it (`you can/may live`, `ok to live`, `good to go`,
  `in the clear`, `green light`, `no restrictions`, `approved`, `cleared`). `FORBIDDEN` is
  spec SC-005's vocabulary as word-boundary stems, so `approval`, `clearance`, and
  `permitted` are caught by their roots.
- **The one allowlisted phrase is a negation**, and it is `"never as a legal conclusion"` —
  the last clause of somap's own unverified-rule disclosure, read from the coverage-gap
  ledger. A blanket ban on `legal` would have deleted the disclosure rather than the claim.
  It carries a written reason, and a test asserts the phrase still occurs, so a dead
  exemption cannot sit there quietly widening the gate. It is the **only** entry, and it is
  the only forbidden word that appears anywhere in any served body (measured, twice per
  result page, both from the same ledger row).
- **An absence of flags is not good news.** `"no results found"` and `"no results for"` are
  forbidden outright. The unflagged answer is headed *"Outside every buffer we checked."*
  and a test asserts the qualification (*"smaller than it sounds"*) appears **within 400
  bytes of the headline** — a reader who stops after the first line must not stop on good
  news.
- **A refusal and a result differ by more than wording** (User Story 3 scenario 4). Asserted
  three ways: every shape carries a distinct label above its headline and the set is proved
  mutually exclusive; the refusals render `answer--stopped` / `answer--broken`, whose CSS is
  a **dashed** border rather than a colour change, so the difference survives for a reader
  who cannot distinguish the accents; and **structurally**, no refusal renders *"The parcel
  somap measured from"*, *"Distance somap measured"*, or a premises list — with the converse
  asserted too, so the check is not vacuous. `declined` and `could-not-locate` are separated
  on what somap knows: *"somap knows where this is"* vs *"somap does not know where this
  address is"*, under different section headings.
- **The sheriff step is the recommended action.** It says what to ask, what to take with
  you, and that if that office disagrees **it is right and somap is wrong**. Asserted on all
  ten shapes on two independent tokens.

#### What every result carries, and the shape of the manifest on the page

Headline absences are **always visible** — never behind a `<details>` — and are read from
the gap ledger by `subject_type`, not written down in the renderer. The long enumerations
below them are collapsed and collapsed only: all 31 gap rows, all 7 layers with their dates,
and the measurement-basis table are in the served document either way, which is what
`copy.test.ts` asserts.

- **`verifiedAt` renders as `never human-verified`**, and the test counts it: exactly **7**
  occurrences, one per layer. Not a blank cell, not a dash, and never a fetch date wearing a
  verification's name.
- **Data age is a visible sentence**, not a footer: *"This somap instance last fetched data
  on 4 August 2026, and its oldest layer was fetched on…"* (Principle VII — an instance
  cannot hide its age).
- **`ruleContent.statement` is rendered in full on every result**, in its own section headed
  *"No person has checked the rule somap applied"*, followed by a plain-English restatement.
  Asserted on all five search-result shapes, including the withdrawn manifest, whose own
  statement also carries *"not verified rule data"*.
- **The buffer is never a literal in the renderer.** `bufferMeters` comes from the result and
  feet are computed from it, so the two units cannot disagree and `304.8` stays defined once
  (`sql/schema/013`), which `no-fallback.test.ts` still asserts.

#### Two routes, and why

`/` is the form and reads **no database**, so it loads when the database is down.
`/answer` answers **POST only**. The address travels in the request body: a GET would put it
in the URL, and a URL reaches browser history, the address bar, the `Referer` header, and
any future proxy's access log — none of which somap's controls reach. `copy.test.ts` asserts
no served `href`, `action`, `src`, `content`, or `<title>` on any result carries a searched
address.

Keeping the action off `/` also keeps `POST /` a 405, which is one of the responses
`http-headers.test.ts` asserts still carries the full envelope. `no-logging.test.ts` was
extended to drive its canary through the **real** submit path, which did not exist when that
test was written.

There is deliberately **no `loader`** on `/answer`: a loader re-runs after the action on a
document POST, and one that redirected home would have thrown the answer away. A plain GET
therefore renders an honest *"nothing was submitted"* page rather than an empty result shape.

#### `search-failed` is rendered by a real server, not by a component in a test

Node 22's built-in type stripping does not handle JSX, so no `.tsx` can be imported by
`node --test` — component-level rendering is not available to this suite at all, and that is
a constraint worth knowing before someone tries. `search-failed` also cannot be provoked
against a healthy composition, and the suite must not be able to take the composition down
to try (`tests/docker.ts` is read-only by design).

So `copy.test.ts` starts a **second somap server inside the test container**
(`server/entry.ts`, `PGPORT` pointed at a closed port), and reads the document it serves.
Same code, same renderer, same wire as every other shape.

It was also seen for real: on the clean-clone run below, a search against a **never-loaded**
database returned `search-failed`, because `server/manifest.ts`'s rule-disclosure gate fires
before anything else — *"This instance's coverage-gap ledger is missing the row disclosing
that its distance rule is not verified data. somap will not serve a result that could be
read as a verified legal conclusion, so it serves none."* That precedence is correct and
worth recording: an empty database fails **loudly** rather than producing a confident-looking
empty answer.

#### The zero-collection run now fails (the orchestrator's P3 finding)

`app/scripts/run-tests.mjs` replaces `node --test tests/*.test.ts` as `npm test`. It refuses
to report a pass when the tests directory is absent, when fewer test files are present than
the suite has (`MINIMUM_TEST_FILES`), when `node --test` reports fewer tests than it should
(`MINIMUM_TESTS`), or when no summary is printed at all. Proved:

```
$ docker compose run --rm app npm test
somap: REFUSING TO REPORT A PASS.
  There is no tests directory at /app/tests, so nothing could be collected.
  A run that collects nothing is not a run that passed.
  The only sanctioned way to run somap's test suite is:
      docker compose --profile test run --rm test
EXIT=1
```

`scripts/` is copied into the **runtime** image for this reason alone — so the wrong
invocation produces a legible sentence rather than `MODULE_NOT_FOUND`. Both floors are
bumped deliberately; lowering one is a diff somebody reviews. The `test` profile is
documented as the only sanctioned path in `README.md` and `docs/privacy/verification.md`.

#### Deviations and decisions

1. **Tailwind is wired; shadcn is not, and could not be.** Tailwind `4.3.3` +
   `@tailwindcss/vite` `4.3.3`, pinned exactly, dev dependencies only, resolved entirely at
   build time — no runtime, no script, no font request. `@theme` overrides Tailwind's own
   default families with the system stack so no utility class can reintroduce a webfont.
   **Radix/shadcn interactive primitives were not used**, because Phase 4's zero-JS decision
   forecloses them and this phase's own box says so; progressive disclosure is
   `<details>`/`<summary>`.
2. **One entry added to the build-output scan's allowlist**, and it is the only external URL
   Tailwind introduces: `https://tailwindcss.com`, in the MIT licence banner Tailwind emits
   as the first line of the built stylesheet — inside a CSS comment, which no engine ever
   dereferences, and which the licence requires be carried with the output. The gate bit
   first (`docker compose build` failed), which is how it was found. The allowlist's doc
   comment now names this as a **third** admissible category (licence attribution inside a
   comment) rather than smuggling it under "documentation links", and it explicitly does not
   extend to a URL outside a comment. `NEVER` is untouched and still applies.
3. **No inline `style` attributes anywhere.** `style-src 'self'` with no `'unsafe-inline'`
   blocks a style *attribute*, not only a `<style>` element — so spacing that would naturally
   be a one-off inline style is a Tailwind utility from the external sheet instead.
4. **`server/db.ts` now finds `sql/query/` by walking up** rather than by a fixed
   `../sql/query` from `import.meta.url`. This phase's route imports `server/search.ts`, so
   Vite's SSR build bundles that module into `build/server/index.js`, two directories deeper,
   where the old path does not exist — the process would have died at startup. It is not a
   fallback to a different directory: it finds the one `sql/query` in the image or throws.

#### Verification actually run (commands and results)

**Clean clone, `linux/arm64` (this host).** Cloned `origin/task-0002-walking-skeleton` at
`abf529d` into an empty directory with nothing else in it, and ran the sequence exactly as
`README.md` records it:

```
docker compose up --build -d      # db healthy, migrate exit 0, app healthy
docker compose run --rm etl       # full fetch of all five services, then load
docker compose ps
curl -sS -X POST http://127.0.0.1:3000/answer \
  --data-urlencode 'address=1464 Garman Rd, Akron, OH 44313'
```

Row counts identical to Phase 2's, from a fetch performed fresh: `municipalities 31` ·
`parcels 261,154` (1,128 mineral-rights excluded) · `address_points 258,862` ·
`school_premises 619` (0 without geometry) · `coverage_gaps 31`. The curl returned
*"3 school premises are within 304.8 m (1,000 feet) of this address"*, naming Firestone,
Litchfield and Case Community Learning Centers with their measured distances.
`docker compose --profile test run --rm test` inside that clean clone: **146 / 146**.

**Mid-ingest, the same clone answered a search against a never-loaded database** — see
above. `search-failed`, loudly, with every coverage claim withdrawn.

**`linux/amd64`.** `docker buildx build --platform linux/amd64,linux/arm64` succeeds for
both `docker/app` (context `./app`) and `docker/db`. The **flow** was then run on amd64, not
just built: the same clone brought up under `DOCKER_DEFAULT_PLATFORM=linux/amd64` as a
separate compose project, `node -e "process.arch"` inside the built image reporting `x64`,
the same POST returning the same three premises, and the full suite **146 / 146** on amd64.
The ingest there was `--skip-fetch` against a copy of the NDJSON the arm64 run had already
fetched — the county was downloaded once, and the second architecture loaded and served the
same bytes. Both verification projects were torn down with `down -v` afterwards.

#### What is still open

- **An `<a href>` to somap's own repository or issue tracker is deliberately absent.**
  Reporting a wrong answer needs TASK-0009 (a report that carries no query context) first;
  the page says so in as many words rather than linking somewhere that would.
- **`Referrer-Policy: no-referrer` is doing real work now** that the sheriff section exists:
  the moment anyone adds a link to a county website, that county would otherwise be told
  which somap page the reader was on.
- **The 400-byte proximity assertion on the outside-every-buffer qualification is a proxy
  for "above the fold"**, which nothing in HTML can actually assert. If the banner is ever
  restructured, that number needs re-deriving rather than raising.
