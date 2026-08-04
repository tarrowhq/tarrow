---
id: TASK-0007
title: Stack Summit County municipal rules on top of the state rule
status: To Do
assignee: []
created_date: '2026-08-04 15:59'
labels:
  - 'area:legal'
  - 'kind:feature'
  - 'x:safety'
milestone: m-3
dependencies:
  - TASK-0005
  - TASK-0006
priority: high
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Complete the jurisdiction: municipal ordinances authored and verified, their POI classes loaded, and rule resolution that evaluates state and local rules together for an address.

Rules stack rather than override. An address can be clear of the state buffer and inside a municipal one, so evaluation must apply every governing rule set. Determining which rules govern requires municipal boundary geometry, which brings edge cases: annexed parcels, townships, and unincorporated areas where only the state rule applies. Per Principle I, ambiguity about which jurisdiction governs resolves toward applying more rules rather than fewer.

A subdivision verified to have no ordinance is itself a rule record asserting the state rule alone applies there. It is not an absence of data, and the manifest must be able to tell a user which of the two they are looking at.

Landing this completes Summit County under Principle VI.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every subdivision with an ordinance has verified rule records with full provenance, passing the build gate
- [ ] #2 Every subdivision verified to have no ordinance is recorded as such, distinct from unchecked
- [ ] #3 Locally-defined protected classes mapped to the controlled vocabulary, with mismatches documented
- [ ] #4 POI layers loaded for every class named by an ordinance; classes without a usable source surfaced as limitations
- [ ] #5 Municipal boundaries loaded; a coordinate resolves to its governing subdivisions
- [ ] #6 All applicable rules evaluated together; boundary-adjacent cases resolve toward applying more rules
- [ ] #7 Townships and unincorporated areas handled explicitly rather than falling through
- [ ] #8 Coverage manifest reports which rule sets were applied and which are absent for the location
<!-- AC:END -->
