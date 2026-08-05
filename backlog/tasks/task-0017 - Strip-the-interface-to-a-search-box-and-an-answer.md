---
id: TASK-0017
title: Strip the interface to a search box and an answer
status: In Progress
assignee: []
created_date: '2026-08-05 19:39'
updated_date: '2026-08-05 19:39'
labels:
  - 'x:safety'
dependencies: []
priority: high
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The interface is written as a wall of prose. The home page carries four explanatory paragraphs and a four-bullet callout before the address field; every result page carries the answer plus six full-length sections of qualification. A reader under a thirty-day order to move does not read that, which means the disclosure it exists to deliver is not delivered — Principle II is satisfied on the wire and failed in the head.

Reduce the surface to two things: a search field with one line of explanation, and an answer that leads with what was found and where. Every word removed from those two surfaces is RELOCATED, never deleted: a real /faq route carries what somap is, how to read an answer, what is not checked, and how the typed address is treated.

Constraint that shapes the whole change: Principle II binds every RESULT — what was checked and what was not must remain in the server-rendered document. Spec FR-015 permits it to be visually collapsed but never absent, and somap ships zero client-side JavaScript (TASK-0008.01 is still open), so the only mechanism is <details>/<summary>. Nothing may move behind script, and the headline absences stay visible rather than collapsed.

app/tests/copy.test.ts is the gate: it reads the bytes off the wire for every page shape. The new /faq route is rendered copy and is added to the shapes it scans.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The home page is a masthead, one line of explanation, the address field, and a link to the FAQ — nothing else above the field
- [ ] #2 A /faq route carries what somap is, how to read an answer, what is not checked, and how the typed address is treated, and requires no JavaScript
- [ ] #3 A result leads with the finding and the flagged locations; supporting detail is reachable in one click and is present in the served HTML
- [ ] #4 The coverage manifest headline absences remain visible on every result, not collapsed (Principle II)
- [ ] #5 copy.test.ts scans the /faq shape alongside the others and the whole suite passes in the container
<!-- AC:END -->
