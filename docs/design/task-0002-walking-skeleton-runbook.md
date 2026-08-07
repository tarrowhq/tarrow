# TASK-0002 walking skeleton — sweep runbook (2026-08-04)

**You (the session reading this) are the ORCHESTRATOR** for the task below. Run it through
the host project's full PDLC — spec → link → worktree → delegated implementation → PR →
merge → re-ground. Direction is decided; do not re-litigate it: the **constitution**
(`.specify/memory/constitution.md`, v1.2.0), the **TASK-0001 decision**
(`spikes/task-0001-geocoding/DECISION.md`), and the **operator rulings recorded in §Stack
rulings below** win. Plan-of-record is the board; this file carries only ordering,
doctrine, and the log.

**Status:** done · operator sign-off on lanes: 2026-08-04 (PR #5) · sweep closed 2026-08-04
<!-- Only the OPERATOR flips draft → signed-off (the author never pre-fills it). An
     executing session must refuse a runbook whose status it cannot verify. -->

This sweep is **one task, therefore one lane and one PR**. The parallelism that a
multi-task sweep gets from lanes, this one gets from nothing — TASK-0002 is a vertical
slice whose parts are strictly dependency-ordered. The unit of dispatch is therefore the
**spec phase**, not the lane, and the ordering work in this runbook is phase ordering.

---

## Read first (in this order)

1. `.specify/memory/constitution.md` — v1.2.0. Principles I, II, III are non-negotiable
   and all three bind this task directly.
2. `spikes/task-0001-geocoding/DECISION.md` — the geocoding and distance stack. §2, §3,
   and §6 are load-bearing for P2 and P3 and are not open for re-derivation.
   `RESULTS.md` is its evidence; do not break its reproducibility (see P1).
3. **§Stack rulings** in this file — the four operator decisions taken 2026-08-04 that
   the artifacts did not answer.
4. `backlog task list --plain` — live state; other sessions move it while you work.
5. `backlog task view TASK-0002 --plain` and its four subtasks.

## State when this runbook was written (2026-08-04)

- **Done already:** TASK-0001 (geocoding/distance spike, PR #4 merged). Constitution
  ratified at v1.2.0 (PRs #2, #3). Root-guard hook hardened (PR #1).
- **In flight in other sessions (do not duplicate; expect their merges):** none.
  `git worktree list` shows only the root checkout at sweep start.
- **Paused — untouched** (`paused` label in the task's frontmatter `labels:`; excluded
  from lane conflict analysis; never claim, rebase, or clean their branches/worktrees):
  **none.**
- **Queued (this runbook's scope):** TASK-0002 only. Its four subtasks (TASK-0002.01
  through .04) are internal breakdown and ride the parent's single branch — per the
  constitution's Subtasks rule, **a subtask never gets a PR of its own.**
- **Repository facts that shaped this plan:** no `docs/` directory existed (no grounding
  wiki, therefore no freshness gate in this sweep); no `scripts/` directory (no
  merge-drift gate — see §Per-PR gates); no `.claude/agents/` (the tier pins CLAUDE.md
  names did not exist — planted by this runbook's PR, see §Lane 0); no `specs/`
  (spec number `001` is free).

## Stack rulings (operator, 2026-08-04)

These four questions were not answered by the constitution, the board, or the TASK-0001
decision. They were put to the operator and are now closed. **Do not reopen them inside a
phase; reopening one is a runbook amendment plus an operator ping.**

### R1 — React Router 7 (SSR) owns the HTTP server

The query surface is **React Router 7 in server-side-render mode**, on its own Node
server. **No Fastify, no adapter in the request path.** Rationale: RR7's form-action model
degrades to working HTML with JavaScript disabled, which for this user population is a
safety property and not an ergonomic one; and an adapter bridging RR7 to another HTTP
server is the piece most likely to rot under Principle VII, sitting in the safety-critical
request path. Dependencies in the request path: `react-router`, `pg`.

### R2 — TypeScript ETL; the spike's Python container is frozen

Production ingest is TypeScript, shipped in the same `docker/app` image as the query
surface. `docker/tools` (Python 3.12 + psycopg) stays **byte-identical**, moved behind a
compose profile, for one reason only: `spikes/task-0001-geocoding/README.md` must keep
reproducing the numbers in `RESULTS.md`, which are the standing evidence for the 96.79%
match rate. The production composition is one runtime; the evidence base stays intact.

```
docker/
  db/     postgres:17-bookworm + PostGIS   unchanged
  tools/  python:3.12-slim   [profile: spike]   FROZEN
  app/    node:22-bookworm-slim   (new)
            ├ multi-stage: build deps discarded, runtime image lean
            ├ RR7 SSR + pg; spatial SQL in .sql files
            └ etl/ ingest entrypoints
prod compose:  db + app
spike compose: db + tools   (profile: spike)
```

### R3 — "Deployed and working end to end" (AC #8) means the container composition

`docker compose up --build` from a clean clone stands up db + app and serves address →
school proximity → coverage manifest, end to end. **No public internet deployment in this
task.** Principle VII already makes the packaged artifact the deliverable ("packaging is a
deliverable, not documentation"); milestone m-0 states this release is not promoted to
real users; and publishing in R1 would create exactly the edge-logging surface
TASK-0002.04 must forbid, with no provider chosen and no logging posture reviewed. A
public deployment is carded separately, later.

### R4 — No ORM; spatial SQL is authored as files

Raw parameterized SQL over `pg`. **No ORM, no query builder over the spatial path.**
DECISION §2 makes EPSG:6549 and the avoidance of geography casts load-bearing, and an ORM
abstraction is precisely where a geography cast reappears unnoticed. Spatial queries live
in `.sql` files loaded at startup rather than inline template literals, so the
safety-critical query is reviewed as a file diff — the same posture Principle IV takes
toward rule content.

## Lane 0 — precondition work (this runbook's own PR)

Landed by the PR that lands this file, before any phase dispatches:

- `docs/design/task-0002-walking-skeleton-runbook.md` — this file.
- `.claude/agents/default-implementer.md` — `model: claude-opus-5`.
- `.claude/agents/mechanical-implementer.md` — `model: claude-sonnet-5`.

The two agent definitions are the mechanism CLAUDE.md's `## Model tiers` section names as
**authoritative at dispatch**; the directory did not exist, so an unpinned dispatch would
have silently inherited the orchestrator's session model. Planting them is what makes the
tier column below mechanically true rather than aspirational.

## Execution lanes

**Lane 1 — the only lane:**

- **TASK-0002 — Address search returns school proximity with a coverage manifest.**
  Spec `specs/001-address-search-school-proximity/`. Branch `task-0002-walking-skeleton`,
  worktree `.worktrees/task-0002`. One PR.

Parallelism lives at the phase level and is **zero**: P1 → P2 → P3 → P4 → P5 is a hard
dependency chain (schema before ingest, ingest before query, query before its privacy
envelope and its rendering). Phases dispatch **serially**, one fresh implementer each.

### Phases, tiers, and models

One fresh implementer agent per phase, re-grounded from the spec artifacts plus the
branch's commits. Nothing is handed between phases via chat context: if the next phase
needs it, it lives in a ticked box, a committed slice, or a note in the spec dir.

| Phase | Scope (subtask) | Tier | Model ID | Fallback | Rubric justification |
|---|---|---|---|---|---|
| **P1** | PostGIS baseline + deploy pipeline (TASK-0002.01) | mechanical | `claude-sonnet-5` | `claude-opus-4-8` | Work to the container pattern this repo already established in `docker/db` and `docker-compose.yml`. Its constraints (full truncate-and-reload, no runtime writes to derived tables, pinned multi-arch images) are **stated** by Principle IV and R2, not discovered. No safety surface of its own. |
| **P2** | Summit County school premises ingest (TASK-0002.02) | default | `claude-opus-5` | `claude-opus-4-8` | `x:safety`. A missing school is an under-restriction defect, which Principle I classifies as unacceptable rather than recoverable. Requires judgment about source enumeration (public / nonpublic / chartered nonpublic) and about what becomes a declared coverage gap rather than an estimate. |
| **P3** | Proximity query + coverage manifest (TASK-0002.03) | default | `claude-opus-5` | `claude-opus-4-8` | `x:safety`. This phase *is* Principle I expressed as arithmetic — uncertainty bounds, decline paths, and a result type in which clearance is structurally inexpressible. A sign error here is the unrecoverable failure mode. |
| **P4** | No-log privacy architecture, CSP, verification (TASK-0002.04) | default | `claude-opus-5` | `claude-opus-4-8` | `x:privacy`. Principle III is non-negotiable and this phase is its whole enforcement surface, across layers people forget (Postgres statement logging, error reporting, fonts, CSP). |
| **P5** | Web surface and end-to-end (parent ACs #1, #4, #7, #8) | default | `claude-opus-5` | `claude-opus-4-8` | The task's own description: *"the hardest part is not the map, it is the language."* Result copy that must never state or imply permission, and a could-not-locate that must read as distinct from a clean result. Judgment-dense. |

**Record tier + model ID + which model actually served on the board task at dispatch**
(`backlog task edit TASK-0002 --append-notes ...`), not only in this file. Escalating a
tier is an operator checkpoint.

**Why P5 exists.** TASK-0002.01–.04 do not cover the parent card. Parent ACs #1 (a user
can enter an address), #4 (could-not-locate distinguishable), #7 (sheriff guidance on
every result), and #8 (deployed end to end) have no subtask. P5 is that work. It gets no
subtask record — per the constitution's Subtasks rule, records are for work that must move
on the board, and this work moves with its parent.

## Per-PR gates this project enforces (enumerated — implementers cannot miss these)

- **Merge-drift gate: ABSENT.** No `scripts/check-merge-drift.mjs` in this repo (no
  `scripts/` directory at all). The raw git commands stand: `git fetch origin &&
  git pull --ff-only` at root before starting work and before merging; confirm the branch
  sits on current `origin/main` before merge.
- **Root-guard hook (`.claude/hooks/root-guard-hook.mjs`) is live and has no bypass.** It
  is a PreToolUse hook, so it fires on every Bash and every Write/Edit:
  - **No writes to tracked paths in the root checkout.** All authoring happens in
    `.worktrees/<name>`. (This is why even this runbook lands by PR.)
  - **Rebases are forbidden repo-wide.** Freshen a branch by merging `origin/main` **into**
    it. This overrides the sweep skill's default "pin-free branch rebases" rule.
  - **No force-push, anywhere.**
  - **No squash merge.** PRs land with `gh pr merge --merge`.
  - Root commits are permitted **only** when scoped entirely to `backlog/` (the board-sync
    exception) or when concluding a merge. Board bookkeeping therefore lands direct on
    `main` at root; everything else lands by PR.
- **Container-only verification (Principle VII).** Every check, migration, ingest, and
  test runs through `docker compose`. Nothing is installed on a host. A phase that
  verifies itself by running a tool on the host has not verified itself.
  - Images **pinned**, never floating. Images **multi-arch** — verify `linux/arm64` and
    `linux/amd64`, since the base images chosen must not silently exclude ARM
    self-hosters (the reason `docker/db` is built rather than pulled).
  - `docker/tools` must remain byte-identical (R2) and the spike must still reproduce.
- **Principle IV enforcement is a grant, not a convention.** The application's database
  role must have **no write privilege** on derived tables. A code review asserting "the
  app never writes here" is not this gate; `REVOKE` is.
- **Full rebuild only.** Derived tables are truncated and reloaded in full. No incremental
  sync, no reconciliation logic, no upsert path.
- **CSP is the AC #6 enforcement mechanism**, with a build-output scan as the second
  layer. Every response carries at least:
  `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:;
  connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`.
  Fonts self-hosted or a system stack — a font pulled from a third-party origin is the
  single most likely accidental violation of AC #6.

  > **AMENDED 2026-08-07 (TASK-0008.01).** `script-src` is now
  > `script-src 'self' 'nonce-<per-response>'`. Every other directive above is unchanged and
  > still binding.
  >
  > This clause is what made hydration impossible and left the application shipping no client
  > JavaScript — a state this runbook itself records, at the 2026-08-04 checkpoint below, as
  > having been required by no principle. AC #6 governs third-party *origins*; first-party
  > script was never in question. `'unsafe-inline'` remains forbidden, and a nonce beside it
  > would be worthless, so two tests hold that line.
  >
  > Reasoning and consequences: `docs/decisions/task-0008-01-nonce.md`.
- **The manifest may never be gated behind hydration.** The coverage manifest (AC #2), the
  "outside every buffer we checked" phrasing, and the sheriff-confirmation guidance
  (AC #7) must be present in the **server-rendered document**. Progressive disclosure may
  collapse them visually (`<details>`, CSS) but may never require JavaScript to reveal
  them. Radix/shadcn interactive primitives render an empty shell without JS; using one
  for the limitations disclosure would produce exactly the Principle II failure the
  constitution exists to prevent, arriving through a UI component rather than a data gap.
  **Verified by a test that fetches result HTML and asserts the manifest strings are in
  the response body** — the same fixture that satisfies AC #3.
- **Board hygiene.** Backlog markdown is never hand-edited; all board state moves through
  the `backlog` CLI. Stage specific task files, never `backlog/` wholesale. Run
  board/spec commands from the root checkout, never inside a worktree.
- **Re-ground obligations:** none for this sweep. There is no `docs/wiki/` corpus and
  therefore no freshness gate to satisfy. Building one is out of scope here and is a
  natural follow-on (`/grounding-wiki:wiki-build`) once this slice lands.

## Per-task artifacts required before PR

Per-TASK obligations — the per-PR gates above are project machinery; this section is what
TASK-0002 must have produced. **No PR opens until each line below checks true.**

- [ ] `specs/001-address-search-school-proximity/` carries a real `spec.md` (problem +
      requirements mapped to the card's eight ACs), `plan.md` (checked against the
      **ratified** constitution v1.2.0 — it is real, not a template, so plan against it
      directly), and `tasks.md` (the five phases above as phased checkboxes the bridge
      derives from), committed on `task-0002-walking-skeleton`. A claim stub reserves the
      number; it satisfies nothing here.
- [ ] The card carries its Spec marker from the claim commit (`spec-bridge:link` against
      the stub), and phase ACs are seeded from `tasks.md` (link update mode) **before**
      implementation dispatch.
- **Escape lines (operator-signed only):** none. No spec artifact is excused.
- **Host additions:**
  - [ ] **Lane 0 landed first.** `.claude/agents/default-implementer.md` and
        `.claude/agents/mechanical-implementer.md` exist on `main` before any phase
        dispatches. Without them the tier column above is decorative.
  - [ ] **The four stack rulings (R1–R4) are restated in `plan.md`** as binding
        constraints, not referenced by link. An implementer reads the spec dir, not this
        runbook.
  - [ ] **`spikes/task-0001-geocoding` still reproduces.** `docker/tools` byte-identical;
        the README's command sequence still runs under the `spike` profile.
  - [ ] **A phase that changes what a *later* phase must do records it in the spec dir or
        on the board card**, never only in its own transcript. The phase handoff artifact
        set is: the spec dir, `tasks.md` tick-state, and the branch's commits.

<!-- Lane-0/precondition rulings that change the per-task loop are written HERE as
     checkable lines, never only as prose in the state snapshot. -->

## Concurrency & conflict doctrine

- **Hotspots:** with a single lane there is no intra-sweep contention. Against other
  sessions the contended paths are `backlog/tasks/task-0002*.md` (board moves),
  `docker-compose.yml` (R2 restructures it), and `.claude/agents/` (Lane 0 creates it).
- **Rebases are forbidden repo-wide by the root-guard hook.** This host therefore has
  **one** reconcile move: **merge `origin/main` into the branch.** The sweep skill's
  "a pin-free branch rebases" default does not apply here and must not be attempted — the
  hook blocks it and there is nothing to negotiate.
- **PRs land as merge commits** (`gh pr merge --merge`). Squash merges are blocked at root
  by the same hook.
- **Honest re-pins:** not applicable — no wiki, no pins. If a wiki is built before this
  sweep completes, the classify-then-pin procedure applies (read the main-side diff over a
  note's sources; a merge commit is the re-pin *target*, never the *justification*).
- After every history move (merge-in): re-run the gates **unconditionally**, including the
  container end-to-end run. A sibling merge changes the composition under you.
- **Claim before work:** the FIRST commit of the task claims it — board card →
  In Progress, the `specs/001-*/` stub directory, **and** `spec-bridge:link` against that
  stub, all in that one commit. Cut the worktree from `origin/main`, which does not
  contain the spec yet. Push immediately (`git push -u origin task-0002-walking-skeleton`);
  never force-push a claim (and the hook would block it regardless).
- **A rejected push means you lost the race:** fetch, re-read the board and `specs/`. If
  another session holds TASK-0002 or spec number 001, STOP and surface it to the operator.
  On an unrelated rejection with the task and number still free, merge `origin/main` into
  the claim branch and re-push a plain push.
- Verify the PR merged (`gh api repos/tarrowhq/tarrow/pulls/<n> --jq .merged`) **before**
  deleting the branch or worktree. Never delete-and-recreate a closed PR's head branch.

## Operator checkpoints (do not proceed silently past)

- **R1–R4 are closed.** Reopening any of them mid-phase — a different HTTP owner, an ORM,
  a public deployment, a rewrite of the frozen Python container — is a runbook amendment
  plus an operator ping, never an implementer's decision note buried in a spec artifact.
- **Any tier escalation** (P1 from `claude-sonnet-5` upward). Record the rubric
  justification on the card.
- **P2 discovers that a school class cannot be sourced with parcel geometry.** DECISION §3
  forbids approximating a school from a point at any radius. The correct outcome is a
  declared coverage gap in the manifest — but if the gap is large enough that the slice
  stops being honestly shippable under Principle II, that is an operator call, not a
  phase-local one.
- **Any softening of a gate this runbook enumerates**, at plan time, implement time, or
  merge time.
- **The environment fact worth knowing:** this orchestrator runs as a background job whose
  `PATH` omits `/opt/homebrew/bin` and `/usr/local/bin`. `backlog`, `node`, `gh`, and
  `docker` all require the PATH to be exported per command. A phase that reports "command
  not found" has hit this, not a missing tool.

## Done means

- TASK-0002 is **Done on the board via its own merged PR**, and Done was set by
  `spec-bridge:sync` deriving it from the spec artifacts — never hand-set.
- The card still carries its **Spec marker** at sweep end.
- `specs/001-address-search-school-proximity/` contains real `spec.md`, `plan.md`, and
  `tasks.md`, with every phase box ticked.
- **All eight acceptance criteria on TASK-0002 are ticked**, each against a real artifact:
  a passing test, a running container, or a committed document.
- `docker compose up --build` from a clean clone of `main` serves the flow end to end on
  both `linux/arm64` and `linux/amd64`.
- `spikes/task-0001-geocoding` still reproduces under the `spike` profile.
- `git worktree list` shows no sweep worktrees.
- This file's execution log is complete and its status is flipped to **done**.

## Execution log

Multi-phase dispatch stays visible in `notes` — one slot, never a second table: while the
task is in flight its row carries the phases dispatched/completed (e.g.
`phases: 1-2 done, 3 dispatched`), updated at each dispatch boundary, so a resuming
session can see where within the task the last one stopped; the closing note on merge
replaces or absorbs it.

| date | task | PR | merge | tokens/cost (best-effort) | notes |
|------|------|----|-------|---------------------------|-------|
| 2026-08-04 | Lane 0 (runbook + tier pins) | #5 | `1907068` | — | merged; operator signed off on lanes |
| 2026-08-04 | TASK-0002 | #6 | `c38a226` | P1 214k/117 · P2 252k/92 · P3 277k/88 · P4 245k/112 · P5 328k/108 · **1.32M subagent tokens / 517 tool calls / ~3h20m** | **merged; board Done derived by sync at `34dab92`.** phases 1-5 done. Claim `629fb4c`, spec `ab7dd9b`, P1 `ec12cea`, P2 `35ee23b`+`4a221c1`, P3 `85f1d97`+`71db958`, P4 `ee011db`, P5 `813ca2c`+`abf529d`+`6804e22`. Models: P1 `claude-sonnet-5`, P2–P5 `claude-opus-5[1m]`. 146 tests green; all 8 card ACs ticked against artifacts. |

### Sweep closed — what it left behind

TASK-0002 Done via merged PR #6 (`c38a226`); board Done **derived** by
`spec-bridge:sync`, never hand-set (`34dab92`). Spec `001` carries a real spec.md,
plan.md, and tasks.md with all 63 boxes ticked. No stale worktrees. 146 tests green on
main. Grounding: **no `docs/wiki/` corpus exists**, so there was no freshness gate to
satisfy and nothing to re-pin — building one is the natural next step, not a debt.

Three follow-ups carded from findings this sweep made, all on `main`:

| Card | Why it exists |
|---|---|
| **TASK-0005.04** | A named missing school. The nonpublic source is a voluntary biennial federal survey; St. Vincent–St. Mary is absent from it. Wired as an explicit dependency of TASK-0011, the launch gate. |
| **TASK-0008.01** | Whether tarrow keeps shipping zero client-side JavaScript, or amends the CSP for a hydration nonce. Deferred here on purpose: TASK-0008 is the first work with a real interaction that could argue for it. |
| **TASK-0013** | The TASK-0001 spike's README does not reproduce its own published numbers without undocumented steps. Frozen by R2 during this sweep. |

**The lesson worth carrying to the next sweep:** every one of those three came from a
phase (or the orchestrator) *going to look* at something no box named — P2 spot-checking a
school it had no reason to doubt, P4 auditing dependency error paths, the orchestrator
re-running a phase's own verification instead of accepting it. The boxes caught what the
boxes described. The findings that mattered most were not in any box.

### Notes from execution

- **2026-08-04, dispatch mechanism.** `subagent_type: mechanical-implementer` did not
  resolve: this harness registers `.claude/agents/` at session start, and the definitions
  landed on main mid-session. Dispatched to the generic agent type with `model` on the
  call and the tier definition's instructions carried inline. **The call-level `model`
  parameter was honoured** — P1 reported running as Sonnet 5 — which is worth recording
  because CLAUDE.md documents it being silently ignored on 2026-07-31. Any session started
  after PR #5 gets the frontmatter pin normally and needs neither workaround.
- **2026-08-04, janitor.** Two containers from the merged TASK-0001 worktree
  (`task-0001-db-1`, `task-0001-tools-1`) were still up after that worktree was removed,
  holding host port 55432 and colliding with this task's `db` publish. P1 worked around it
  with a throwaway compose override, which meant the committed `docker-compose.yml` had
  **not** actually been verified. The orchestrator stopped both containers (stop, not
  remove — the `pgdata` volume is untouched) and re-ran the verification against the
  committed file: clean bring-up from an empty volume, all six migrations applied, app
  healthy and serving 200.
- **2026-08-04, the model-pin evidence is weaker than it looks for P2.** P1 served
  `claude-sonnet-5`, which differs from this orchestrator's session model, so the
  call-level `model` parameter demonstrably worked there. P2 served
  `claude-opus-5[1m]` — which *is* the orchestrator's session model, so it is impossible
  to tell whether the parameter was honoured or silently ignored and inherited. The
  intended tier was `claude-opus-5` either way, so nothing was mis-tiered; but only the
  P1 observation is real evidence about the mechanism. CLAUDE.md's frontmatter-pin
  doctrine stands.
- **2026-08-04, P2 hit the operator checkpoint this runbook names.** See
  "Operator checkpoints", third bullet. A confirmed missing school
  (St. Vincent–St. Mary High School, Akron) proves the nonpublic enumeration is
  incomplete, because the federal Private School Universe Survey it draws from is a
  *voluntary biennial survey* rather than an authoritative register. P2 added a fourth
  source from the county tax roll, which recovered several nonpublic campuses but not
  STVM, whose property is held as `SVSM FOUNDATION PROPERTIES LLC`. P2 declined to widen
  the owner-name pattern to catch it — correctly: tuning a heuristic until it catches the
  one miss you already know about produces a source that looks complete and is not.
  The gap is declared by name in the ledger. **Resolution recorded below the log.**
- **2026-08-04, P3 verified against its own strongest claims.** The orchestrator did not
  take the phase report at face value. Confirmed independently: 43/43 tests pass through
  the sanctioned `docker compose --profile test run --rm test` path; no `geography` column
  exists anywhere in the schema and all four geometry columns are SRID 6549; and the
  clearance fixture genuinely fails to compile with the five diagnostics reported, exit 2.
  The load-bearing check was the **sign fixture**: `1563 AKERS AVE` sits **310.26 m** from
  an uncorroborated premises — *outside* the 304.8 m buffer — and flags only because the
  126 m assumed radius is subtracted. Inverting the sign therefore breaks a test against
  real county data rather than against a mock, which is the only version of that test
  worth having.
- **2026-08-04, hazard found by the orchestrator: a zero-collection test run reports
  success.** `docker compose run --rm app npm test` exits 0 having collected **0 tests**,
  because the runtime image deliberately excludes `tests/` — only the `build` stage carries
  them, which is what the `test` compose profile targets. A wrong invocation therefore
  reads as "everything passes" rather than as an error. Harmless while a human is reading
  the number; dangerous the moment it is wired into CI or into the README's command
  sequence. **Handed to P5** as a box: the documented command must be the `test` profile,
  and the suite should fail rather than pass when it collects nothing.
- **2026-08-04, P4 found three real leaks of the searched address — none in tarrow's code.**
  All three were in dependencies, on the *error* path, which is exactly where nobody looks:
  React Router's default `handleError` `console.error`s the full request URL; its default
  root error boundary does it again while server-rendering the 404; and
  `@mjackson/node-fetch-server`'s `defaultErrorHandler`, reached through
  `@react-router/node`'s `createRequestListener`, which does not expose the `onError`
  option that would replace it. Each was closed at source, and then — correctly — the
  process was made to seal its own stdout/stderr, on the reasoning that three leak sites in
  one 7.x minor means a fourth arrives with the next dependency bump. The accepted cost is
  stated in every file it touches: a running-server fault is not diagnosable from its
  output. **This is the phase justifying its tier.** No box named these; they were found by
  going to look.
- **2026-08-04, P4's `log_statement=none` finding is worth generalising.** The three
  settings the box named were already the image defaults, which is not a control — a
  default is something you inherit, not something you enforce. The actual hazards were two
  *non-default* settings: `log_min_error_statement` (defaults to logging the full text of
  any failing statement) and `log_parameter_max_length` (defaults to logging bind
  parameters in full). The searched address travels as a bind parameter. Both are now set
  as command-line flags so `ALTER SYSTEM SET log_statement='all'` cannot override them —
  verified by trying it: with the override, 11 tests fail and the log reads
  `DETAIL: Parameters: $1 = '1464 Garman Rd, Akron, OH 44313'` verbatim.
- **2026-08-04, orchestrator re-verification of P4.** 107/107 tests through the sanctioned
  profile; CSP byte-identical to the runbook's on both 200 and 404; **zero `<script>` tags
  and zero off-origin `src`/`href` in the served document**; the stylesheet returns 200
  (P4 also fixed a Phase-1 defect where `build/client` was never served, so `/assets/*` had
  404'd since Phase 1 — an unstyled page is a privacy defect, because the next person to
  find it reaches for a CDN). An independent canary address, submitted by POST, appears
  **0 times** across all 3,062 bytes of captured container log, with the capture proven
  non-empty rather than merely empty.
- **2026-08-04, the zero-JS question, and where it actually came from.** P4's CSP and RR7's
  hydration bootstrap are incompatible, because the bootstrap emits *inline* `<script>` tags
  carrying serialized loader context and `script-src 'self'` does not admit inline. P4 kept
  the CSP and dropped the client bundle — correct, since softening an operator-signed gate
  inside a phase is exactly what this runbook forbids. But the provenance deserves recording
  honestly: **zero-JS was required by no principle.** AC #6 governs third-party *origins* and
  permits first-party JavaScript entirely. It fell out of the CSP string *this runbook*
  specified in Lane 0. Hashes cannot rescue it either — the context script's content varies
  per request, so no `sha256-` source expression can match; a nonce is the only route.
  Operator ruling: **keep zero JS for this slice**, and reopen the question at TASK-0008
  where a concrete disclosure design can justify it. Carded as **TASK-0008.01** (`5e31b7c`).

  **Resolved 2026-08-07.** Reopened with a disclosure design in hand and decided the other
  way: the nonce is adopted, hydration is restored, and the Lane 0 CSP clause above is
  amended in place. Restoring `<Scripts />` immediately reproduced the P4 leak class through
  a new carrier — RR7 serializes `staticHandlerContext` into an inline script, and on a 404
  that context holds `No route matches URL "/search/<typed>"` — caught by `copy.test.ts` on
  the first run and closed in `entry.server.tsx`. Worth recording that the prediction in this
  entry was right about the mechanism. Full reasoning:
  `docs/decisions/task-0008-01-nonce.md`.
- **2026-08-04, orchestrator re-verification of P5.** 146/146 through the sanctioned
  profile, before and after the merge-in. All four result shapes fetched from the running
  container and checked on raw HTML: **0 `<script>` tags, 0 off-origin `src`/`href`,
  sheriff guidance present on every shape, `never human-verified` present 8× on every
  shape, and 0 hits for the permission vocabulary** (`approved|permitted|you may live|is
  legal|is clear|no results found`). The zero-collection hazard this runbook logged at P3
  is closed: `docker compose run --rm app npm test` now exits **1** with an explanatory
  refusal instead of a false pass.
- **2026-08-04, pre-existing defect found, not fixed.**
  `spikes/task-0001-geocoding/README.md`'s documented command sequence is incomplete —
  `07_measure_final.sql` depends on columns built by `03_measure.sql`/`04_measure_v2.sql`,
  which the README never tells the reader to run, despite 07 describing itself as
  self-contained. The measurement engine reproduces `RESULTS.md`'s numbers (96.79 / 0.21 /
  1.75 / 1.24 against a published 96.79 / 0.20 / 1.75 / 1.26); the *instructions* do not
  stand alone. Untouched here because ruling R2 freezes `spikes/`. **Card it after this
  sweep** — it weakens Principle VII's reproducibility claim for anyone but us.
