---
id: TASK-0020
title: Repoint project references to the tarrowhq org
status: Done
assignee: []
created_date: '2026-08-06 15:20'
updated_date: '2026-08-11 15:07'
labels:
  - 'kind:chore'
dependencies: []
priority: high
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The repository moved from evanstern/tarrowhq to tarrowhq/tarrow. The git remote is repointed, but the codebase still names the old owner in places that outlive a remote rename: the deploy composition's default registry, the self-hosting docs' image table and migration note, the README's image names, the ETL User-Agent URL, and the sweep runbook's gh api example.

The CI workflow derives its registry from github.repository_owner, so it follows the move on its own -- images published from the new repo will land under ghcr.io/tarrowhq. That means the hardcoded ghcr.io/evanstern defaults now point at a registry that will receive no further tags, exactly the situation the self-hosting doc's own migration note describes for the somap -> tarrow rename. The doc will need a second such note.

Old images under ghcr.io/evanstern remain pullable; nothing breaks today. This is about the next publish, and about not shipping docs that send a self-hoster to a stale registry.

Spec: specs/002-repoint-tarrowhq-org
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 docker-compose.deploy.yml defaults to the tarrowhq registry
- [ ] #2 Self-hosting docs name the tarrowhq images and carry a migration note for the org move
- [ ] #3 README and ETL User-Agent name the new org
- [x] #4 A publish from the new repo produces images under ghcr.io/tarrowhq and the deploy smoke job passes against them
- [x] #5 Spec phase: Deploy composition default
- [x] #6 Spec phase: Self-hosting documentation
- [x] #7 Spec phase: Remaining current-state references
- [x] #8 Spec phase: Post-merge publish verification (orchestrator)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dispatch tier (2026-08-06): mechanical, model claude-sonnet-5 (pinned in .claude/agents/mechanical-implementer.md frontmatter, which is authoritative over the CLAUDE.md table). Fallback claude-opus-4-8 on subscription unavailability.

Rubric justification: the judgment in this task is spent in specs/002-repoint-tarrowhq-org/spec.md (R2, R5) and plan.md (why not a single sed) -- which evanstern references are current-state versus historically-correct record, and what a second migration note must tell a self-hoster. What reaches the implementer is a named file set, a named must-not-touch set, and a stated content requirement. That is work to an existing pattern with its constraints stated rather than discovered.

Phases 1-3 dispatched one fresh implementer each. Phase 4 (post-merge publish verification) is the orchestrator's and cannot be satisfied from a diff.

spec-bridge sync: Deploy composition default: 3/3 · Self-hosting documentation: 5/5 · Remaining current-state references: 6/6 · Post-merge publish verification (orchestrator): 0/6
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed 2026-08-11. All four spec phases of specs/002-repoint-tarrowhq-org are complete and the two orchestrator criteria are now verified against reality rather than against the diff.

AC #4 (a publish from the new repo produces images under ghcr.io/tarrowhq and the smoke job passes). Verified: run 31145127147 on df4ce10, conclusion success, all five jobs green — prepare, parity, publish x2, smoke. Both packages exist under the new owner and have received four further publishes since (sha-6d60a31, sha-ad10850, sha-ff1094a, sha-0a24287), so this is a standing property of the pipeline and not a one-off.

AC #8 (spec phase 4, post-merge publish verification). Every box in specs/002-repoint-tarrowhq-org/tasks.md Phase 4 is ticked, including the two that were blocked by the 2026-08-06 GitHub Actions major_outage and were re-verified afterward from a clean run.

Re-confirmed at close, from the current checkout rather than from memory:
  - docker-compose.deploy.yml defaults to ghcr.io/tarrowhq on all four image lines.
  - docs/deploy/self-hosting.md names the tarrowhq images in its table and carries the
    "Upgrading from the `evanstern` org" migration note the card asked for, including the
    private-packages consequence.
  - No `evanstern` reference survives in README.md or app/.

One condition this card described has since changed and is NOT this card's to fix: phase 4 recorded "no moving tag published (no latest, no main)", which was true at df4ce10. The v0.1.0 release later published a `latest` tag before PR #10 suppressed it, and that tag still exists. Removing it and enforcing its absence is TASK-0025, which owns it explicitly. Recorded here so a reader of this card does not take its no-moving-tag verification as describing the registry today.
<!-- SECTION:FINAL_SUMMARY:END -->
