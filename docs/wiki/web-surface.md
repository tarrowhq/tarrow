---
name: web-surface
description: The React Router 7 routes, the rule that nothing load-bearing may hide behind hydration even though first-party script now ships, and how a POST keeps the searched address out of every URL, history entry, and proxy log.
kind: component
sources:
  - app/app/root.tsx
  - app/app/routes.ts
  - app/app/routes/_index.tsx
  - app/app/routes/answer.tsx
  - app/app/routes/faq.tsx
  - app/app/entry.server.tsx
  - app/react-router.config.ts
verified_against: 6d60a311a4e38c2e7520aa71dc141ac5bd014599
---

# Web surface

Three routes: `/` (the address form), `/answer` (POST only), and `/faq`. React Router 7 in
SSR mode, chosen because its form-action model degrades to working HTML with JavaScript
disabled — which, for this population, is a safety property rather than an ergonomic one.

## How it works

**The page hydrates, and nothing load-bearing waits for it.** `app/app/root.tsx` renders
`<Scripts />` and `<ScrollRestoration />`, whose inline bootstrap blocks are admitted by the
per-response nonce in the CSP. Neither carries a `nonce` prop here: `entry.server.tsx` reads
the value back off the response's own CSP header and hands it to `<ServerRouter>`, which
passes it to every nonce-aware component — one seam, in the only place the header is in
scope, so a tag can never be stamped with a value the policy did not admit.

The file also records what this replaced and why the replacement is not a loosening. tarrow
used to omit `<Scripts />` entirely and ship no client JavaScript at all. That was never a
requirement and never a decision: it fell out of the nonce-free CSP string written in the
TASK-0002 runbook. Principle III forbids third-party scripts, analytics, and request logs, and
FR-025/FR-026 scope third-party *origins* — first-party script was never in question. See
`docs/decisions/task-0008-01-nonce.md`.

What survived is the rule that matters: **no component may put anything load-bearing behind
script.** Forms are `<Form method="post">`, which renders a real `<form>` the browser submits
natively; progressive disclosure is `<details>`/`<summary>` and CSS. The answer, the coverage
manifest, and the sheriff step are server-rendered on every shape (FR-015), and the whole flow
is tested with scripting switched off (SC-001, User Story 4 scenario 4,
`app/tests/browser/form.test.ts`). For somebody browsing defensively or on a locked-down
library machine, that is the only mode, not a degraded one.

The stylesheet is a same-origin built asset, not an inline `<style>`, and there is no `style=`
attribute anywhere in the app: `style-src 'self'` admits neither, and unlike `script-src` it
carries no nonce, so there is nothing to relax. Anything needing a computed value in the
document — the distance scale in `result-view.tsx` — uses SVG presentation attributes, which
are not CSS and not covered by that clause.

**The address lives in a POST body.** `routes/answer.tsx` answers `action` only, never a
`loader`. The address therefore never reaches a URL — not the address bar, not browser
history, not a `Referer` header, not a future proxy's access log. `meta()` returns a static
title, because a title carrying the address would put it in the tab, the window title, and
the history entry. A plain GET to `/answer` — a bookmark, a refresh, a back button — is a
real state and renders `NothingWasSubmitted`, not an empty result shape.

The route computes nothing. It hands the typed string to `search()` and the returned result
to `ResultPage`. There is no branch on whether anything was found, no count, no threshold,
"and nothing that could become one."

`root.tsx` also defines an `ErrorBoundary`, present because React Router's default one emits
an inline script carrying no nonce — which the browser refuses, leaving dead code a reader
inspecting source cannot account for — and `console.error`s the error while rendering, which
on a 404 prints the searched path to the container log. It deliberately never calls
`useRouteError()`: it takes nothing from the error at all, and instead withdraws every
coverage claim explicitly rather than leaving a silence a reader could mistake for
reassurance.

Restoring `<Scripts />` opened a second path for the same datum, closed in the same commit.
React Router serializes `staticHandlerContext` into the hydration payload, and on a request to
an unmatched route that context holds `No route matches URL "/search/<the typed address>"` —
which would write the address into the document and the back-button cache. `entry.server.tsx`
scrubs it: `withoutErrorDetail` drops error messages and the `serverHandoffStream` that
carries them verbatim, keeping only `status`/`statusText`, neither of which can hold a URL.
`copy.test.ts` caught this the moment `<Scripts />` returned.

## Connections

- [[http-envelope]] serves these documents and sets the CSP this design follows.
- [[answer-rendering]] is `app/result-view.tsx`, where the result becomes words.
- [[search-orchestration]] is what the action calls.
- [[process-output-seal]] closes the framework log sites this boundary exists beside.

## Operational notes

`app/scripts/scan-external-origins.mjs` runs as a build step and fails if any built asset
references an external origin. `root.tsx` also declines `preconnect` and `dns-prefetch` links
and any off-origin favicon, since a preconnect contacts a third party before the page renders
a pixel. The browser suite (`app/tests/browser/form.test.ts`) exists because a fetch-only
suite cannot produce bugs only a browser can — see [[test-suite]].
