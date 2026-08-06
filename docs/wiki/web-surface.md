---
name: web-surface
description: The React Router 7 routes, the decision to ship no client-side JavaScript at all, and how a POST keeps the searched address out of every URL, history entry, and proxy log.
kind: component
sources:
  - app/app/root.tsx
  - app/app/routes.ts
  - app/app/routes/_index.tsx
  - app/app/routes/answer.tsx
  - app/app/routes/faq.tsx
  - app/app/entry.server.tsx
  - app/react-router.config.ts
verified_against: b5b247a6cb390ba505c674f0c77af551dd547949
---

# Web surface

Three routes: `/` (the address form), `/answer` (POST only), and `/faq`. React Router 7 in
SSR mode, chosen because its form-action model degrades to working HTML with JavaScript
disabled — which, for this population, is a safety property rather than an ergonomic one.

## How it works

**No client-side JavaScript, anywhere.** `app/app/root.tsx` omits `<Scripts />` and
`<ScrollRestoration />`. The reasoning is recorded in the file: the CSP's `script-src 'self'`
carries no `'unsafe-inline'` and no nonce, React Router's hydration bootstrap is three inline
`<script>` blocks, and a browser refuses them under that policy. Of the three ways out —
weaken the policy, leave the blocked scripts in, or ship no script — only the third does not
soften a gate. A policy that admits tarrow's own inline script admits every other one, which
is the hole an analytics snippet walks through. `script-src 'self'` then describes something
trivially checkable: view source, and there is no script to reason about.

The consequence is binding on future work, and `root.tsx` says so directly: no component may
require hydration. Forms are `<Form method="post">`, which renders a real `<form>` the browser
submits natively; progressive disclosure is `<details>`/`<summary>` and CSS. The stylesheet is
a same-origin built asset, not an inline `<style>`, because `style-src 'self'` blocks those
for the same reason.

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
an inline script and `console.error`s the error while rendering — which on a 404 prints the
searched path to the container log. It deliberately never calls `useRouteError()`: it takes
nothing from the error at all, and instead withdraws every coverage claim explicitly rather
than leaving a silence a reader could mistake for reassurance.

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
