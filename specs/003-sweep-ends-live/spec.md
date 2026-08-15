# Feature Specification: a sweep ends live on demo.tarrow.org, not at a merged PR

**Feature Branch**: `task-0029-sweep-ends-live`
**Board task**: TASK-0029
**Created**: 2026-08-11
**Status**: Draft
**Input**: TASK-0029, plus three operator rulings taken 2026-08-11 and recorded in
`docs/design/task-0029-sweep-ends-live-runbook.md`.

## The problem, stated once

`/pdlc:sweep` ends at *merged*. Its skill contains no mention of release, tag, publish, or
deploy, and its Output gate proves "every scoped task Done via its own merged PR, every
project gate green on main" and stops. That was correct when it was written — tarrow had no
deploy path. It is no longer correct, and the consequence is that the last mile is manual by
construction: on 2026-08-11 the whole chain (cut `v0.1.1`, move the pin, run the playbook,
verify three addresses) was done by hand.

**Publishing an image is not deploying it.** A `v*` tag publishes pinned multi-arch images
to GHCR and creates a Release, and stops. `demo.tarrow.org` runs whatever tag is pinned in a
*different, private* repository (`infinitynode.media`), and moves only when that line changes
and an Ansible playbook runs. A release without that second half leaves the demo serving
exactly what it served before — healthy, answering, and stale. That is what happened for five
days in August 2026.

### What this feature must not become

An automated path to the public origin is a safety surface, not a convenience. The instance
answers *"am I allowed to live here?"* for people whose alternative to a wrong answer is an
injunction. Under **Principle I** the asymmetry is total: shipping a broken instance faster is
strictly worse than shipping a correct one slower. Every requirement below that looks like
friction — verify before declaring, refuse rather than assume, fail loudly rather than no-op —
is that principle applied, and is not negotiable for convenience.

## Operator rulings this spec is written against

These were genuine forks, put to the operator on 2026-08-11 rather than assumed:

1. **A sweep cuts the release tag automatically.** §1 of
   `docs/decisions/task-0025-pull-based-cd.md` is overturned, on the operator's reasoning that
   *the PR approval already was the human checkpoint, and demanding a second deliberate act is
   the manual last mile this task exists to remove.*
2. **The pin-bump script lives in `infinitynode.media`; tarrow calls it by path** and fails
   loudly when the infra repo is absent.
3. **The infra half (AC#5) is carded on the infra board** and closes there. One task, one PR
   holds across the repo boundary.

## User Scenarios & Testing

### User Story 1 — the operator's sweep reaches the public origin without them (Priority: P1)

An operator runs a sweep over tarrow tasks. They review and approve the PRs, as the PDLC
already asks. They do nothing else. When the sweep reports finished, `demo.tarrow.org` is
serving the merged work — or the sweep states, in its own report, exactly which step stopped
it and what the operator must do.

**Why this priority**: it is the task. Everything else exists to make it safe.

**Independent Test**: run the release phase end-to-end against the current main with no
operator commands, then read `/version` and the three-address check from outside.

**Acceptance Scenarios**:

1. **Given** merged work on `main` with all gates green, **When** the release phase runs,
   **Then** a version tag is cut and pushed, `release.yml` publishes the images and creates
   the Release, the pin is moved, the playbook runs, and the origin is verified to serve that
   exact version.
2. **Given** any step fails, **When** the sweep reports, **Then** the report names the failed
   step and what remains, and **never** rounds up to "deployed".
3. **Given** the origin serves a version other than the one just released, **When**
   verification runs, **Then** it fails loudly — a stale instance is a *working* instance, so
   "it responded" is never accepted as the answer.

---

### User Story 2 — the deploy is one invocation, not a hand edit in a second repository
(Priority: P1)

Moving `tarrow_image_tag` in `infinitynode.media` and running the playbook is currently three
manual steps in another checkout, each of which has cost an hour before (the `ansible.cfg`
cwd trap, the venv, the asserted `--limit`).

**Why this priority**: AC#3, and User Story 1 cannot complete without it.

**Independent Test**: invoke the caller with a target version against a checked-out infra
repo and observe the pin moved, committed, and the playbook run.

**Acceptance Scenarios**:

1. **Given** the infra repo is present, **When** the caller runs with a version, **Then** the
   pin is edited, committed, and the playbook runs against `--limit misc` in one invocation.
2. **Given** the infra repo cannot be resolved, **When** the caller runs, **Then** it exits
   nonzero with a message naming what it looked for and where — never a silent no-op.

---

### User Story 3 — a self-hoster's clone still releases, and says plainly it has no instance
(Priority: P2)

Someone who has never spoken to us clones tarrow. They have no `infinitynode.media` and never
will. **Principle VII** says the system must remain deployable in full by exactly this person.

**Why this priority**: AC#6, and a constitutional obligation rather than a nicety. It is P2
only because P1 delivers the operator path; this makes it honest for everyone else.

**Independent Test**: run the release path with no infra repo resolvable and confirm the
release completes while the deploy step declines clearly.

**Acceptance Scenarios**:

1. **Given** no infra repo, **When** the release path runs, **Then** the tag, the images and
   the Release all still happen — publishing is not gated on anyone's private infrastructure.
2. **Given** no infra repo, **When** the deploy step is reached, **Then** it says plainly that
   it has no instance to move, and this is reported as *declined*, not as *failed* and not as
   *deployed*.

---

### User Story 4 — a pin that does not resolve fails a check rather than deploying (Priority: P1)

Nothing today verifies that the pinned tag resolves in the registry the compose file names.

**Why this priority**: this is the failure that cost the lost week, and — verified 2026-08-11
— **it is live right now**: `infinitynode.media` main pins `sha-785b71f` against a compose
file naming `ghcr.io/evanstern/*`; that tag resolves in `evanstern` and does **not** resolve
in `tarrowhq`, while the demo serves `0.1.1`. The next playbook run from infra main targets a
tag that does not exist in its own named registry.

**Why it is not in this PR**: the check must live in `infinitynode.media` beside the compose
file it reads. Per ruling 3 it is carded on that board; this spec records the requirement and
the evidence so the infra card inherits both.

**Acceptance Scenarios**:

1. **Given** a pinned tag that does not resolve in its compose file's registry, **When** the
   check runs, **Then** it fails and the deploy does not proceed.

## Requirements

### Functional

- **FR-001** — A release phase, invocable without operator commands, that derives the next
  version, cuts and pushes the tag, waits for `release.yml`, and confirms the origin serves it.
- **FR-002** — The phase is a **repo-local runbook plus scripts** that the sweep's Output gate
  points at. praxisflux stays generic: no change to the sweep plugin.
- **FR-003** — Version derivation is explicit and inspectable, never guessed silently. It must
  handle the case where the derived tag **already exists** — see *The v0.1.1 half-release*.
- **FR-004** — A single invocation moves the pin and runs the deploy (US2).
- **FR-005** — Verification reads the **live origin** from outside, checks `/version`, and then
  checks the three addresses **positive case first** — `1464 Garman Rd` must return *inside a
  buffer*. A broken instance returns "outside every buffer" for everything, so a negative-only
  check reads as a pass. This ordering is a Principle I requirement, not a style choice.
- **FR-006** — Every step degrades honestly: declined, failed, and deployed are three distinct
  outcomes and are never collapsed.
- **FR-007** — `docs/deploy/RELEASING.md` is amended in this same PR. Its own *Keeping this
  honest* section requires both places change in one session.
- **FR-008** — A decision record under `docs/decisions/` amends
  `task-0025-pull-based-cd.md` per ruling 1, stating the authority. Prose in a runbook, a spec,
  or a commit message does not satisfy AC#1.

### Non-functional / safety

- **NFR-001** — No credential capable of reaching the demo host is introduced. §2 of
  `task-0025-pull-based-cd.md` — *the host pulls; GitHub does not push* — is **not** overturned
  and is not in scope. Ruling 1 overturns §1 only. The deploy is still driven from an
  operator's machine reaching out.
- **NFR-002** — No moving tags. `check-no-moving-tags.mjs` runs on any PR touching this path.
- **NFR-003** — The automation must never publish over an existing version object without
  saying so.

## The v0.1.1 half-release — the first case this automation meets

Verified 2026-08-11: `v0.1.1` is tagged and both images are published (`0.1.1` pulls from
`tarrowhq`), but `release.yml` run 31523860531 failed at `no-moving-tags` because `latest`
still existed, so the `release` and `verify-demo` jobs were **skipped**. No GitHub Release
object exists for `v0.1.1`. `latest` has since been retired and the check now passes, so the
tag is re-runnable.

The plan must decide, explicitly: does the release phase re-run an existing tag, or start from
the next unused version? This is an operator-visible consequence (NFR-003) and the answer is
recorded rather than discovered at runtime.

**This sweep does not fire the new automation at the live origin.** Building the mechanism is
TASK-0029; its first real use is the *next* sweep. Shipping a path to the public instance and
exercising it in the same breath is a one-way door.

## Success Criteria

- **SC-001** — An operator sweep reaches `demo.tarrow.org` with zero hand-run commands, or
  reports precisely why not (AC#2).
- **SC-002** — Pin bump plus deploy is one invocation (AC#3).
- **SC-003** — Verification is positive-case-first and fails loudly on mismatch (AC#4).
- **SC-004** — The absent-infra path is **exercised, not asserted**: the caller is actually run
  with no infra repo resolvable and its output recorded (AC#6).
- **SC-005** — A decision record amends `task-0025-pull-based-cd.md` (AC#1).
- **SC-006** — AC#5 is carded on the infra board with the live hazard recorded, and
  cross-referenced from TASK-0029.

## Out of scope

- Changing the praxisflux sweep plugin. The procedure is repo-local by FR-002.
- Push-based CD, or any inbound path to the demo host (NFR-001).
- Merging `infinitynode.media` PRs #19/#20, or running its playbook. This sweep does not act
  in another repository; the hazard is reported to the operator.
- Cutting any release during this sweep.
