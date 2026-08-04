---
id: TASK-0002
title: Address search returns school proximity with a coverage manifest
status: In Progress
assignee: []
created_date: '2026-08-04 15:58'
updated_date: '2026-08-04 21:12'
labels:
  - 'area:web'
  - 'kind:feature'
  - 'x:safety'
milestone: m-0
dependencies:
  - TASK-0001
priority: high
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The walking skeleton, shipped end to end: a user enters an address and sees which school premises fall within the state buffer, alongside an explicit statement of what was and was not checked.

Deliberately narrow on coverage and complete on honesty. Only school premises are loaded, which is safe to ship precisely because the coverage manifest says so (Principle II). Not promoted to real users at this stage.

Privacy architecture is inside this slice rather than after it. This is the first build that could leak anything, and shipping a version that logs addresses and fixing it later is exactly the retrofit Principle III forbids.

The hardest part is not the map, it is the language. The strongest thing this interface may say is that the address is outside every buffer we checked, stated together with what we did not check.

Spec: specs/001-address-search-school-proximity
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A user can enter an address and receive school proximity results for Summit County
- [ ] #2 Every result carries a coverage manifest naming layers queried, layers absent, and verification dates
- [ ] #3 No rendered copy states or implies permission, verified by a test over result strings
- [ ] #4 A could-not-locate address is distinguishable from a located address with no nearby facilities
- [ ] #5 No IP address or searched address is recorded anywhere in the stack, including access and error logs
- [ ] #6 No third-party origin loads in the client, enforced by a build check
- [ ] #7 Guidance to confirm with the registering sheriff office appears on every result
- [ ] #8 Deployed and working end to end
- [ ] #9 Spec phase: PostGIS baseline and deploy pipeline
- [ ] #10 Spec phase: Summit County school premises ingest
- [ ] #11 Spec phase: Proximity query and coverage manifest
- [ ] #12 Spec phase: No-log privacy architecture, CSP, and verification
- [ ] #13 Spec phase: Web surface and end to end
<!-- AC:END -->
