---
id: TASK-0020
title: Repoint project references to the tarrowhq org
status: In Progress
assignee: []
created_date: '2026-08-06 15:20'
updated_date: '2026-08-06 16:02'
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
- [ ] #4 A publish from the new repo produces images under ghcr.io/tarrowhq and the deploy smoke job passes against them
- [ ] #5 Spec phase: Deploy composition default
- [ ] #6 Spec phase: Self-hosting documentation
- [ ] #7 Spec phase: Remaining current-state references
- [ ] #8 Spec phase: Post-merge publish verification (orchestrator)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dispatch tier (2026-08-06): mechanical, model claude-sonnet-5 (pinned in .claude/agents/mechanical-implementer.md frontmatter, which is authoritative over the CLAUDE.md table). Fallback claude-opus-4-8 on subscription unavailability.

Rubric justification: the judgment in this task is spent in specs/002-repoint-tarrowhq-org/spec.md (R2, R5) and plan.md (why not a single sed) -- which evanstern references are current-state versus historically-correct record, and what a second migration note must tell a self-hoster. What reaches the implementer is a named file set, a named must-not-touch set, and a stated content requirement. That is work to an existing pattern with its constraints stated rather than discovered.

Phases 1-3 dispatched one fresh implementer each. Phase 4 (post-merge publish verification) is the orchestrator's and cannot be satisfied from a diff.
<!-- SECTION:NOTES:END -->
