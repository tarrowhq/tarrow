---
id: TASK-0006
title: 'Spike: enumerate Summit County municipal residency ordinances'
status: To Do
assignee: []
created_date: '2026-08-04 15:59'
labels:
  - 'area:legal'
  - 'kind:spike'
  - 'x:safety'
milestone: m-3
dependencies: []
references:
  - 'https://ohrsol.com/resources/residency-restrictions/'
priority: high
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Establish the actual municipal layer for Summit County: which political subdivisions have their own residency ordinance, what each says, and where its text lives.

Ohio does not preempt local restriction, so this layer is real and it is where the genuine difficulty of the project lives. Observed examples elsewhere in Ohio (Norwood 533.14, East Cleveland 533.16, Reading 666.17, Parma 666.19) show buffers reaching 2,000 to 2,500 feet and protected classes extending to parks, playgrounds, libraries, pools, and non-school athletic fields.

The inventory must distinguish three states per subdivision: has an ordinance, verified to have none, and not yet checked. Under Principle VI the jurisdiction cannot be claimed while any subdivision sits in the third state, and conflating not-checked with none is the exact failure this task exists to prevent.

Municipal code often lives on third-party hosts with unstable URLs, or is not online at all. Where text is unavailable online, record how it was obtained.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every Summit County political subdivision listed as: has ordinance, verified none, or not checked
- [ ] #2 For each ordinance found: citation, source location, buffer distance, protected classes named
- [ ] #3 Subdivisions whose code is unavailable online identified with a plan for obtaining text
- [ ] #4 Inventory committed in a form the rule authoring work can consume
- [ ] #5 Count of subdivisions in each state reported, so remaining work is visible
<!-- AC:END -->
