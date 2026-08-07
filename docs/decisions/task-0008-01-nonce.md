# TASK-0008.01 — First-party JavaScript is permitted; the CSP carries a per-response nonce

**Status:** decided
**Date:** 2026-08-07
**Supersedes:** the `script-src 'self'` clause specified in
`docs/design/task-0002-walking-skeleton-runbook.md` Lane 0

---

## The decision

`script-src` admits `'self'` and a per-response nonce. React Router's hydration bootstrap is
restored. First-party JavaScript — including Radix-backed shadcn components — is available for
interface work where it earns its place.

`'unsafe-inline'` is **not** admitted, and adding it later would defeat the whole mechanism: a
nonce beside `'unsafe-inline'` admits everything and is worth nothing. Two tests hold that line.

Nothing about third-party origins changes. `default-src`, `connect-src`, `base-uri`,
`form-action`, and `frame-ancestors` are exactly as they were, and the build-time scan
(`app/scripts/scan-external-origins.mjs`) still fails the image on any external URL in the
output.

## Why this needed deciding at all

tarrow shipped no client-side JavaScript. That state was never chosen, and no principle asked
for it.

It fell out of one string. The TASK-0002 runbook specified `script-src 'self'` with no nonce
and no hash allowance in Lane 0. React Router's hydration bootstrap is three inline `<script>`
blocks whose content varies per request — the scroll restore, `window.__reactRouterContext`,
and the route manifest — so a browser refused them. Phase 4 hit the gate, correctly declined to
soften an operator-signed policy mid-phase, and removed the client bundle instead.

The runbook records this honestly at its 2026-08-04 checkpoint:

> zero-JS was required by no principle. AC #6 governs third-party *origins* and permits
> first-party JavaScript entirely. It fell out of the CSP string *this runbook* specified in
> Lane 0. Hashes cannot rescue it either — the context script's content varies per request, so
> no `sha256-` source expression can match; a nonce is the only route.

What made it worth revisiting is that everything downstream was then written to defend the
accident as though it were a principle: the tests, the wiki notes, the published verification
procedure, and a `PHASE 5, READ THIS: you may not add a component that requires hydration`
directive in `root.tsx`. A constraint nobody chose was closing off interface work for the
people this is for.

Checked before deciding:

- **The constitution does not forbid first-party script.** Principle III forbids analytics,
  third-party scripts, and request logs (`.specify/memory/constitution.md`).
- **FR-025 and FR-026 are origin-scoped, not script-scoped.** Both are satisfied by a
  first-party nonce, and both are still enforced by the same directives as before.
- **SC-001 and User Story 4 scenario 4 are about degradation, not absence.** They require the
  flow to work with JavaScript disabled. That still holds and is still tested.

## The privacy objection, and what changed about it

The spike recorded the case for staying at zero, so it would not have to be re-derived. Two of
its three arguments survive; one turned out to be wrong on inspection.

**"Hydration puts the searched address into client router state."** This is not the case. The
action in `app/app/routes/answer.tsx` consumes the typed string and returns only `search()`'s
result. `SearchResult` carries the *county's* label for the parcel it matched
(`ResolvedResidence.siteAddress`, `addressLabel`) — never the string the user typed. The
hydration context React Router serializes therefore contains no user input. The two are
frequently identical in practice, because the county label is what the user was typing toward,
but the datum reaching the page is the one the county publishes about a parcel, not a record of
what somebody asked.

**"A client bundle is the same failure mode as the three RR7 leaks, on a larger surface."**
This was right, and the work proved it immediately. Restoring `<Scripts />` reintroduced the
404 leak through a new pipe: React Router serializes `staticHandlerContext` into an inline
script for the client to resume from, and on a request matching no route that context holds
`Error: No route matches URL "/search/<what was typed>"`. The address would have reached the
page, the back-button cache, and the screen of a shared computer.

`app/tests/copy.test.ts` caught it on the first run. The fix is `withoutErrorDetail()` in
`app/app/entry.server.tsx`, which strips error messages and drops `serverHandoffStream`
whenever the render carries an error. Both carriers, because closing one and not the other
looks fixed and is not. This is the third change to that file; the other two exist for the same
datum reaching stderr.

**"View source and count the script tags is a check a caseworker can run; reading a bundle is
not."** This one is real and is the genuine cost. It is answered below rather than dismissed.

## What replaces the verification step

`docs/privacy/verification.md` step 4 used to be: view source, count the `<script>` tags, there
are none. That was cheap, and losing it is a real loss to somebody who cannot read JavaScript.

The replacement is two commands:

```
curl -sS -D - http://127.0.0.1:3000/ -o /dev/null | grep -i content-security-policy   # twice
curl -sS http://127.0.0.1:3000/ | grep -o '<script[^>]*'
```

The nonce differs on every response and is 128 bits from the OS CSPRNG; a script carrying a
stale one does not run, and an injected one cannot guess it. Every script tag either has a
relative `src` or carries that response's nonce. Ten seconds, no JavaScript read.

The document says plainly that the check changed and why, rather than quietly presenting the
new one as though it had always been there. A verification procedure that edits its own history
is not a verification procedure.

## Consequences

- `app/server/http.ts` — `nonce()`, `contentSecurityPolicy(nonce)`, and
  `CLIENT_ERROR_CONTENT_SECURITY_POLICY` (`script-src 'none'`) for responses that are not
  documents. `applySecurityHeaders` deliberately does **not** set the policy: on a merge, a
  value set via `setHeader` wins over one passed to `writeHead`, so a policy set there could
  not be superseded by a rendered document. Each layer sets its own.
- `app/app/entry.server.tsx` — mints the nonce and sets the header in the same statement that
  renders the tags carrying it, so the two cannot drift.
- An `AsyncLocalStorage` was tried first and does not work: Vite bundles a copy of `http.ts`
  into `build/server/index.js`, so the renderer and the server hold different store instances.
  That failure is silent — the scripts simply carry no nonce and the browser refuses them.
- The gates now assert the property rather than the accident: a nonce is present, never
  repeats, is at least 128 bits, and every script in the document matches the one its own
  response committed to.
- `app/tests/no-outbound.test.ts` still pins the six-package production dependency list. Adding
  Radix means amending that list in a diff somebody reads, which is the point of it.

## What did not change, and should not

- Nothing load-bearing may sit behind hydration. The answer, the coverage manifest, the
  distances, and the sheriff step are server-rendered (FR-015).
- The flow works with JavaScript disabled (SC-001, User Story 4 scenario 4), and
  `app/tests/browser/form.test.ts` drives it that way. For someone browsing defensively that is
  not a degraded mode, it is the only mode.
- `root.tsx`'s `ErrorBoundary` still never calls `useRouteError()`. That is FR-027 and has
  nothing to do with script.
- No third-party origin, for script or anything else.
