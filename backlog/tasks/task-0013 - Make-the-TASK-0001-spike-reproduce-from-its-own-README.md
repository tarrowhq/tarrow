---
id: TASK-0013
title: Make the TASK-0001 spike reproduce from its own README
status: To Do
assignee: []
created_date: '2026-08-05 02:44'
labels:
  - 'area:docs'
  - 'kind:bug'
  - 'x:safety'
dependencies: []
priority: medium
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The TASK-0001 spike's README documents a command sequence that does not stand alone. 07_measure_final.sql depends on columns (geom_m, norm_addr) created by 03_measure.sql and 04_measure_v2.sql, which the README never instructs the reader to run — despite 07 describing itself as self-contained.

Found during TASK-0002 P1, which reproduced RESULTS.md's numbers (96.79 / 0.21 / 1.75 / 1.24 against a published 96.79 / 0.20 / 1.75 / 1.26) only by running the extra scripts. Not fixed there because ruling R2 of the TASK-0002 runbook freezes spikes/ so the evidence base could not shift under the slice being built on it.

This matters beyond tidiness. Principle VII requires somap be reproducible by someone who has never spoken to us, and Principle V says a measurement produced in an environment nobody else can reconstruct is an anecdote. The measurement engine reproduces; the published instructions for reproducing it do not. So the accuracy claim currently holds for us and not for a stranger, which is exactly the asymmetry both principles exist to close.

Two candidate fixes, either acceptable: correct the README's step list to name every script in order, or fold 03/04's column creation into 07 so it becomes genuinely self-contained as it claims. Prefer whichever leaves the published numbers reproducible from a clean clone with no prior knowledge.

Do not change the measurement logic or the numbers. This is a documentation and reproducibility defect, not a correctness one.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A clean clone reproduces RESULTS.md's published figures following only the README, with no prior knowledge
- [ ] #2 The published numbers are unchanged; only the instructions or script self-containment change
<!-- AC:END -->
