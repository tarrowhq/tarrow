# TASK-0002 walking skeleton — sweep runbook (2026-08-04)

**You (the session reading this) are the ORCHESTRATOR** for the task below. Run it through
the host project's full PDLC — spec → link → worktree → delegated implementation → PR →
merge → re-ground. Direction is decided; do not re-litigate it: the **constitution**
(`.specify/memory/constitution.md`, v1.2.0), the **TASK-0001 decision**
(`spikes/task-0001-geocoding/DECISION.md`), and the **operator rulings recorded in §Stack
rulings below** win. Plan-of-record is the board; this file carries only ordering,
doctrine, and the log.

**Status:** draft · operator sign-off on lanes: pending
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
- Verify the PR merged (`gh api repos/evanstern/somap/pulls/<n> --jq .merged`) **before**
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
| 2026-08-04 | TASK-0002 | — | — | P1 214k / 117 calls / 35 min · P2 252k / 92 calls / 52 min | in flight. **phases: 1-2 done, 3 pending operator checkpoint.** Claim `629fb4c`, spec `ab7dd9b`, P1 `ec12cea`, P2 `35ee23b`+`4a221c1`. P1 served `claude-sonnet-5`; P2 served `claude-opus-5[1m]`. |

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
- **2026-08-04, pre-existing defect found, not fixed.**
  `spikes/task-0001-geocoding/README.md`'s documented command sequence is incomplete —
  `07_measure_final.sql` depends on columns built by `03_measure.sql`/`04_measure_v2.sql`,
  which the README never tells the reader to run, despite 07 describing itself as
  self-contained. The measurement engine reproduces `RESULTS.md`'s numbers (96.79 / 0.21 /
  1.75 / 1.24 against a published 96.79 / 0.20 / 1.75 / 1.26); the *instructions* do not
  stand alone. Untouched here because ruling R2 freezes `spikes/`. **Card it after this
  sweep** — it weakens Principle VII's reproducibility claim for anyone but us.
