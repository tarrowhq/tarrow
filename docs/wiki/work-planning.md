---
name: work-planning
description: How work is proposed and landed — Spec Kit specs, the Backlog.md board with its fixed label taxonomy, one TASK one PR, and where frozen spike evidence and runbooks live.
kind: concept
sources:
  - .specify/memory/constitution.md
  - backlog/config.yml
  - specs/001-address-search-school-proximity/spec.md
  - specs/002-repoint-tarrowhq-org/spec.md
  - README.md
  - CLAUDE.md
verified_against: 21fbc2c7ac7640712803c955ceff7b8ac6c9f888
---

# Work planning

Work is planned as specs under `specs/` and tracked on a Backlog.md board under `backlog/`.
The delivery rules come from the constitution's Delivery section, not from convention.

## How it works

**One TASK, one PR.** A top-level TASK is a deliverable and maps to exactly one branch and one
pull request. Subtasks (`TASK-XXXX.NN`) are internal breakdown: they ride the parent's branch
and merge in the parent's PR, and never get one of their own. A subtask record is minted only
when the breakdown needs tracking of its own — independent status, its own notes, a different
person doing it. When it is merely a work list, it stays in the parent's plan or Definition of
Done, because records are for work that needs to move on the board and checklists are for work
that only needs to get done.

**A PR that touches pinned wiki sources carries the wiki refresh with it.** `docs/wiki/` is
what the next person or agent reads to orient before changing anything, so a note that no
longer matches its sources is worse than no note. `/grounding-wiki:wiki-update` runs BEFORE the
PR is opened and the refresh lands in that same PR;
`.github/workflows/wiki-freshness.yml` runs `scripts/check-wiki-freshness.mjs` on every pull
request and fails it otherwise.

That gate is vendored into the repository rather than invoked from the plugin, because the
plugin's copy lives in a versioned per-user cache that CI cannot reach. It replaced an
enforcement that existed only in prose: CLAUDE.md asserted the gate ran in CI while no script
and no workflow existed, and the corpus went stale across two merges without a red check.
Never bump a pin without reading the diff -- the pin is a claim that somebody verified the
content at that commit, and a false claim there hides the staleness instead of showing it.

**Every PR leaves main deployable and the application working.** No PR leaves the system
half-migrated or dependent on a follow-up to function. The consequence stated plainly: a
top-level TASK is a vertical slice, not a horizontal layer — "provision the database" is not a
TASK because it ships nothing on its own. A PR may narrow *coverage* but never *honesty*; a
partial slice states its limits, which is precisely what makes shipping it safe. A PR whose
product is a document satisfies deployability trivially.

**Milestones** group several TASKs into a capability step and are not PR boundaries.

**The board.** Tasks are `TASK-XXXX`, zero-padded to four digits, moving To Do → In Progress →
Done. Labels come from a fixed taxonomy in `backlog/config.yml`: exactly one `area:*`
(`legal`, `geo`, `etl`, `api`, `web`, `infra`, `docs`), exactly one `kind:*` (`spike`,
`feature`, `schema`, `gate`, `debt`), and zero or more `x:*` cross-cutting markers
(`privacy`, `safety`, `partnership`) that trigger extra review. Introducing a new label
requires amending that list first — a governance change, not a typing convenience. Backlog
markdown is never hand-edited; all board state moves through the `backlog` CLI.

**Specs** live in `specs/NNN-<feature>/` as `spec.md`, `plan.md`, and `tasks.md`. Spec phases
are internal breakdown mirrored onto the linked task as acceptance criteria, not PR boundaries.
Rulings in a plan (`R1`, `R2`, …) are referenced directly from source comments — `plan.md R1`
for the no-adapter server, `R4` for queries authored as files.

**Frozen evidence.** `spikes/task-0001-geocoding/` holds an investigation and its published
`RESULTS.md`. The `tools` service and `docker/tools/` are kept byte-identical specifically so
those numbers keep reproducing; the accuracy figures quoted throughout the code (96.79%
correct, 151,904 probes, the p95 campus extent) trace back there. `docs/design/` holds runbooks;
`docs/decisions/` holds decision records, which are cited from source comments the same way
plan rulings are — `docs/decisions/task-0008-01-nonce.md` is referenced from `app/server/http.ts`,
`root.tsx`, and the tests that hold its line.

## Connections

- [[constitution-and-principles]] is the governing document these rules come from.
- [[address-resolution]] and [[measurement-uncertainty]] cite the DECISION sections and spike
  measurements this process produced.
- [[container-composition]] holds the frozen spike service.

## Operational notes

`CLAUDE.md` requires running `backlog instructions overview` before acting on a request in this
repository, with detailed guides for creation, execution, and finalization. Advocacy-partner
review is treated as a gate on public launch rather than as marketing, and work there carries
`x:partnership`.

`CLAUDE.md` also carries a standing instruction about releases: read `docs/deploy/RELEASING.md`
rather than reconstructing the deploy, and treat **publishing an image as not deploying it**.
The deployment is Ansible-driven from a private infrastructure repository, so the fact does not
follow from anything in this codebase and an agent that infers a deploy path from the code will
invent a wrong one. `scripts/tarrow-deploy-agent.sh` is for self-hosters without configuration
management, not for that instance.
