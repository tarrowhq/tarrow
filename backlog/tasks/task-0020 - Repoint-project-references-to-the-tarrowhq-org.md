---
id: TASK-0020
title: Repoint project references to the tarrowhq org
status: To Do
assignee: []
created_date: '2026-08-06 15:20'
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
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 docker-compose.deploy.yml defaults to the tarrowhq registry
- [ ] #2 Self-hosting docs name the tarrowhq images and carry a migration note for the org move
- [ ] #3 README and ETL User-Agent name the new org
- [ ] #4 A publish from the new repo produces images under ghcr.io/tarrowhq and the deploy smoke job passes against them
<!-- AC:END -->
