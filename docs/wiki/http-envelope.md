---
name: http-envelope
description: The Node server that owns the HTTP port, the security headers set on every response, the two-policy CSP split — a per-response nonce for rendered documents, a script-free policy everywhere else — the /version endpoint that makes a stale instance findable, and the error paths built so they cannot carry query context.
kind: component
sources:
  - app/server/entry.ts
  - app/server/http.ts
  - app/server/static.ts
  - app/server/version.ts
verified_against: 6d60a311a4e38c2e7520aa71dc141ac5bd014599
---

# HTTP envelope

`app/server/entry.ts` is the composition root: it creates a Node `http` server whose listener
is React Router's own `createRequestListener`, with no Express, Fastify, or adapter between
the socket and the router. `app/server/http.ts` holds everything an outsider is asked to
verify — the policy, the absence of request logging, the failure bodies — because `entry.ts`
must import a generated bundle that no test can import and no typechecker can read.

## How it works

`withSecurityEnvelope` wraps the listener and calls `applySecurityHeaders` *before* the
handler runs, so a route cannot drop a header by passing its own object to `writeHead`, and
responses nobody wrote a route for (404, 405, framework-internal 500) carry them too.
`SECURITY_HEADERS` holds `Referrer-Policy`, `Cache-Control: no-store`, `Permissions-Policy`
(geolocation denied outright), and framing/isolation headers.

**The CSP is the one header `applySecurityHeaders` deliberately skips**, and the exception is
the design. Node merges `setHeader` values over anything a later `writeHead` passes, so a
policy set at this layer could not be superseded — and a rendered document needs a nonce this
layer cannot mint, because it does not yet know whether the response will be a document. The
split is therefore: `app/app/entry.server.tsx` sets the policy for anything it renders,
`respondWithoutQueryContext` sets one for the failures this layer answers itself,
`server/static.ts` sets one for assets, and `server/version.ts` sets one for `/version`.
Every path is covered, and `assertEnvelope` in `tests/http-headers.test.ts` proves it across
200, 404, 405, 400, 500, and an asset.

The consequence of that split is that **every new responder must set its own policy**, and
one that forgets becomes the single response in the process without one. This is not
hypothetical: `/version` was written without it and shipped nothing, because
`tests/version.test.ts` asserted the header and failed (TASK-0025).

There are two policies, and the stricter one is the default. `contentSecurityPolicy(nonce)`
builds the document policy, whose `script-src` admits `'self'` plus one per-response
`'nonce-…'` value; `nonce()` is 128 bits of `randomBytes` base64, minted once per response so
it is neither guessable nor reused. It does **not** admit `'unsafe-inline'` — a nonce beside
`'unsafe-inline'` admits everything and is worth nothing, and two tests hold that line.
`CLIENT_ERROR_CONTENT_SECURITY_POLICY` is the script-free policy (`script-src 'none'`) used
for the raw-socket `clientError` path, plain-text failures, and static assets: those bodies
carry no script, so there is nothing for a nonce to admit and minting one would tell a reader
some script had been authorised when none exists.

This replaced a nonce-free `script-src 'self'` whose side effect was that hydration could not
work at all, which left the application shipping no client JavaScript — a state that was never
chosen and that no principle asked for (`docs/decisions/task-0008-01-nonce.md`). Every other
directive is unchanged: `form-action 'self'` means a typed address cannot be submitted
elsewhere, `connect-src 'self'` stops the client half of the no-outbound rule, `base-uri
'none'` stops an injected `<base>` re-pointing relative URLs, and `frame-ancestors 'none'`
stops embedding. See [[web-surface]].

`Referrer-Policy` is `same-origin` and deliberately **not** `no-referrer`: under
`no-referrer` Chromium serializes a cross-document form POST's origin as `null`, React
Router rejects a null origin, and the form answers 400 in every Chromium browser. The file
says plainly that hardening it back is an outage, not a hardening, and the browser test
fails if you try. `normalizeOpaqueOrigin` handles the complementary case — a privacy
extension or sandboxed context sending `Origin: null` — by deleting it from both
`req.headers` and `req.rawHeaders`, since React Router builds its Request from the raw array.
CSRF protection is kept for genuine cross-site origins; the reasoning that makes dropping the
opaque one safe (no cookies, no sessions, no writable role) is stated in the file.

Error paths are built so they have nothing to leak. `respondWithoutQueryContext` takes no
error argument on purpose — "a signature that accepted one would make leaking query context a
one-line edit." `FAILURE_BODY` is a fixed constant. The two exceptions, `HEADER_OVERFLOW_BODY`
and `TLS_ON_PLAIN_PORT_BODY`, can be specific precisely because the HTTP parser rejected the
request before an address existed; `bodyForClientError` reads only the parser's `HPE_*` code
and two TLS protocol-constant bytes, and returns one of three module constants.

## Connections

- [[process-output-seal]] closes the same hole from the other side, after startup.
- [[web-surface]] is what the CSP permits; [[answer-rendering]] renders inside it.
- [[search-orchestration]] never throws to this layer — a failure is a result variant.
- [[privacy-verification]] documents how to check these headers from outside.

## Operational notes

`PORT` defaults to 3000. `server/version.ts` answers `GET`/`HEAD /version` and
`server/static.ts` serves the client build from the same process, both before the router sees
the request.

`/version` reports the release and commit the image was built from, stamped as build args and
read once at module load — so it touches no database, no filesystem and no network per
request, and still answers when everything behind it is down. It exists because a stale
instance is a *working* instance: `demo.tarrow.org` served five-day-old code while every
health check passed, and nothing on it could be asked which build it was
(`docs/decisions/task-0025-pull-based-cd.md`). It discloses the build and nothing else, and
`tests/version.test.ts` asserts the exact key set rather than the presence of two fields, so
a later addition of a hostname or an uptime fails rather than passes. Two process-level handlers replace Node's defaults for
`uncaughtException` and `unhandledRejection` with a fixed `CRASH_LINE` and `exit(1)`,
because Node's default prints a stack that can carry an argument or driver query text. The
accepted cost, stated in the file: a crash in this process is not diagnosable from its
output — reproduce faults against fixture data instead.
