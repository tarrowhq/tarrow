---
id: TASK-0005
title: Complete ORC 2950.034 facility coverage for Summit County
status: To Do
assignee: []
created_date: '2026-08-04 15:59'
labels:
  - 'area:etl'
  - 'kind:feature'
  - 'x:safety'
milestone: m-2
dependencies:
  - TASK-0003
  - TASK-0004
priority: high
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Load every facility class the state statute protects, so the state-level answer for Summit County is complete for the first time.

This is the release that becomes promotable to real users. Until it lands, the coverage manifest is reporting real and dangerous gaps; after it lands, the state layer is whole and the remaining gap is municipal.

Child care is the highest under-restriction risk in the project: providers open, close, and relocate constantly, and license databases lag reality. Freshness is a correctness property of that layer, not an operational nicety, which is why staleness tracking ships in the same slice rather than later.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All state-protected facility classes loaded for Summit County with geometry and provenance
- [ ] #2 Classes with no qualifying facilities recorded as verified findings, distinguishable from unloaded layers
- [ ] #3 Each layer carries a last-refreshed date and a staleness threshold derived from its source cadence
- [ ] #4 Stale layers are reported as stale in the coverage manifest rather than removed or silently served
- [ ] #5 Gaps documented in TASK-0004 propagate into the coverage manifest
- [ ] #6 Operational alerting fires when a layer passes its staleness threshold
<!-- AC:END -->
