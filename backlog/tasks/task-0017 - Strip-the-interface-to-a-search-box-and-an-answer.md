---
id: TASK-0017
title: Strip the interface to a search box and an answer
status: Done
assignee: []
created_date: '2026-08-05 19:39'
updated_date: '2026-08-05 20:27'
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
- [x] #1 The home page is a masthead, one line of explanation, the address field, and a link to the FAQ — nothing else above the field
- [x] #2 A /faq route carries what somap is, how to read an answer, what is not checked, and how the typed address is treated, and requires no JavaScript
- [x] #3 A result leads with the finding and the flagged locations; supporting detail is reachable in one click and is present in the served HTML
- [x] #4 The coverage manifest headline absences remain visible on every result, not collapsed (Principle II)
- [x] #5 copy.test.ts scans the /faq shape alongside the others and the whole suite passes in the container
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented on task-0017-simplify-ui (commit 370ddd0). Not pushed -- operator is reviewing it running locally first.

Search page is now wordmark + question + field + one called-out notice (does not correct spelling, does not guess) + a blurb linking /faq. /faq is a new database-free, script-free route carrying what somap measures, what it is not, what it does not check, how to read each of the three answer kinds, what happens to the typed address, and data age. Answers lead with the finding and the flagged premises.

Rule adopted for the answer page, recorded in result-view.tsx so it is applied rather than reversed: WHAT SOMAP DID NOT CHECK STAYS VISIBLE; HOW SOMAP KNOWS WHAT IT CHECKED COLLAPSES. New test fails if any ledger gap ends up inside a <details>.

FINDING, worth its own attention: four suites in copy.test.ts were registering ZERO tests -- their loops iterated the array before() fills, which node:test has not filled at describe-collection time. Dead gates were the sheriff step (FR-013), the per-shape coverage manifest (Principle II), never-human-verified per layer (Principle V), and no-script/no-off-origin (FR-026). Two of those assertions were also independently wrong and had never had the chance to fail: the layer check counted the whole document rather than the registry table's rows, and the staleness regex spanned an interpolation boundary that React SSR splits with <!-- -->, so it was unsatisfiable as written. Repaired by declaring the shape roster as data. 150 -> 216 tests, only ~10 of them genuinely new.

Scope decision recorded: the sheriff step is required on every result and on the three pages a reader lands on instead of one, and NOT on the search page or /faq, matching FR-013's wording. A test asserts /faq carries the sentence the search page gave up, so it cannot be silently deleted.

Also fixed a real defect: Tailwind preflight sets text-decoration:inherit on anchors, so with color:inherit every link was drawn as body text and was invisible as a link.

Verified in the container: 216/216 and 3/3 browser tests.

Open: TASK-0008.01 (nonce vs zero-JS) is untouched and still open -- this work stayed at zero JS and used <details> throughout, which is evidence for that decision rather than a pre-empting of it. AC #2 (non-technical reader) and AC #5 (advocacy review) of TASK-0008 remain the real tests of this copy; nothing here substitutes for them.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Search page cut to a wordmark, one question, the field, a called-out do-not-guess notice, and a blurb linking /faq. New /faq route carries what somap measures, what it is not, what it does not check, how to read each of the three answer kinds, what happens to the typed address, and data age; no database and no JavaScript, so it loads when the database is down. Answers lead with the finding and the flagged premises.

Rule recorded in result-view.tsx so a future editor applies rather than reverses it: WHAT SOMAP DID NOT CHECK STAYS VISIBLE; HOW SOMAP KNOWS WHAT IT CHECKED COLLAPSES. A test fails if a ledger gap ends up inside a <details>. Principle II's list still renders on every result from the coverage-gap ledger and did not move to /faq -- a link is not a statement.

Found along the way: four suites in copy.test.ts were registering ZERO tests, because their loops iterated the array before() fills and node:test runs describe callbacks at collection time. Dead gates were the sheriff step (FR-013), the per-shape coverage manifest (Principle II), never-human-verified per layer (Principle V), and no-script/no-off-origin (FR-026). Two of those assertions were also independently unsatisfiable: the layer check counted the whole document rather than the registry table's rows, and the staleness regex spanned an interpolation boundary React SSR splits with an HTML comment. Repaired by declaring the shape roster as data. 150 -> 216 tests, only ~10 genuinely new.

Also fixed a real defect: Tailwind preflight sets text-decoration:inherit on anchors, so with color:inherit every link rendered as body text. Scope decision recorded: the sheriff step is required on every result and on the three pages a reader lands on instead of one, not on the search page or /faq, matching FR-013's wording, with a test asserting /faq carries the sentence the search page gave up. Final commit humanized every rendered string against the Signs of AI writing patterns.

Verified in the container: 216/216 and 3/3 browser tests. PR #12, merged as 909fb06.

Open and not addressed here: TASK-0008.01 (nonce vs zero JS) stays open -- this work stayed at zero JS throughout, which is evidence for that decision rather than a pre-empting of it. TASK-0008 AC #2 (tested with a non-technical reader) and AC #5 (advocacy organization review) remain the real tests of this copy.
<!-- SECTION:FINAL_SUMMARY:END -->
