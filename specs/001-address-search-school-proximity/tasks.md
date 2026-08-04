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

- [ ] Port address normalization from `spikes/task-0001-geocoding/sql/02_normalize.sql`
      into `app/sql/query/resolve_address.sql` — the rule-based normalization that reached
      96.8% on its own; libpostal is not adopted
- [ ] Resolve typed address → Address Points match → that point's parcel. Never match
      typed addresses against `parcel.siteaddress`
- [ ] Implement `app/sql/query/proximity.sql`: nearest boundary of the residence parcel to
      nearest boundary of the premises parcel, in EPSG:6549, buffer 304.8 m
- [ ] Confirm by `EXPLAIN` that the spatial index is used and that no geography cast
      appears in the plan
- [ ] Carry an uncertainty radius on every geometry and compare on the pessimistic bound
      `d_min = d(a,b) − r_a − r_b`, flagging when `d_min < buffer`
- [ ] Decline when the resolved address point has no parcel within 5 m
- [ ] Declare ambiguity when one normalized address maps to several parcels, resolving to
      the most restrictive candidate rather than silently selecting one
- [ ] Ensure there is **no code path** that returns a coarse fallback — no ZIP centroid,
      no street centroid, no fuzzy match, no nearby-parcel consolation
- [ ] Define the result type as a discriminated union in which **no inhabitant means
      approved, legal, permitted, or clear**, and in which the coverage manifest is a
      mandatory field on every variant including declines
- [ ] Build the manifest from data: layers queried, layers absent, per-layer verification
      and refresh dates, the coverage-gap ledger, which delivery path answered, and the
      per-geometry measurement basis
- [ ] State in the manifest that rule content is **not yet verified data** — the 304.8 m
      buffer is applied without the file-authored rule record Principle V requires, which
      TASK-0003 builds
- [ ] Test: a known address near a known school flags, with the measured distance
- [ ] Test: a known address far from every school returns outside-every-buffer
- [ ] Test: an address point with no parcel declines
- [ ] Test: an unmatched address returns could-not-locate, distinct from both of the above
- [ ] Test: the manifest is non-empty and complete on **every** result variant
- [ ] Test: attempting to construct a result meaning "clear" fails to type-check —
      recorded as a compile-failure fixture, not merely asserted in prose

---

## Phase 4: No-log privacy architecture, CSP, and verification

**Subtask**: TASK-0002.04 · **Model**: `claude-opus-5` (`x:privacy` — Principle III is
non-negotiable and this phase is its whole enforcement surface)

**Goal**: Make Principle III true and checkable across the whole request path, including
the layers people forget.

- [ ] Disable request logging in the RR7 node server explicitly, as a single greppable
      line rather than an emergent default
- [ ] Configure PostgreSQL to log neither statements nor connections
      (`log_statement=none`, `log_connections=off`, `log_disconnections=off`), so the
      searched address cannot reach the database log
- [ ] Ensure error handling carries **no query context** into logs or error output — an
      error may say what failed, never what was searched
- [ ] Set the CSP on every response: `default-src 'self'; script-src 'self'; style-src
      'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action
      'self'; frame-ancestors 'none'`
- [ ] Self-host fonts or use a system font stack. No Google Fonts, no CDN, nothing that
      resolves off-origin
- [ ] Add the build-output scan that fails the build on any external origin in built
      assets — the second layer behind CSP, not a replacement for it
- [ ] Confirm the query path makes no outbound network call, structurally
- [ ] Test: run a full end-to-end search in the composition, capture **every** log stream
      (app, HTTP server, PostgreSQL, container stdout/stderr), and assert neither the
      searched address nor the client IP appears in any of them
- [ ] Test: assert the CSP header is present on every response, including error responses
- [ ] Write `docs/privacy/verification.md` — how a competent outsider checks these claims
      from network traffic and the composition alone, with the exact steps and what they
      should see

---

## Phase 5: Web surface and end to end

**Covers**: parent ACs #1, #4, #7, #8 (no subtask — this work moves with its parent) ·
**Model**: `claude-opus-5` (the task's own framing: the hardest part is not the map, it is
the language)

**Goal**: The interface, and proof the whole slice works from a clean clone.

- [ ] Build the address form as a plain RR7 route with a form action — working HTML,
      functional with JavaScript disabled
- [ ] Build the result view rendering: flagged premises with distances and measurement
      basis, or the outside-every-buffer statement — never approved, legal, permitted, or
      clear
- [ ] Render could-not-locate and decline as **visually and textually distinct** from a
      located address with no nearby facilities, distinguishable by more than wording
- [ ] Render the coverage manifest in the **server-rendered document** on every result.
      It may be visually collapsed with `<details>` or CSS, but must not require
      JavaScript to reveal. Radix/shadcn interactive primitives are not permitted for this
- [ ] Render sheriff-confirmation guidance on every result, including declines and errors
- [ ] Surface the data build date and per-layer verification dates, so a stale self-hosted
      instance cannot hide its age
- [ ] Wire Tailwind and any vendored shadcn source with no off-origin asset
- [ ] Test over **raw response bodies**: no permission vocabulary appears in any rendered
      result (approved, legal, permitted, clear, allowed, OK to live, and the phrasings a
      reader would take as those)
- [ ] Test over **raw response bodies**: the manifest strings and the sheriff guidance are
      present on every result shape, with JavaScript never executed
- [ ] Verify the whole flow from a clean clone: `docker compose up --build`, run the
      documented ingest, submit an address, read the answer — and record the exact command
      sequence in the repository README
- [ ] Verify the flow on both `linux/amd64` and `linux/arm64`
- [ ] Tick TASK-0002's eight acceptance criteria on the board, each against a real
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
