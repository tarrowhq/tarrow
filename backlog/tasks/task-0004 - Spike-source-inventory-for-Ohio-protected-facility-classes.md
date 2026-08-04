---
id: TASK-0004
title: 'Spike: source inventory for Ohio protected facility classes'
status: To Do
assignee: []
created_date: '2026-08-04 15:59'
labels:
  - 'area:geo'
  - 'kind:spike'
  - 'x:safety'
milestone: m-2
dependencies: []
priority: high
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Find the authoritative source for every facility class ORC 2950.034 names, and establish how complete each one actually is.

Classes needing sources: licensed child care centers and preschools, children's crisis care facilities, and residential infant care centers. Each is held by a different agency in a different format on a different refresh cadence.

The deliverable that matters is not a list of URLs, it is an honest assessment of what each source misses. Home-based and faith-based providers, provisional licenses, and recently opened facilities are the usual gaps, and per Principle I a gap is a safety defect rather than a footnote. If a class has no reliable source, that finding is itself the result and it must reach the coverage manifest.

Also determine refresh cadence per source, which sets the staleness thresholds in TASK-0005.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Authoritative source identified for each state-protected facility class, or its absence documented
- [ ] #2 Known completeness gaps per source documented, with an estimate of what is missed
- [ ] #3 Refresh cadence and access method recorded per source
- [ ] #4 Any class lacking a usable source written up as a coverage limitation for the manifest
- [ ] #5 Findings committed to the repo
<!-- AC:END -->
