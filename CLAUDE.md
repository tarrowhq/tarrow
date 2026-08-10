
<!-- BACKLOG.MD GUIDELINES START -->
<CRITICAL_INSTRUCTION>

## Backlog.md Workflow

This project uses Backlog.md for task and project management.

**For every user request in this project, run `backlog instructions overview` before answering or taking action.**

Use the overview to decide whether to search, read, create, or update Backlog tasks.

Use the detailed guides when needed:
- `backlog instructions task-creation` for creating or splitting tasks
- `backlog instructions task-execution` for planning and implementation workflow
- `backlog instructions task-finalization` for completion and handoff

Use `backlog <command> --help` before running unfamiliar commands. Help shows options, fields, and examples.

Do not edit Backlog task, draft, document, decision, or milestone markdown files directly. Use the `backlog` CLI so metadata, relationships, and history stay consistent.

</CRITICAL_INSTRUCTION>
<!-- BACKLOG.MD GUIDELINES END -->

<!-- pdlc:grounding BEGIN v0.54.0 — planted by pdlc:bootstrap; refreshed wholesale on update. Keep project-specific edits OUTSIDE this block. -->
# tarrow — praxis development lifecycle (PDLC)

This project is developed with the **praxisflux** plugin suite. This block is the always-on
grounding: it names the loop, each plugin's role, and the rules that hold between them. The
procedures live in the plugins' skills (lazy-loaded); this block makes the rules apply even
when no skill has triggered.

## The loop

Ground the codebase → plan as specs → build → re-ground → teach/render:

```
grounding-wiki (docs/wiki) ──corpus──▶ codebase-to-course (docs/course)
        │
        └─grounding─▶ spec/plan ──▶ build ──▶ wiki-update (re-ground) ──▶ …
```

## Plugin roles (entry skills)

- **grounding-wiki** — the code-grounded corpus in `docs/wiki/`: per-concept notes pinned to
  the commit they were verified against. Build once with `/grounding-wiki:wiki-build`; when a
  change touches files any note lists as sources, run `/grounding-wiki:wiki-update` **before
  opening the PR**, and land the wiki refresh in that same PR.
- **codebase-to-course** — interactive single-page HTML course in `docs/course/`, for
  non-technical readers. Reads `docs/wiki/` as its primary input when present.
- **build** — implements a SPEC handed off through `.handoff/` (`/build:implement`) and
  returns findings to the producer.
- **research** — drop-anywhere cited-fact vaults (`research:research-vault` → `analyze-vault`
  → `vault-artifact`) for grounding external topics.
- **spec-bridge** — the kanban view over Spec Kit specs (see the Spec Kit block below, if
  opted in).
- **pdlc** — the lifecycle's own verbs: `pdlc:bootstrap` (re)stamps this grounding after
  plugin upgrades; `/pdlc:sweep` orchestrates a set of board tasks through the whole loop —
  an authored, operator-signed-off runbook, then spec → PR → merge → re-ground per task,
  parallel lanes with serial merges; `/pdlc:refactor-triage` closes the loop after a sweep —
  evaluate the merged work for debt and drift, triage every finding with the operator, and
  card accepted items back onto the board as sweepable tasks.

## Rules that always hold

- **Artifact-grounded action:** never do anything without leaving a durable paper trail
  and/or gating against real physical evidence in the project — a file, a git commit, a
  task/issue. Artifacts that survive for human review are the only currency of state and
  decision: a choice living only in a chat turn, or a commitment left as prose where its
  durable home is the tracker, did not happen. Decisions are derived FROM artifacts and
  produce NEW artifacts; a question an existing artifact or principle already answers is
  resolved from it, not re-asked as a preference.
- **One TASK, one PR:** a TASK is a top-level deliverable and maps 1:1 to a pull request —
  one task, one branch, one PR. An EPIC (whatever the task system calls it) groups
  deliverable TASKs and gets no PR of its own; a SUBTASK is internal work breakdown and
  never gets its own PR: subtasks land as commits on the parent TASK's single branch and
  merge together in that TASK's one PR. A PR exists only where it carries a stated reason
  for a human to approve (a policy ratified, a posture changed, a contract made binding) —
  never a diff for its own sake; work too small to give a reviewer a real decision merges
  into the deliverable it serves.
- **Gates:** a status can never exceed the artifacts that prove it. Enforcement is
  per-plugin: spec-bridge, educate, research, reorient, and team-review ship Stop hooks;
  grounding-wiki's freshness gate runs as `scripts/check-wiki-freshness.mjs`, enforced on
  every pull request by `.github/workflows/wiki-freshness.yml`, not as a hook. When a gate
  blocks, produce the missing artifact — don't argue with the gate or edit derived state
  by hand.
- **Handoffs:** plugins compose only through files + gates, never by calling each other.
  Payloads ride the gitignored `.handoff/` transport; evidence lives in tracked state.
- **Grounding freshness:** `docs/wiki/` is load-bearing, not decoration — it is what the next
  person or agent reads to orient before changing anything, so a note that no longer matches
  its sources is worse than no note. A change that touches pinned sources is not done until
  the wiki is re-verified and re-pinned (`/grounding-wiki:wiki-update`), **in the same PR as
  the change**. Run `node scripts/check-wiki-freshness.mjs` before opening one; CI runs it too
  and will fail the PR. Never bump a pin without reading the diff: the pin is a claim that
  somebody verified the content at that commit, and a false claim there is worse than a stale
  note, because the staleness is then invisible.
- **Corpus loading:** when a grounded corpus is present (`docs/wiki/` or similar), load its
  `INDEX.md` first and route; load notes just-in-time — never bulk-load the corpus.
  Whole-corpus orientation reads `CAPSULES.md` when it exists; without one, INDEX plus
  just-in-time notes.

## Model tiers — who does what work

A sweep dispatches each task's implementation to a subagent; which model that subagent runs
on drives both cost and quality. The default ladder:

| Tier | Model | For |
|---|---|---|
| default implementer | `claude-opus-5` | design work, cross-surface doctrine, anything with a real judgment call |
| mechanical | `claude-sonnet-5` | work to an existing pattern — tests to a sibling standard, corpus hygiene |
| fallback | `claude-opus-4-8` | when the subscription does not surface the primary |

**How a tier is pinned.** Put the model ID in the agent definition's frontmatter —
`.claude/agents/<tier>-implementer.md`, `model: <id>`. That is the mechanism that holds. Do
**not** rely on the dispatch call's `model` parameter: on 2026-07-31 it was observed silently
ignored by this harness — dispatches meant for one model ran on the orchestrator's session
model at ~2× the unit price before being killed (`docs/design/board-cost-test-runbook.md`,
TASK-74 row). The frontmatter pin is what the harness actually honors.

**Which one is authoritative.** The table above is the **planted default** — doctrine,
refreshed wholesale when you re-run `pdlc:bootstrap`. The agent definition's `model:` is
**authoritative at dispatch**: it is the model that actually runs. To change which model a tier
resolves to, edit that one line in `.claude/agents/<tier>-implementer.md` — a plain tracked file
**outside every marker**, no drift, no `--force`. The table recommends; the frontmatter pins.

<!-- pdlc:peer:backlog BEGIN -->
## Backlog.md — the board (officially supported peer)

Backlog.md is this project's kanban; the board is the plan of record. Statuses flow
**To Do → In Progress → Done**.

- Start from `backlog task list --plain`; read a task with `backlog task view TASK-x --plain`.
- Record plans (`--plan`), progress (`--append-notes`), and tick acceptance criteria
  (`--check-ac <n>`) as they come true; finish with `--final-summary` and `-s Done`.
- **One task, one PR:** a top-level TASK gets one branch and one PR. Dotted-id subtasks
  (TASK-x.y) are internal breakdown — they ride the parent task's branch and merge in its
  PR, never their own.
- **Two-track landing:** board/bookkeeping commits (cards, status flips, notes, AC ticks)
  land direct on the default branch; deliverable work lands by PR. This is one-task-one-PR
  applied, not an exception to it — a PR exists only where it carries a stated reason for a
  human to approve, and a board card carries no such decision. Where main-push is
  unavailable (background jobs, protected `main`), the board track degrades to riding the
  next task branch or a wrap-up PR.
- **Never hand-edit** files under `backlog/` — always the `backlog` CLI, so metadata and
  relationships stay consistent.
<!-- pdlc:peer:backlog END -->

<!-- pdlc:peer:spec-kit BEGIN -->
## Spec Kit — specs drive the work (officially supported peer)

Features are specified with GitHub Spec Kit (`specify`) under `specs/NNN-<feature>/`
(spec.md, plan.md, tasks.md). The spec dir is the source of truth for its feature.

- Put a spec on the board with `spec-bridge:link`; after working a spec, run
  `spec-bridge:sync` to move the linked task, re-mirror phase criteria, and record progress.
- The bridge gate blocks a linked task's status from exceeding what the spec artifacts
  prove — produce the artifact, then sync.
- A spec's linked task is the deliverable: it lands as **one PR**. Spec phases and their
  mirrored criteria are internal breakdown, not PR boundaries.
<!-- pdlc:peer:spec-kit END -->
<!-- pdlc:grounding END -->
