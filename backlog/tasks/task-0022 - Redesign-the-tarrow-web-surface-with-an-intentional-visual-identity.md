---
id: TASK-0022
title: Redesign the tarrow web surface with an intentional visual identity
status: In Progress
assignee: []
created_date: '2026-08-07 13:13'
updated_date: '2026-08-07 20:45'
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
- [x] #1 Design options are delivered as static demo HTML artifacts covering the search page, an unflagged answer, a flagged answer, and a refusal
- [x] #2 The operator selects one direction, recorded as a tracked decision, before app code changes
- [x] #3 The chosen direction is written down as a token system -- named colours, a type scale, a spacing rhythm, and the named signature element -- in a tracked design note, so the next editor extends the system rather than guessing at it
- [x] #4 styles.css is restructured into a stated layer system (tokens, primitives, components) with no unexplained one-off rules, and the no-external-origin comment block survives
- [x] #5 result-view.tsx is decomposed into reusable components with a single responsibility each, and no component reaches past its own concern
- [x] #6 A refusal, an unflagged answer, and a flagged answer remain distinguishable without colour -- verified in greyscale and against the existing structural rules
- [x] #7 The page reads and works on a 360px viewport, with visible keyboard focus and prefers-reduced-motion respected
- [x] #8 No new dependency, no external origin in the build output (scan-external-origins passes), and no inline style attribute anywhere
- [x] #9 The full suite including copy.test.ts and the browser suite passes in the container with scripting disabled
- [x] #10 Page order and the collapse rule are unchanged: manifest above the fold, gaps visible, provenance collapsed
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

Round 1b (dacadd2): verified all three directions render in dark mode as well as light. Found and fixed a demo-chrome bug -- the specimen header painted its background from --ink, which flips light in dark mode, while its text colours were literals, washing the block out. Pinned to fixed dark chrome in all three files; it is specimen furniture and should not theme at all. No direction's design changed.

Claim branch pushed to origin/task-0022-redesign (was committed but unpushed). Duplicate card file removed from the root checkout now that the card lives on the branch.

AWAITING OPERATOR SELECTION among A (Instrument), B (Register), C (Call Sheet). Phase 3 -> 4 boundary: no app code touched, no direction implemented.

Round 2 (8ad1bfc): docs/design/round2/ -- D, E, F.

Operator rejected all of round 1: 'They are all the same basic UI same basic structure same basic everything.' Correct -- A/B/C differed in paint (type, palette, one column position) but shared a page shape: masthead, answer block, stacked prose sections. Also asked for the existing UI and its guidelines to be thrown out, keeping security-mindedness but going wide.

Round 2 varies STRUCTURE, not style:

D -- The Survey. Answers the geometric question geometrically: a survey plat with the address as a parcel, the buffer as a ring, schools as hatched parcels, distances as annotated dimension lines. Zero body copy on the result screen; prose is drawing labels plus numbered margin notes. Fetches nothing -- SVG from geometry already in Postgres -- so it adds no request and is MORE private than the text version.

E -- One Card. Inverse bet: one full screen per idea. The finding owns a screen alone; each premises, each gap, the sheriff step are their own full-screen cards. CSS scroll-snap, no script; degrades to a long page with scripting off. Commits to a single dark world.

F -- The Worksheet. No results page: a first-person worksheet, partly filled by tarrow, deliberately BLANK where only the sheriff can answer, each blank captioned with who must fill it. Coverage becomes the unfinished half of the document rather than a disclosure section. Prints.

AWAITING OPERATOR SELECTION among D, E, F (or a hybrid, or another turn). No app code touched.

SELECTION (2026-08-07): E -- One Card. Recorded as docs/decisions/task-0022-direction-e-one-card.md.

D and F are preserved rather than discarded, each carded with its artifact cited:
- TASK-0023 -- direction D (The Survey), to be rebuilt on a real map engine. NOT Mapbox: its bundle, style, glyphs and tiles come from api.mapbox.com, and a tile request's path IS the coordinate being viewed -- which here is the address somebody on a registry just typed. That hands a third party the reader's IP, the referrer, and the queried location on every answer. The available engine is MapLibre GL JS vendored to our own origin over self-hosted PMTiles built from geometry already in Postgres.
- TASK-0024 -- direction F (The Worksheet). Operator: 'I DO like the F (worksheet) style and see how it adheres to our purpose. BUT it does too much for a V1 MVP.' Preserved as the strongest expression of Principle II found so far; revisit after E ships. Carries an open Principle I question about tarrow authoring first-person sentences a reader will say to an official.

AC #1 was compound (options delivered AND operator selects). Split into #1 (delivered, true at round 2) and #2 (selection, true now); both ticked.

IMPLEMENTED (commit 5ad9044). Direction E is the surface.

Structure: the deck is the page; each idea gets one full-viewport card, snapped with CSS scroll-snap (proximity, not mandatory -- a card taller than the viewport must stay freely scrollable or content strands off-screen, which is the exact failure rule 5 names). No script anywhere in the mechanism.

Files: docs/design/tarrow-design-system.md is the written system (AC #3). styles.css rebuilt into four stated layers. result-view.tsx 1089 -> ~490 lines keeping only the five shapes and their assembly order; the rest split into cards.tsx (primitives), finding-view.tsx (what tarrow found), manifest-view.tsx (what it did not check).

Verification actually run, not assumed:
- 221/221 main suite, browser suite 3/3 including the scripting-off path
- typecheck clean, scan-external-origins clean
- zero inline style attributes in the served flagged answer (grep of the wire)
- rendered at 360px; greyscale checked with Chromium achromatopsia emulation, not by argument -- flagged is a solid left edge plus a numeral, the refusal is a dashed edge plus an em-dash, and the labels and headlines differ

Two test gates repointed at renamed markers WITHOUT weakening them: the answer label now hangs off an explicit data-answer-label attribute rather than a class name (a styling hook could be renamed by a restyle and take the gate with it; an attribute that exists only to be asserted cannot), and answer--x became card--x.

ONE PRE-EXISTING BUG FOUND AND FIXED, unrelated to this redesign. tests/browser/form.test.ts asserted the form POST through waitForNavigation(), correct while the app shipped no client script. TASK-0008.01 restored hydration, so <Form> submits by fetch to /answer.data and navigates on the client -- no document navigation, so the assertion compared undefined against 200 and always failed. Confirmed pre-existing by checking out the pre-redesign tree and running it there: same failure. The POST is now captured off the network, covering both the hydrated and scripting-off paths.

Also worth recording for whoever runs this next: the worktree's database starts empty, and every result shape is search-failed until 'docker compose --profile etl run --rm etl' is run. 54 tests fail before that and it looks like a code regression.
<!-- SECTION:NOTES:END -->
