# TASK-0020 org repoint — sweep runbook (2026-08-06)

**You (the session reading this) are the ORCHESTRATOR** for the task below. Run it through
the host project's full PDLC — spec → link → worktree → delegated implementation → PR →
merge → re-ground. Direction is decided; do not re-litigate it: the repository move to
`tarrowhq/tarrow` already happened, and `specs/002-repoint-tarrowhq-org/spec.md` wins on
scope. Plan-of-record is the board; this file carries only ordering, doctrine, and the log.

**Status:** executing · operator sign-off on lanes: pending

<!-- This is a single-task sweep. The operator invoked `/pdlc:sweep TASK-0020` directly,
     which is the sign-off on scope; lane sign-off is moot with one lane and one task.
     A resuming session should treat the scope as settled and the doctrine below as
     binding. -->

## Read first (in this order)

1. `specs/002-repoint-tarrowhq-org/spec.md` and `plan.md` — the direction and the
   constitution check. The spec's "What this does not prove" section is load-bearing:
   it names two things a green CI run will *not* establish.
2. `.specify/memory/constitution.md` — v1.2.0, **ratified** 2026-08-04. Principle VII
   governs this task entirely.
3. `docs/design/task-0002-walking-skeleton-runbook.md` §"Per-PR gates this project
   enforces" — the project's gate machinery, inherited here rather than restated.
4. `backlog task list --plain` — live state; other sessions move it while you work.
5. `backlog task view TASK-0020 --plain`.

## State when this runbook was written (2026-08-06)

- **Done already:** TASK-0001, TASK-0002 (+ subtasks .01–.04), TASK-0014, TASK-0015,
  TASK-0016, TASK-0017, TASK-0018, TASK-0019. The repository move itself is done: remote
  repointed to `git@github.com:tarrowhq/tarrow.git`, `main` pushed, old remote retained
  locally as `old-origin`.
- **In flight in other sessions (do not duplicate; expect their merges):** none observed.
  `git worktree list` at sweep start showed only the root and one prunable entry
  belonging to a different repository (`somap/.worktrees/soma-path`) — not this project's,
  not touched.
- **Paused — untouched:** none. No task carries a `paused` label.
- **Queued (this runbook's scope):** TASK-0020.

### Precondition findings (recorded so a resuming session does not re-derive them)

- **Merge-drift gate: ABSENT.** No `scripts/check-merge-drift.mjs`; no `scripts/`
  directory at the repository root at all. The raw git commands stand — `git fetch origin
  && git pull --ff-only` at root before starting and before merging; confirm the branch
  sits on current `origin/main` before merge.
- **Grounding corpus: ABSENT.** No `docs/wiki/`, therefore no pins, no freshness probe,
  and no re-ground obligation for this sweep. The concurrency doctrine's pin rules are
  recorded below anyway because they are what a *later* sweep will need once a corpus
  exists; for this sweep they are vacuous.
- **Constitution: RATIFIED** (v1.2.0, 2026-08-04). `plan.md` is checked against it
  directly, not against grounding docs.
- **Tier pins resolve.** `.claude/agents/mechanical-implementer.md` carries
  `model: claude-sonnet-5`; `.claude/agents/default-implementer.md` carries
  `model: claude-opus-5`. Frontmatter is authoritative over the CLAUDE.md table.

## Execution lanes

**Lane 1 — the only lane:**

- **TASK-0020 (mechanical tier · model `claude-sonnet-5`, fallback `claude-opus-4-8` —
  rubric: work to a fully stated constraint, no design decision left at implementation
  time)** — repoint every current-state `evanstern` reference to `tarrowhq`, preserving
  the historically-correct ones. Four phases; phases 1–3 dispatched, phase 4 is the
  orchestrator's post-merge verification.

**Why mechanical and not default.** The judgment in this task — *which* `evanstern` hits
are current-state and which are historical record, and what a second migration note must
tell a self-hoster — is spent in `spec.md` R2/R5 and `plan.md` §"Why not a single `sed`".
What reaches the implementer is a named set of files, a named set of must-not-touch sites,
and a stated content requirement. That is the mechanical tier's definition. The tier
ruling is recorded on the board card at dispatch, with the model actually served.

**Phase dispatch:** one fresh implementer per phase (1, 2, 3), each re-grounding from the
spec directory and the branch's commits. Nothing is handed between phases via chat
context — the artifact set is `specs/002-repoint-tarrowhq-org/{spec,plan,tasks}.md`, the
tasks.md tick state, and the branch's commits.

## Per-PR gates this project enforces (implementers cannot miss these)

- **Merge-drift gate: ABSENT** (see precondition findings). Raw git commands stand.
- **Root-guard hook (`.claude/hooks/root-guard-hook.mjs`) is live and has no bypass.**
  PreToolUse, fires on every Bash and every Write/Edit:
  - **No writes to tracked paths in the root checkout.** All authoring happens in
    `.worktrees/<name>`. This runbook itself lands by PR for that reason.
  - **Rebases are forbidden repo-wide.** Freshen a branch by merging `origin/main` **into**
    it. This overrides the sweep skill's default "pin-free branch rebases" rule.
  - **No force-push, anywhere. No squash merge** — PRs land with `gh pr merge --merge`.
  - Root commits are permitted **only** when scoped entirely to `backlog/` (the board-sync
    exception, and it must be a pathspec commit — `git commit -- backlog/`, no `-a`) or
    when concluding a merge.
- **Container-only verification (Principle VII).** Every check and test runs through
  `docker compose`. A phase that verifies itself by running a tool on the host has not
  verified itself.
- **Pinning is not negotiable.** The `${TARROW_IMAGE_TAG:?...}` guard in
  `docker-compose.deploy.yml` must survive this change byte-identical. Substituting an
  owner is not an occasion to introduce a moving tag.
- **Multi-arch is not negotiable.** The post-merge publish must produce `linux/amd64` and
  `linux/arm64` under the new owner. An org move that silently drops an architecture
  violates Principle VII as surely as an amd64-only base image would.
- **Board hygiene.** Backlog markdown is never hand-edited; all board state moves through
  the `backlog` CLI. Stage specific task files, never `backlog/` wholesale.
- **Re-ground obligations: none.** No `docs/wiki/` corpus exists.

## Per-task artifacts required before PR

**No PR opens until each line below checks true.**

- [x] `specs/002-repoint-tarrowhq-org/` carries a real `spec.md` (problem + requirements
      R1–R5 mapped to the card's four ACs), `plan.md` (checked against the **ratified**
      constitution v1.2.0), and `tasks.md` (four phases as checkboxes the bridge derives
      from), committed on `task-0020-tarrowhq-org`.
- [x] The card carries its `Spec: specs/002-repoint-tarrowhq-org` marker from the claim,
      and phase ACs (#5–#8) are seeded from tasks.md before implementation dispatch.
- **Escape lines (operator-signed only):** none. No task in this sweep skips its spec set.

**Gate lines from the precondition ruling** (recorded here as checkable lines, not only as
prose above):

- [ ] The verification grep after Phase 3 returns **only** the permitted survivors —
      the somap→tarrow migration note in `docs/deploy/self-hosting.md`, TASK-0016's card
      under `backlog/`, and `specs/002-repoint-tarrowhq-org/`'s own prose. Zero hits is a
      **failure**, not a success: it means historically-correct references were rewritten.
- [ ] `docker-compose.deploy.yml`'s `TARROW_IMAGE_TAG:?` guard is byte-identical to its
      pre-change form on all four `image:` lines.
- [ ] Phase 4 is not ticked from the diff. It requires an actual publish run, actual
      manifests, and an actual architecture check.

## Concurrency & conflict doctrine

- **Hotspots:** `docker-compose.deploy.yml`, `docs/deploy/self-hosting.md`, `README.md`.
  With one lane there is nothing to contend with, but a concurrent session touching the
  deploy composition would conflict head-on.
- **Paused tasks are not live lanes:** none exist here. If one appears, it is never
  claimed, rebased, or cleaned — its branches and worktrees belong to the pausing operator.
- Reconcile by **merging `origin/main` into the branch**, never rebasing — the root-guard
  hook forbids rebases repo-wide, which happens to coincide with the pin-safety rule.
- **Honest re-pins only.** Vacuous for this sweep (no corpus). Recorded for the next one:
  a merge-in never justifies a pin bump; route every staled pin through the classifier
  (`git diff <old-pin>..<merge-commit> -- <sources>` → RE-PIN-ONLY vs NEEDS-REVIEW).
- After every history move (merge-in): re-run gates unconditionally.
- **Claim before work:** done — the first commit on this branch was the spec-002 stub, and
  the board flip to In Progress landed at root immediately before it. Never force-push a
  claim; a rejected push means fetch, merge `origin/main` in, re-push.
- Verify a PR is merged (`gh api repos/tarrowhq/tarrow/pulls/<n> --jq .merged`) before
  deleting its branch or worktree. Note the repo path — `tarrowhq/tarrow`, not the old
  one; the walking-skeleton runbook's example predates the move and Phase 3 corrects it.

## Execution mode

This sweep runs as a **Claude Code background job**. Pushing `main` directly *is* available
here (the board-sync exception in the root-guard hook permits `backlog/`-scoped root
commits, and `origin` accepts them), so the no-main-push degradations do **not** apply:
board bookkeeping lands direct on `main` at root, and only the deliverable rides the PR.
The worktree lives at `.worktrees/task-0020` per the host's own convention rather than
under the harness isolation root, because the root-guard hook's write-allow rule keys on
`.worktrees/` specifically.

## Operator checkpoints (do not proceed silently)

- **Package visibility (spec R5).** The images that appear under `ghcr.io/tarrowhq` start
  **private**, because packages inherit the new repository's visibility and
  `tarrowhq/tarrow` is private. TASK-0016 deliberately made the `evanstern` packages
  public and verified it with an anonymous pull token; that property does **not** travel
  with the org move. This is a Principle VII matter — a published image a stranger cannot
  pull does not satisfy "deployable by someone who has never spoken to us." It cannot be
  fixed from this repository and cannot be done before the packages exist, so it is
  carded as a follow-up in Phase 4 and surfaced to the operator at sweep close. **Do not
  report this sweep as closing the self-hostability loop.**
- **Tier escalation** would be an operator checkpoint. None is expected; the task is
  mechanical throughout.
- **Softening any gate this runbook enumerates** is a runbook amendment plus an operator
  ping — never an implementer's note buried in a spec artifact.

## Done means

- TASK-0020 is **Done on the board via its own merged PR**, with status moved by
  `spec-bridge:sync` rather than by hand.
- The card still carries its `Spec: specs/002-repoint-tarrowhq-org` marker at sweep end.
- `specs/002-repoint-tarrowhq-org/` on `main` carries real `spec.md`, `plan.md`, `tasks.md`.
- A `publish images` run on the merge commit is green across all five jobs, and
  `ghcr.io/tarrowhq/tarrow-{app,db}` exist at that run's `sha-<short>` tag as multi-arch
  OCI indexes with no moving tag.
- The package-visibility follow-up is carded.
- `git worktree list` shows no stale sweep worktrees; `task-0020-tarrowhq-org` is deleted
  after the merge is verified.
- This file's execution log is complete and its status is flipped to `done`.

## Execution log

| date | task | PR | merge | tokens/cost (best-effort) | notes |
|------|------|----|-------|---------------------------|-------|
| 2026-08-06 | TASK-0020 | — | — | — | claimed; spec 002 authored (spec/plan/tasks); card linked, phase ACs #5–#8 seeded; phases: none dispatched yet |
