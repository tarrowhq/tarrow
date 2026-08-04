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

- [ ] Add `docker/app/Dockerfile` on pinned `node:22-bookworm-slim`, multi-stage so build
      dependencies are discarded from the runtime image
- [ ] Restructure `docker-compose.yml`: production composition is `db` + `app`; move the
      existing `tools` service behind a `spike` profile, leaving `docker/tools/` and
      `docker/tools/requirements.txt` **byte-identical**
- [ ] Scaffold `app/` — `package.json` with a committed lockfile, `react-router.config.ts`
      in SSR mode, `vite.config.ts`, and the RR7 server entry that owns HTTP (no Fastify,
      no adapter)
- [ ] Add `app/sql/schema/` migrations applied in filename order, and the runner that
      applies them: layer registry with per-layer freshness, address points, parcels,
      school premises, coverage gaps
- [ ] Add `app/sql/schema/010_grants.sql`: a distinct application role with `SELECT` only
      on derived tables, and an explicit `REVOKE` of `INSERT`/`UPDATE`/`DELETE`/`TRUNCATE`
- [ ] Add the SQL-file loader in `app/server/db.ts` — queries are read from
      `app/sql/query/*.sql` at startup, never inlined as template literals
- [ ] Add the truncate-and-full-reload primitive the ETL will use; no incremental sync,
      no upsert path, no reconciliation logic anywhere in the codebase
- [ ] Verify `docker compose up --build -d` reaches a healthy `db` and a serving `app`,
      and that migrations apply from an empty volume
- [ ] Verify the application role **cannot** write: connect as it and assert an `INSERT`
      into a derived table is rejected
- [ ] Verify both architectures build (`docker buildx build --platform
      linux/amd64,linux/arm64` for `docker/app` and `docker/db`)
- [ ] Verify `spikes/task-0001-geocoding` still runs under the `spike` profile — the
      README's command sequence, unmodified

---

## Phase 2: Summit County school premises ingest

**Subtask**: TASK-0002.02 · **Model**: `claude-opus-5` (`x:safety` — a missing school is
an under-restriction defect, which Principle I classifies as unacceptable)

**Goal**: The data the answer is made of, with every known gap recorded as data rather
than discovered by a user.

- [ ] Port the ArcGIS paging fetcher to TypeScript (`app/etl/fetch.ts`), preserving the
      spike's retry behaviour and its handling of ArcGIS signalling failure in a 200 body
- [ ] Ingest Summit County **Address Points** with geometry and provenance — required by
      DECISION §6, not optional for this slice
- [ ] Ingest Summit County **tax parcels** with geometry and provenance
- [ ] Assert `ADDR_ID` uniqueness at load and **fail loudly** rather than silently
      collapsing rows (30,426 duplicates and 26,660 empty values exist in the source)
- [ ] Exclude mineral-rights parcels (`usecd` 200-series) from measurement geometry
- [ ] Derive each parcel's municipality by spatial join to municipal boundaries —
      `siteaddress` is not unique county-wide
- [ ] Enumerate and ingest **school premises** covering public, nonpublic, and chartered
      nonpublic schools, with geometry and provenance. Record in this file's Notes which
      sources were used and what each one covers
- [ ] Attach real parcel geometry to every school premises. A school resolvable only to a
      point is written to the **coverage-gap ledger** and is never given an assumed radius
- [ ] Record every known source gap as data in the coverage-gap ledger, in the shape the
      manifest will render
- [ ] Stamp per-layer fetch dates into the layer registry so freshness is queryable
- [ ] Verify: full reload from empty runs end to end in the composition, row counts are
      reported, and the uniqueness assertion actually fails on injected duplicate input
- [ ] Verify: no school premises row has null geometry unless a matching coverage-gap row
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
