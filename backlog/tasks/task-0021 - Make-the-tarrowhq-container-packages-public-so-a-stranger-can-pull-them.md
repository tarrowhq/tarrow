---
id: TASK-0021
title: Make the tarrowhq container packages public so a stranger can pull them
status: To Do
assignee: []
created_date: '2026-08-06 16:39'
labels:
  - 'x:deploy'
dependencies: []
priority: high
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-0020 repointed every published-image reference to ghcr.io/tarrowhq, and the first publish from the new repository creates ghcr.io/tarrowhq/tarrow-app and ghcr.io/tarrowhq/tarrow-db. Those are NEW packages, and packages inherit the visibility of the repository that published them. tarrowhq/tarrow is private, so they start private.

TASK-0016 made the evanstern packages public deliberately and verified it with an anonymous pull token, because a self-hoster who has never spoken to us must be able to pull. That property does NOT travel with the org move — it was set per-package through the GitHub UI, not by anything in this repository.

Until this is done, docs/deploy/self-hosting.md sends a stranger to an image they cannot pull. They get `denied` or `unauthorized` from `docker pull` and no indication why. The self-hosting doc already says so in its "The new images are private" note, which is honest but is not a fix.

This is a Principle VII matter: a published image a stranger cannot pull does not satisfy "deployable by someone who has never spoken to us."

Cannot be done from this repository and could not be done before the packages existed, which is why it was carded rather than folded into TASK-0020.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ghcr.io/tarrowhq/tarrow-app package visibility is set to public via the GitHub org package settings
- [ ] #2 ghcr.io/tarrowhq/tarrow-db package visibility is set to public via the GitHub org package settings
- [ ] #3 An anonymous pull is verified for both images, in the shape TASK-0016 used: obtain an anonymous token and fetch the manifest without any authenticated credential, not merely a pull from a logged-in machine
- [ ] #4 Both images are confirmed still multi-arch (linux/amd64 and linux/arm64) after the visibility change
- [ ] #5 docs/deploy/self-hosting.md's 'The new images are private' note is updated or removed to match reality, so the doc does not warn about a condition that no longer holds
<!-- AC:END -->
