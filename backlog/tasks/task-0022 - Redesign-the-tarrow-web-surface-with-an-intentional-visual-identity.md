---
id: TASK-0022
title: Redesign the tarrow web surface with an intentional visual identity
status: In Progress
assignee: []
created_date: '2026-08-07 13:13'
updated_date: '2026-08-07 17:03'
labels:
  - 'area:web'
  - 'kind:design'
  - 'x:safety'
dependencies: []
priority: high
ordinal: 38000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
tarrow's interface is correct and characterless. Every visual decision to date fell out of a constraint rather than an intention: the type is the system stack because a webfont would leak an IP address, the palette is four accents because a result must be distinguishable from a refusal, and the layout is whatever Tailwind utilities produced while the copy was being fought over. Nothing is wrong. Nothing was designed.

That matters for this product specifically. The reader is a person on a registry, often on a deadline, sometimes on a library computer, asking whether they are allowed to live somewhere. A page that looks like an unstyled internal tool tells that reader they are using something nobody cared about. Trust is the currency here, and visual intent is part of how a helper-not-authority earns it. This is a design task, not a decoration task.

Two halves, both required.

VISUAL: a deliberate identity -- palette, type scale, spatial rhythm, and one signature element -- derived from this subject and audience rather than from a template. Design options are produced as static demo HTML artifacts and the operator chooses among them before any app code is touched. The chosen direction is then implemented as the real surface.

STRUCTURAL: the CSS and components are rebuilt to actual front-end engineering standards -- a token layer, composable primitives, no ad-hoc utility soup at call sites, and a structure the next person can extend without reading all 1089 lines of result-view.tsx. app/app/result-view.tsx is a single file carrying the masthead, every result shape, the coverage manifest, the distance scale, and the sheriff step; app/app/styles.css is 563 lines of tokens and one-off rules with no stated system.

Non-negotiable constraints, all pre-existing and all load-bearing:
- No third-party origin, ever. No webfont, no url() to anywhere, no preconnect (FR-026, Principle III). Fonts stay device-local; identity must be built from what is already on the reader's machine.
- style-src 'self' admits no inline style attribute and no inline <style>. Anything needing a computed value uses SVG presentation attributes, as DistanceScale already does.
- Nothing load-bearing may hide behind JavaScript. Progressive disclosure stays <details>/<summary> and CSS. The answer, the coverage manifest, and the sheriff step are server-rendered on every shape (FR-015).
- The five copy rules and the collapse rule in result-view.tsx survive verbatim: what tarrow did not check stays visible, how tarrow knows what it checked collapses. Never state or imply permission. A refusal and a result stay unmistakable apart by label, headline, border, and structure -- so any new visual language must carry that distinction without relying on colour alone.
- Page order stays answer -> sheriff step -> coverage manifest -> unverified rule -> privacy footnote. Moving the manifest below the fold is a Principle II violation dressed as an IA improvement.
- app/tests/copy.test.ts and the browser suite are the gate. They pass with scripting switched off.

Delivered as one PR off a long-running worktree, developed iteratively with the operator.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Design options are delivered as static demo HTML artifacts covering the search page, an unflagged answer, a flagged answer, and a refusal, and the operator selects one direction before app code changes
- [ ] #2 The chosen direction is written down as a token system -- named colours, a type scale, a spacing rhythm, and the named signature element -- in a tracked design note, so the next editor extends the system rather than guessing at it
- [ ] #3 styles.css is restructured into a stated layer system (tokens, primitives, components) with no unexplained one-off rules, and the no-external-origin comment block survives
- [ ] #4 result-view.tsx is decomposed into reusable components with a single responsibility each, and no component reaches past its own concern
- [ ] #5 A refusal, an unflagged answer, and a flagged answer remain distinguishable without colour -- verified in greyscale and against the existing structural rules
- [ ] #6 The page reads and works on a 360px viewport, with visible keyboard focus and prefers-reduced-motion respected
- [ ] #7 No new dependency, no external origin in the build output (scan-external-origins passes), and no inline style attribute anywhere
- [ ] #8 The full suite including copy.test.ts and the browser suite passes in the container with scripting disabled
- [ ] #9 Page order and the collapse rule are unchanged: manifest above the fold, gaps visible, provenance collapsed
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Worktree .worktrees/task-0022, branch task-0022-redesign.

Round 1 (commit f9da624): three design directions as demo HTML in docs/design/redesign-options/ -- a-instrument.html, b-register.html, c-call-sheet.html. Each carries all four screens (search, outside-every-buffer, within-buffer, refusal) using the real copy from result-view.tsx rather than placeholder text, so a direction is judged on the sentences that actually ship.

A (Instrument): mono headlines because the headline is a measurement; ruled measurement rail; signature is one shared distance scale carrying every flagged premises on a single axis.
B (Register): coverage manifest as a sticky column BESIDE the answer rather than a section below it, taking Principle II literally in the layout; three typographic voices (serif written / sans labels / mono read).
C (Call Sheet): the page as the thing carried into the sheriff phone call; one reversed-ink card with a numbered spoken script; the answer deliberately quieter than the instruction. Raises an open question, noted in the file: composing a spoken script from the result is the closest any direction comes to the renderer stating something the result did not.

Awaiting operator selection. No app code touched.

Process finding, worth carrying: the card was created BEFORE the worktree was cut from origin/main, so the branch never contained it and the CLI could not see it from inside the worktree. Cut the worktree first, or commit the card, before starting work.
<!-- SECTION:NOTES:END -->
