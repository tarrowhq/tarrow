---
id: TASK-0015
title: The form is rejected in every Chromium browser
status: To Do
assignee: []
created_date: '2026-08-05 13:39'
updated_date: '2026-08-05 13:44'
labels:
  - 'area:web'
  - 'kind:bug'
  - 'x:safety'
dependencies: []
priority: high
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
somap is unusable in any Chromium browser. The landing page renders; submitting the address form returns a bare 400 Bad Request from React Router before any somap code runs. TASK-0002 AC #1 -- a user can enter an address and receive school proximity results -- is false in practice.

Root cause. Referrer-Policy: no-referrer, added in TASK-0002 P4 as privacy hardening, causes Chromium to send Origin: null on a cross-document form POST. React Router 7's built-in origin check rejects a null origin with 400.

Isolated three ways against the running composition, 2026-08-05:

  no-referrer as shipped     -> Origin: null                     -> 400
  header stripped by a proxy -> Origin: http://localhost:3006    -> 200
  rewritten to same-origin   -> Origin: http://localhost:3007    -> 200, real answer renders

And directly, bypassing the browser entirely:

  no Origin header             -> 200
  Origin: http://localhost:3000 -> 200
  Origin: null                 -> 400

The two mechanisms are individually correct and jointly fatal. Neither is a mistake on its own.

Fix, already verified end to end in Brave: Referrer-Policy: same-origin. It concedes nothing that matters. Cross-origin requests still send no referrer, so the sheriff-guidance links leak nothing. Same-origin requests send a referrer of the site root, which carries no address, because the address travels in a POST body and never appears in a URL -- which is the property the form was deliberately built around.

Second half, and the more important one. Nothing in the 146-test suite could have caught this: every test reaches the app through fetch()/undici, which does not implement referrer policy, so the test client always sends a proper Origin or none -- the two cases that pass. P5's clean-clone verification used curl. The orchestrator's independent verification also used curl, and checked the rendered HTML of all four result shapes by fetching them directly rather than by submitting the form. The response bodies were verified exhaustively and the interaction was never verified at all.

So this task also adds a browser-driven test to the composition: load the page in headless Chromium, submit the form, assert a real premises renders. That exercises referrer policy, CSP, and the zero-JS path as a browser actually applies them, rather than as a fetch client ignores them. Chromium must be multi-arch per Principle VII.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Submitting the address form in a real Chromium browser returns a result, not a 400
- [ ] #2 Cross-origin requests still send no referrer, so outbound links leak nothing
- [ ] #3 A browser-driven test in the compose test profile loads the page, submits the form, and asserts a premises renders
- [ ] #4 The browser used by that test builds and runs on both linux/amd64 and linux/arm64
- [ ] #5 TASK-0002 AC #1 is re-ticked, against a browser rather than against a curl
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fix scope, stated precisely so it is not misread later: the change makes the BROWSER stop sending Origin: null. It does not make the SERVER accept a null origin -- verified after the change, Origin: null still returns 400. React Router's rejection of a null origin is CSRF protection and was left intact. That leaves a residual case worth knowing about: anything else that produces a null origin (a sandboxed iframe, a data: document, a privacy extension that strips or nulls Origin) still breaks the form. This population uses privacy extensions, so that is not hypothetical. Whether somap should also accept a null origin is a separate security decision and is deliberately not taken here -- though the argument is unusually strong for this app: somap has no cookies, no sessions, and no state-changing operations, so a forged request performs a search on the victim's behalf with no side effect and nothing to steal, which is close to the definition of a non-threat. Raise it as its own card rather than folding it into a bug fix.
<!-- SECTION:NOTES:END -->
