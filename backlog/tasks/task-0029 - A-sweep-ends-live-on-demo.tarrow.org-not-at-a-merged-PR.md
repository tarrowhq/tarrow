---
id: TASK-0029
title: 'A sweep ends live on demo.tarrow.org, not at a merged PR'
status: In Progress
assignee: []
created_date: '2026-08-11 19:57'
updated_date: '2026-08-15 18:35'
labels:
  - 'area:infra'
  - 'kind:feature'
dependencies: []
priority: high
ordinal: 45000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GOAL, in the operator's words: 'sweep task xxxx' -> human in the middle only where the PDLC already puts them (spec, PR review) -> approved and merged -> it is live on demo.tarrow.org. No hand-run commands, no being told that infinitynode.media has to do x/y/z, no manual release.

WHERE THE GAP ACTUALLY IS. /pdlc:sweep ends at 'merged'. Its 428-line SKILL.md contains no mention of release, tag, publish, or deploy, and its Output gate proves 'every scoped task Done on the board via its own merged PR, every project gate green on main' and stops. That is not a defect in the sweep -- it was written before tarrow had a deploy path -- but it means the last mile is manual by construction. On 2026-08-11 the whole chain (cut v0.1.1, move the pin, run the playbook, verify three addresses) was done by hand.

ALREADY IN PLACE, verified 2026-08-11, so this task is smaller than it sounds:
  - misc pulls the private GHCR packages (docker manifest inspect returns a valid multi-arch index from the host).
  - Passwordless sudo is NOPASSWD on misc, so an unattended deploy needs no interactive auth.
  - The Ansible playbook runs non-interactively from a laptop checkout (bw-run.sh + venv).
  - /version, release.yml's verify-demo job, and check-no-moving-tags.mjs all work and are green.

WHAT IS MISSING, and it is three things:

1. A RELEASE PHASE IN THE SWEEP. After the last scoped PR merges and gates are green: derive the next version, cut and push the tag, wait for release.yml, then confirm the origin serves it (scripts/verify-deployed-version.mjs already does the last part). This is a tarrow-side procedure the sweep adopts, not a change to the sweep plugin itself -- prefer a repo-local runbook the sweep's Output gate points at, so praxisflux stays generic.

2. THE PIN BUMP AUTOMATED. Moving tarrow_image_tag in infinitynode.media and running the deploy playbook is currently a hand edit in a second repository. It needs to be one command tarrow can invoke -- a script that edits the pin, commits, and runs the playbook against --limit misc. Where it lives is a real choice: a script in infinitynode.media that tarrow calls by path, or a thin wrapper here. It must fail loudly rather than silently no-op when the infra repo is absent, since a self-hoster has no such repo.

3. THE CHECK THAT WOULD HAVE CAUGHT THE LOST WEEK (infra side). Nothing verifies that the pinned tag RESOLVES in the registry the compose file names. tarrow_image_tag sat at sha-785b71f -- a tag existing only in the abandoned ghcr.io/evanstern -- while tarrow published to ghcr.io/tarrowhq. Both sides were green about different registries and the demo served 5-day-old code. A CI check in infinitynode.media that resolves every pinned image tag against its own compose file's registry closes it permanently.

A DECISION TO RATIFY, NOT TO ASSUME. docs/decisions/task-0025-pull-based-cd.md records that only a version tag reaches demo, on the reasoning that cutting a tag IS a person deciding this should be in front of readers. A sweep that auto-releases overturns that. The argument for overturning it: the operator's PR approval already WAS the human checkpoint, and requiring a second deliberate act is exactly what this task exists to remove. The argument against: a sweep can merge several PRs, and 'approved this diff' is not identical to 'ship this to the public instance'. Whichever way it goes, it is an amendment to that decision record and must be written there rather than left implicit in a runbook.

OPERATOR RULINGS, taken 2026-08-11 before the spec was authored (recorded in full in docs/design/task-0029-sweep-ends-live-runbook.md):
  1. A sweep DOES cut the release tag automatically, overturning section 1 of task-0025-pull-based-cd.md, on the reasoning that PR approval already was the human checkpoint.
  2. The pin-bump script lives in infinitynode.media; tarrow calls it by path and fails loudly when the infra repo is absent.
  3. The infra half (AC#5) is carded on the infinitynode.media board and closes there, so one-task-one-PR holds across the repo boundary.

Spec: specs/003-sweep-ends-live
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A decision record amends or supersedes task-0025-pull-based-cd.md, stating whether a sweep cuts a release tag automatically and on what authority
- [ ] #2 A sweep that scopes tarrow tasks ends with the merged work live on demo.tarrow.org, or reports exactly why it could not, without the operator running any command
- [ ] #3 Bumping the deployed pin and running the deploy is a single invocation, not a hand edit in a second repository
- [ ] #4 The deploy step verifies the origin serves the version just released, positive-case address first, and fails loudly if it does not
- [ ] #5 A pinned image tag that does not resolve in the registry its compose file names fails a check rather than deploying silently
- [ ] #6 The path degrades honestly where infinitynode.media is absent: a self-hoster clone still releases, and the deploy step says plainly that it has no instance to move
<!-- AC:END -->
