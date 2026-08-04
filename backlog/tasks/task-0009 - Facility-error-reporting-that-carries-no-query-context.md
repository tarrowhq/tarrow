---
id: TASK-0009
title: Facility error reporting that carries no query context
status: To Do
assignee: []
created_date: '2026-08-04 16:00'
labels:
  - 'area:web'
  - 'kind:feature'
  - 'x:privacy'
milestone: m-4
dependencies:
  - TASK-0002
priority: high
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Let users tell us a facility is wrong, missing, or closed, without telling us anything about themselves.

This is the correction loop that makes our disclosure honest rather than an excuse: we say we may be wrong, so there must be a way to be told.

The privacy hazard is subtle and must be designed against explicitly. A report naturally wants to carry context, and that context is the address the user searched — the one datum Principle III identifies as uniquely dangerous. A report carries the facility and the claim, never the query that surfaced it, never a session or device identifier, and never anything that links two reports to one person.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Users can report a facility as wrong, missing, or closed from the result view
- [ ] #2 Reports carry facility and claim only; no address, coordinate, session, or device identifier
- [ ] #3 Two reports from the same person are not linkable, verified by test
- [ ] #4 A triage path exists for reviewing reports and correcting source data
- [ ] #5 Users are told what the report does and does not include
<!-- AC:END -->
