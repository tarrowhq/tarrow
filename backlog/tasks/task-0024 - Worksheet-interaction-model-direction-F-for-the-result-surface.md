---
id: TASK-0024
title: Worksheet interaction model (direction F) for the result surface
status: To Do
assignee: []
created_date: '2026-08-07 19:54'
labels:
  - 'x:safety'
dependencies: []
priority: low
ordinal: 40000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Round 2 of TASK-0022 produced direction F, The Worksheet: not a results page at all, but a first-person document partly filled in by tarrow and deliberately BLANK where only the sheriff's office can answer, each blank captioned with who must fill it. Coverage stops being a disclosure section and becomes the visibly unfinished half of the document. It prints.

Preserved artifact: docs/design/round2/f-worksheet.html. Decision record: docs/decisions/task-0022-direction-e-one-card.md.

WHY IT IS CARDED RATHER THAN BUILT. The operator, selecting E: 'I DO like the F (worksheet) style and see how it adheres to our purpose. BUT it does too much for a V1 MVP.' That is the whole rationale and it is a scope judgement, not a rejection. F is the strongest expression of Principle II any direction has reached: it makes the gaps structurally unskippable rather than merely visible, because an unfinished document reads as unfinished in a way a disclosure section never does. Prose has been failing at that since TASK-0017 and F is the first thing that does not.

What makes it a whole interaction model rather than a restyle, and therefore too much for V1: it needs an authored inventory of blanks with an owner for each one; it needs the answer expressed as a filled field rather than a headline, in every one of the five result shapes plus the refusals; it needs a print stylesheet that is load-bearing rather than cosmetic, since carrying the sheet into the phone call is the point; and it needs the first-person voice reconciled against the five copy rules, which are written for a renderer that describes what tarrow found rather than a document that speaks as the reader.

Revisit after the E surface has shipped and been used. The token system and component decomposition TASK-0022 delivers are the substrate F would be built on, so this is additive rather than a rewrite.

Open question to settle before building, carried from the artifact: a worksheet that speaks in the reader's first person is closer to composing words on the reader's behalf than any direction so far. C raised the same question about a spoken script. Whether tarrow may author sentences a reader will say to an official is a Principle I question and should be decided as an artifact before implementation, not during it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The worksheet's blanks are an authored inventory with a named owner per blank, derived from the coverage-gap ledger rather than hand-listed in a component
- [ ] #2 Every result shape including the refusals renders as a worksheet without the answer becoming weaker or the refusal becoming mistakable for a result
- [ ] #3 The printed sheet carries the answer, the gaps, and the sheriff step in full, and is verified as a print artifact rather than assumed
- [ ] #4 The first-person voice is reconciled against the five copy rules in result-view.tsx, and copy.test.ts is extended to cover it
- [ ] #5 The Principle I question about tarrow authoring sentences a reader will say to an official is decided in a tracked decision record before implementation begins
<!-- AC:END -->
