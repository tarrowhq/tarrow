---
id: TASK-0026
title: 'Release procedure documented in tarrow itself, not only in the infra repo'
status: To Do
assignee: []
created_date: '2026-08-11 16:33'
labels:
  - 'area:infra'
  - 'kind:docs'
dependencies: []
priority: high
ordinal: 42000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Doing a tarrow release has three times started with rediscovering where the deploy lives, because it lives in the private infinitynode.media repository and nothing in tarrow said so. The consequence is not theoretical: on 2026-08-11 demo.tarrow.org was found serving 2026-08-06 code -- healthy, answering, five days stale -- because a release had been cut and the second half was never done.

docs/deploy/RELEASING.md is the fix: the host (misc/vm-103), the stack path (/opt/stacks/tarrow), the pinned-tag file (infinitynode.media ansible/inventory/group_vars/docker_hosts/service_config.yml, tarrow_image_tag), the playbook invocation and its three traps, the three-address data verification, and a manual SSH path for somebody without the infra repo checked out. Self-contained by design -- it duplicates rather than links, because a procedure you cannot follow from the repository you are standing in is one that gets rediscovered every time.

Also corrects two overstatements shipped by TASK-0025: self-hosting.md claimed the demo updates via scripts/tarrow-deploy-agent.sh, and the decision doc described that agent as the mechanism. The decision holds -- nothing pushes from CI into the host -- but Ansible is what satisfies it here, and running both would mean each undoing the other.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 docs/deploy/RELEASING.md exists and can be followed without the infrastructure repo checked out
- [ ] #2 README.md and CLAUDE.md both point at it from where a human and an agent actually start
- [ ] #3 The claim that the demo self-updates via the polling agent is corrected everywhere it appears
<!-- AC:END -->
