# TASK-0029: a sweep ends live on demo.tarrow.org — sweep runbook (2026-08-11)

**You (the session reading this) are the ORCHESTRATOR** for the task below. Run it through
the host project's full PDLC — spec → link → worktree → delegated implementation → PR →
merge → re-ground. Direction is decided; do not re-litigate it: TASK-0029's card and the
operator's three rulings recorded under *Operator decisions* below win. Plan-of-record is
the board; this file carries only ordering, doctrine, and the log.

**Status:** done · operator sign-off on lanes: 2026-08-11 · closed 2026-09-01

## Read first (in this order)

1. `backlog task view TASK-0029 --plain` — the card, which carries the gap analysis.
2. `docs/decisions/task-0025-pull-based-cd.md` — the decision this task amends.
3. `docs/deploy/RELEASING.md` — the manual procedure being automated.
4. `docs/wiki/INDEX.md` → `self-hosting`, `container-composition`, `work-planning`.
5. `backlog task list --plain` — live state; other sessions move it while you work.

## Operator decisions (taken 2026-08-11, before lane authoring)

These three were genuine forks in the task and were put to the operator rather than
assumed. They are recorded here because the spec is written *against* them.

1. **A sweep cuts the release tag automatically** — §1 of `task-0025-pull-based-cd.md`
   ("only a version tag deploys, and cutting a tag is a person deciding") is **overturned**
   on the operator's stated reasoning: *the PR approval already was the human checkpoint,
   and demanding a second deliberate act is exactly the manual last mile this task exists
   to remove.* The amendment is AC#1's deliverable and lands as a decision record, not as
   a runbook line — a runbook is not where a ratified decision lives.
2. **The pin-bump script lives in `infinitynode.media`; tarrow calls it by path.** That
   repo knows the vars file, the venv, `bw-run.sh`, and `--limit misc`. tarrow ships a thin
   caller that resolves the infra checkout and **fails loudly** when it is absent — which
   is the self-hoster case AC#6 requires.
3. **The infra half is carded on the infra board, not folded into this PR.** AC#5's
   registry-resolution check cannot be a tarrow PR. It closes on its own infra card,
   cross-referenced from TASK-0029. One task, one PR is preserved.

## State when this runbook was written (2026-08-11)

- **Done already:** TASK-0025 (pull-based CD decided + `/version` + `verify-demo`),
  TASK-0027 (migration drift). `docs/deploy/RELEASING.md` exists and is pointed at from
  both README.md and CLAUDE.md.
- **In flight in other sessions (do not duplicate; expect their merges):** none in
  `tarrowhq/tarrow`. In `infinitynode.media`: **PR #19** (repoint to tarrowhq, pin
  `sha-6f548c5`) and **PR #20** (repoint + pin `0.1.1`) — both OPEN, both unmerged, and
  both are the fix for the Lane 0 hazard below.
- **Paused — untouched:** none (no task carries the `paused` label).
- **Queued (this runbook's scope):** TASK-0029.

### Three findings verified at precondition time — read before planning

Each was checked against the live system on 2026-08-11, not inferred.

- **The infra pin on `main` would roll the demo backwards, and its tag does not exist.**
  `infinitynode.media` main reads `tarrow_image_tag: sha-785b71f` with a compose file still
  naming `ghcr.io/evanstern/*`. Verified: that tag **resolves in `evanstern`** and **does
  not resolve in `tarrowhq`**. The demo currently serves `0.1.1` (`/version` reports
  `{"version":"0.1.1","revision":"6f548c5…"}`), so the host was moved by hand — Ansible's
  own state disagrees with the running instance. **The next playbook run against infra main
  deploys a tag that does not resolve in the registry its compose file names.** That is
  AC#5's exact failure mode, live, today. It is why Lane 0 exists.
- **v0.1.1 is a half-release.** The tag is pushed and both images published (`0.1.1` pulls
  OK from `tarrowhq`), but `release.yml` run 31523860531 failed at `no-moving-tags` because
  `latest` still existed, so the `release` and `verify-demo` jobs were **skipped** — no
  GitHub Release object exists for v0.1.1. `latest` has since been retired;
  `node scripts/check-no-moving-tags.mjs` passes now (exit 0, "none moving"), so the release
  is re-runnable. The spec must decide whether the automated release phase is idempotent
  over a tag that already exists — this is the first case it will meet.
- **No `.claude/model-tiers.json` in this host.** The rubric is the CLAUDE.md
  `## Model tiers` table, pinned authoritatively in agent frontmatter. There is no
  `tiers.mjs` to `--check`, so the IDs below were **read directly from the frontmatter**,
  which is the mechanism this harness honors.

## Execution lanes

One scoped task, so the lanes are within it. Lane 0 is not TASK-0029 work — it is a live
hazard found while orienting, and it gates the sweep's own verification step.

**Lane 0 — the live hazard (operator action, before Lane 2's verification can mean
anything):** `infinitynode.media` PRs #19/#20 carry the registry repoint and the correct
pin. Until one merges, infra `main` is a loaded gun: any deploy from it targets a
non-resolving tag. The sweep **does not touch another repository's PRs** — this is
surfaced to the operator, and the infra card (decision 3) records it.

**Lane 1 — TASK-0029, the tarrow deliverable:**

- **TASK-0029 (default tier · model `claude-opus-5`, fallback `claude-opus-4-8` — the card
  carries a decision to overturn, a cross-repo boundary to draw, and a `x:deploy`-shaped
  failure mode whose blast radius is the public origin; this is judgment work, not work to
  an existing pattern)** — the decision amendment, the release phase, the pin-bump caller,
  and honest degradation.

Tier and model ID were read from `.claude/agents/default-implementer.md` frontmatter
(`model: claude-opus-5`) — the authoritative pin at dispatch. Record tier + model ID +
which model actually served on the board card at dispatch.

**Phase-scoped dispatch:** one fresh implementer per `tasks.md` phase. Verify the served
model from the first dispatch's transcript before launching any sibling dispatch.

## Per-PR gates this project enforces (enumerated — implementers cannot miss these)

- **Merge-drift gate: ABSENT.** `scripts/check-merge-drift.mjs` does not exist in this
  host. The raw git commands stand: `git fetch origin && git pull --ff-only` at root before
  claiming, and a collision check against `origin/main` before taking a spec number.
- **Root checkout is READ-ONLY, enforced by a hook.** `.claude/hooks/root-guard-hook.mjs`
  blocks every write at the repo root — including documentation and this runbook. All
  authoring happens in the worktree; main is reached only by merge. There is no bypass
  flag.
- `node scripts/check-wiki-freshness.mjs` — **must exit 0 before any PR**, and again after
  every history move. CI enforces it via `.github/workflows/wiki-freshness.yml`.
- `node scripts/check-no-moving-tags.mjs` — any PR touching the release path re-runs it.
- **Same-PR companion artifacts:** a change to release or deploy mechanics amends
  `docs/deploy/RELEASING.md` **in the same PR** (its own "Keeping this honest" section
  requires both places change in one session), and the decision amendment for AC#1 lands
  as a file under `docs/decisions/`.
- `docs/wiki/` notes whose sources this task touches: **`self-hosting`** (sources include
  `.github/workflows/publish-images.yml`, `docs/deploy/self-hosting.md`) and
  **`work-planning`** (sources include `CLAUDE.md`, `README.md`). If the diff touches those
  sources, the note is re-verified and re-pinned **in this PR**, honestly — read the diff,
  never bump a pin to make the gate green.

## Per-task artifacts required before PR

- [ ] `specs/003-sweep-ends-live/` carries a real `spec.md`, `plan.md`
      (constitution-checked against `.specify/memory/constitution.md`, which **is**
      ratified here), and `tasks.md` with phased checkboxes — committed on the task
      branch. A claim stub reserves the number and satisfies none of this.
- [ ] The card carries its Spec marker from the claim commit (`spec-bridge:link` against
      the stub), with phase ACs seeded from `tasks.md` before implementation dispatch.
- **Escape lines (operator-signed only):** none.
- **Host addition — the amendment is a decision record, not prose.** AC#1 is only met by a
  file under `docs/decisions/` that amends or supersedes `task-0025-pull-based-cd.md` and
  states the authority. A runbook line, a spec paragraph, or a commit message does not
  close it.
- **Host addition — degradation is tested, not asserted.** AC#6 requires the absent-infra
  path to be exercised, not merely coded: the caller must be run with no infra checkout
  resolvable and its message recorded in the spec dir or the PR.

## Concurrency & conflict doctrine

- **Hotspots:** `docs/deploy/RELEASING.md`, `docs/decisions/`, `scripts/`,
  `.github/workflows/release.yml`, `backlog/tasks/`. Board commits and this PR both touch
  `backlog/`; add specific task files, never `backlog/` wholesale.
- **Cross-repo:** `infinitynode.media` is a **separate repository with its own board and
  its own open PRs**. This sweep never merges its PRs, never touches its deployment
  configuration, and never runs its playbook. Its deliverable work is carded and handed to
  the operator.
  > **Amended 2026-08-15, during execution.** This line originally read "never commits
  > there". Phase 5's deliverable *is* a board card on that repo, which cannot be created
  > without a commit in it. The rule as written would have made its own required phase
  > impossible. Narrowed to what was actually meant: **no deliverable or configuration
  > commits** in the infra repo — a board card is a bookkeeping commit and lands direct on
  > that repo's `main` under its own two-track rule. TASK-51 was created and pushed there
  > (`7a11408`) under this narrowed reading. Nothing in `ansible/` or `services/` was
  > touched, and no PR of theirs was merged.
- Reconcile by what the branch carries: a **pin-carrying branch** (this one will be, if it
  re-pins `self-hosting` or `work-planning`) **merges `origin/main` in** — never rebase,
  never squash, never force-push; its PR lands as a merge commit.
- **Honest re-pins only.** A merge-in never justifies a pin bump. Classify each staled pin
  from `git diff <old-pin>..<merge-commit> -- <sources>` as RE-PIN-ONLY or NEEDS-REVIEW,
  amend prose before bumping.
- After every history move: re-run gates **and** the freshness probe unconditionally.
- **Claim before work:** first commit on the branch flips the card to In Progress, creates
  the spec stub, and runs `spec-bridge:link`. Push immediately; never force-push a claim.
- **Execution mode: background job, worktree-only authoring.** The worktree lives at
  `.claude/worktrees/task-0029`. The root guard forbids root writes outright, so the
  two-track rule's "board commits direct to main" degrades here to **board commits ride
  this branch** and land in its PR.

## Operator checkpoints (do not proceed silently)

- **Lane 0 is already at the operator:** merging `infinitynode.media` #19 or #20. The
  sweep reports it and does not act.
- **The v0.1.1 half-release:** whether the automated release phase re-runs the existing
  v0.1.1 tag or starts from v0.1.2 is a spec question with an operator-visible consequence
  (a re-run publishes over an existing version object). Surface the spec's answer; do not
  cut any tag during this sweep.
- **This sweep does not exercise its own new release phase against the live demo.**
  Building the automation is TASK-0029; the first real auto-release is the *next* sweep.
  Shipping the mechanism and firing it at the public origin in the same breath is a
  one-way door.
- Tier escalation, or amending these lanes — amend this file, note why, tell the operator.

## Done means

- TASK-0029 **Done on the board via its own merged PR**, its Spec marker still on the card.
- `specs/003-sweep-ends-live/` carries spec.md + plan.md + tasks.md.
- A decision record under `docs/decisions/` amends `task-0025-pull-based-cd.md` (AC#1).
- `node scripts/check-wiki-freshness.mjs` exits 0 on main; wiki-freshness CI green.
- The infra half is **carded on the infra board** with the Lane 0 hazard recorded, and
  cross-referenced from TASK-0029 (AC#5 closes there, not here).
- `git worktree list` shows no stale sweep worktrees.
- This file's log complete, status flipped to done, and the report states plainly which
  ACs closed in this repo and which are carried by the infra card.

## Execution log

| date | task | PR | merge | tokens/cost (best-effort) | notes |
|------|------|----|-------|---------------------------|-------|
| 2026-08-11 | TASK-0029 | — | — | — | runbook authored; operator signed off on lanes; claim commit |
| 2026-08-15 | TASK-0029 | #14 | `00417c2` | ~520k subagent tokens across 4 dispatches | phases 1–5 done, 24/24 boxes; all dispatches served `claude-opus-5`, verified from transcripts |
| 2026-09-01 | TASK-0029 | — | — | — | merged; gates green on main; Done via `spec-bridge:sync`; branch and worktrees removed. AC#2/#3 left open — see below |

### What the dispatches actually cost, and what held

Four implementer dispatches, all at the `default` tier. **Model verified from the first
dispatch's transcript before any sibling launched** (27/27 requests on `claude-opus-5`), and
the frontmatter pin held on every one — including the two that ran in parallel.

Phases 2 and 3 ran concurrently in one worktree because their file footprints were disjoint
(`scripts/release-tarrow.mjs` vs `scripts/deploy-demo.sh`), each told to add files by explicit
path. No conflict resulted. Phase 4 ran alone because it edits shared documentation and the
wiki.

**Verifying by running, not by reading the report, is what earned its keep.** Phase 3
reported success; running its script showed a set-but-missing `$TARROW_INFRA_REPO` warning and
then deploying from the default location — a typo would have deployed the demo from a repo
nobody named, which is this task's own failure mode one layer down. Fixed in `ff8fcb5`, with
the two invalidated evidence transcripts re-run rather than edited to match.

## What this sweep did and did not close (2026-09-01)

PR #14 merged as `00417c2`. Gates re-run on merged main rather than trusted from the PR:
`check-wiki-freshness.mjs` exit 0 (24/24), `check-no-moving-tags.mjs` exit 0,
`spec-bridge check` exit 0. TASK-0029 moved to Done by `spec-bridge:sync`, the only
sanctioned path for a linked task. Worktrees pruned, branch deleted.

**Closed:** AC#1 (the decision record), AC#4 (positive-case-first verification), AC#6 (the
absent-infra path, exercised and recorded). **AC#5 closed on infra TASK-51**, which is Done —
verified by running `make check-image-tags` in that repo rather than by reading its card: it
exits 0 and reports 21 of 32 pinned references NOT VERIFIED (Docker Hub excluded by its own
FR-009) instead of claiming a clean pass. A check that overstated its coverage would have been
worse than no check, in a task that exists because two repositories were green about different
registries.

**Not closed, and deliberately not ticked: AC#2 and AC#3.** The mechanism is merged and works,
but the deploy half exits 1 until `infinitynode.media` `scripts/deploy-tarrow.sh` exists
(infra **TASK-52**, To Do — carded during this sweep). A sweep run today reaches *release cut,
deploy FAILED with the path it wanted*. That is the honest reporting AC#2 also asks for, but it
is not *live on demo.tarrow.org*, and ticking it would make the board claim something the
system cannot do.

**The one thing the next session should not skip:** when TASK-52 lands, exercise the deploy
step end to end once, then tick AC#2 and AC#3. This sweep deliberately never fired its own
automation at the public origin — building the mechanism and pointing it at the live instance
in the same change is a one-way door — so the first real run is still ahead, and it should be
watched by a person.

**Still open, unrelated to TASK-52:** `v0.1.1` is tagged with images published and no GitHub
Release object. `release-tarrow.mjs --dry-run` reports it every run with the one-line fix
(`gh release create v0.1.1 --title v0.1.1 --generate-notes --prerelease`). Per plan D1 the
automation reports rather than repairs it, because republishing a version from a different
tree is the drift Principle VII's pinning rule forbids.
