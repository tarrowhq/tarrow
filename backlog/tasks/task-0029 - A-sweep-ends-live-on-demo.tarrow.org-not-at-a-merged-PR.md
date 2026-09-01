---
id: TASK-0029
title: 'A sweep ends live on demo.tarrow.org, not at a merged PR'
status: Done
assignee: []
created_date: '2026-08-11 19:57'
updated_date: '2026-09-01 14:49'
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
- [x] #1 A decision record amends or supersedes task-0025-pull-based-cd.md, stating whether a sweep cuts a release tag automatically and on what authority
- [ ] #2 A sweep that scopes tarrow tasks ends with the merged work live on demo.tarrow.org, or reports exactly why it could not, without the operator running any command
- [ ] #3 Bumping the deployed pin and running the deploy is a single invocation, not a hand edit in a second repository
- [x] #4 The deploy step verifies the origin serves the version just released, positive-case address first, and fails loudly if it does not
- [x] #5 A pinned image tag that does not resolve in the registry its compose file names fails a check rather than deploying silently
- [x] #6 The path degrades honestly where infinitynode.media is absent: a self-hoster clone still releases, and the deploy step says plainly that it has no instance to move
- [x] #7 Spec phase: The decision record
- [x] #8 Spec phase: The release script
- [x] #9 Spec phase: The deploy caller and its honest degradation
- [x] #10 Spec phase: Documentation, the Output-gate hook, and re-grounding
- [x] #11 Spec phase: The infra card (orchestrator)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dispatch tier recorded 2026-08-15: default tier, model claude-opus-5 (read from .claude/agents/default-implementer.md frontmatter, which is the pin this harness honors; fallback claude-opus-4-8). Justification: the task overturns a ratified decision record, draws a cross-repo boundary, and its failure mode lands on the public origin -- judgment work, not work to an existing pattern. This host has no .claude/model-tiers.json, so the rubric is the CLAUDE.md model-tiers table. Which model actually served each dispatch is recorded per phase below.

AC#5 is carded on the infinitynode.media board as its TASK-51 (commit 7a11408, pushed to that repo's main): 'A pinned image tag that does not resolve in its compose file's registry fails a check, not a deploy'. Per the operator's ruling 3, AC#5 closes THERE, not here -- the check must read that repo's compose file, so it cannot be a tarrow PR. TASK-51 carries the live-hazard evidence: infra main pins sha-785b71f against compose lines naming ghcr.io/evanstern; that tag resolves in evanstern and NOT in tarrowhq; the demo serves 0.1.1, so the host was moved by hand and Ansible's state disagrees with the running instance; their PRs #19 and #20 both carry the repoint and are both unmerged. Merging one of those is the immediate operator action; TASK-51 is the permanent fix.

Wiki re-grounding analysis for Phase 4, computed 2026-08-15 so the phase inherits it as an artifact rather than rediscovering it. NO wiki note lists scripts/ or docs/deploy/RELEASING.md among its 'sources:' -- so adding scripts/release-tarrow.mjs and scripts/deploy-demo.sh creates NO re-pin obligation by itself, and check-wiki-freshness.mjs passes on the branch as it stands (24/24 fresh). The obligation appears only if Phase 4 edits docs/deploy/self-hosting.md (source of note 'self-hosting'), README.md or CLAUDE.md (sources of note 'work-planning'). TWO NOTES CITE THE RELEASE POSTURE IN PROSE and are NEEDS-REVIEW rather than RE-PIN-ONLY if their sources move: docs/wiki/overview.md:80 says a v* tag 'publishes and stops, and the demo moves only when its pinned tag changes and the deploy runs', and docs/wiki/work-planning.md:88 describes the CLAUDE.md release instruction. The Phase 1 amendment changes what follows a merge, so that prose must be re-read against the diff and amended BEFORE any pin is bumped -- never bump to make the gate green.

PR #14 opened 2026-08-15 and is green: wiki-freshness passed in CI, mergeable=MERGEABLE, state CLEAN. All 24 tasks.md boxes ticked across 5 phases; the spec-bridge derives Done-eligible. Awaiting operator review -- the sweep does not self-merge, and after docs/decisions/task-0029-sweep-auto-release.md that review IS the human checkpoint for everything downstream of it. AC#1/#2/#3/#4/#6 close in this PR; AC#5 closes on infinitynode.media TASK-51.

Operator update 2026-08-15, verified against both repos rather than taken on report. (1) The live hazard is CLOSED: infra PR #19 merged, #20 closed as superseded; infra main now pins sha-6f548c5 against compose lines naming ghcr.io/tarrowhq; both tarrow-app and tarrow-db resolve at that tag in tarrowhq (docker manifest inspect); demo.tarrow.org serves revision 6f548c5 -- so Ansible's recorded state and the running host agree for the first time since the rename. (2) infra TASK-49 is Done. (3) The operator is writing infra TASK-51 (the registry-resolution check) now. The v0.1.1 Release object still does NOT exist (gh api releases returns v0.1.0 only), so that operator action remains open. NEW: the deploy seam is now carded as infra TASK-52 (commit d4c88ce, pushed) -- scripts/deploy-tarrow.sh, the driver tarrow's deploy-demo.sh already calls and nothing implements. It is separate from TASK-51 because TASK-51 is the check and TASK-52 is the driver: same repo, unrelated changes, independent PRs. AC#3's deploy half closes on TASK-52; AC#5 closes on TASK-51.

spec-bridge sync: The decision record: 4/4 · The release script: 6/6 · The deploy caller and its honest degradation: 6/6 · Documentation, the Output-gate hook, and re-grounding: 5/5 · The infra card (orchestrator): 3/3 — status In Progress → Done

Post-merge closure 2026-09-01. PR #14 merged as 00417c2 (verified via gh api .merged). Gates re-run on merged main: check-wiki-freshness.mjs exit 0 (24/24), check-no-moving-tags.mjs exit 0. Board moved to Done by spec-bridge sync (the only sanctioned path for a linked task); plan is now idempotent and check exits 0 with 3 linked tasks, none exceeding their artifacts.

AC STATUS, stated honestly rather than rounded up:
  #1 CLOSED -- docs/decisions/task-0029-sweep-auto-release.md on main.
  #4 CLOSED -- deploy-demo.sh verifies /version then three addresses, positive case first; evidence in specs/003-sweep-ends-live/degradation-evidence.md.
  #5 CLOSED -- on infra TASK-51, now Done: `make check-image-tags` resolves every pinned tag against the registry its own compose file names. Verified by running it: exit 0, and it reports 21 of 32 references NOT VERIFIED (Docker Hub excluded by FR-009) rather than claiming a clean pass.
  #6 CLOSED -- absent-infra path exercised, exit 3 DECLINED, transcript recorded.
  #2 and #3 NOT TICKED. The mechanism is merged and works, but the deploy half still exits 1 because infra scripts/deploy-tarrow.sh does not exist yet (infra TASK-52, To Do). A sweep today would reach "release cut, deploy FAILED with the path it wanted" -- which is the honest reporting AC#2 also demands, but it is not "live on demo.tarrow.org". These close when TASK-52 lands, and the deploy step should then be exercised once end to end.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (The decision record: 4/4 · The release script: 6/6 · The deploy caller and its honest degradation: 6/6 · Documentation, the Output-gate hook, and re-grounding: 5/5 · The infra card (orchestrator): 3/3). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->
