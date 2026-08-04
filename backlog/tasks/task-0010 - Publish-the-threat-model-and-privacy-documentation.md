---
id: TASK-0010
title: Publish the threat model and privacy documentation
status: To Do
assignee: []
created_date: '2026-08-04 16:00'
labels:
  - 'area:docs'
  - 'kind:feature'
  - 'x:privacy'
milestone: m-4
dependencies:
  - TASK-0002
priority: high
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Write down what somap holds, what it does not, who the adversaries are, and how an outsider can check our claims.

Principle III assumes users need to KNOW their data is private rather than be told it is, which makes this a verification document rather than a privacy policy. Name the adversaries plainly: subpoena, hostile landlords, harassment campaigns, and our own compromise. State honestly what each control does and does not defend against, including that encryption at rest defends against a stolen disk and nothing else.

This is also the artifact an advocacy organization reads before deciding whether to send anyone here. Write for that reader.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Threat model names adversaries and states what is and is not defended against
- [ ] #2 A plain-language page lists exactly what is stored, where, and for how long
- [ ] #3 Verification steps documented so a technical reader can independently confirm the claims
- [ ] #4 Known residual risks stated rather than omitted
- [ ] #5 Reviewed by someone outside the project before publication
<!-- AC:END -->
