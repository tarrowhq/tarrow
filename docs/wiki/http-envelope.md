---
name: http-envelope
description: The Node server that owns the HTTP port, the security headers set on every response, the CSP that forces a no-JavaScript client, and the error paths built so they cannot carry query context.
kind: component
sources:
  - app/server/entry.ts
  - app/server/http.ts
  - app/server/static.ts
verified_against: b5b247a6cb390ba505c674f0c77af551dd547949
---

# HTTP envelope

`app/server/entry.ts` is the composition root: it creates a Node `http` server whose listener
is React Router's own `createRequestListener`, with no Express, Fastify, or adapter between
the socket and the router. `app/server/http.ts` holds everything an outsider is asked to
verify — the policy, the absence of request logging, the failure bodies — because `entry.ts`
must import a generated bundle that no test can import and no typechecker can read.

## How it works

`withSecurityEnvelope` wraps the listener and calls `applySecurityHeaders` *before* the
handler runs, so a route cannot drop the policy by passing its own header object to
`writeHead`, and responses nobody wrote a route for (404, 405, framework-internal 500) carry
it too. `SECURITY_HEADERS` sets the CSP plus `Referrer-Policy`, `Cache-Control: no-store`,
`Permissions-Policy` (geolocation denied outright), and framing/isolation headers.

`CONTENT_SECURITY_POLICY` is a single string with `script-src 'self'` carrying no
`'unsafe-inline'` and no nonce. That clause is why the application ships no client
JavaScript — see [[web-surface]]. `form-action 'self'` means a typed address cannot be
submitted elsewhere; `connect-src 'self'` stops the client half of the no-outbound rule.

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

`PORT` defaults to 3000. `server/static.ts` serves the client build from the same process
before the router sees the request. Two process-level handlers replace Node's defaults for
`uncaughtException` and `unhandledRejection` with a fixed `CRASH_LINE` and `exit(1)`,
because Node's default prints a stack that can carry an argument or driver query text. The
accepted cost, stated in the file: a crash in this process is not diagnosable from its
output — reproduce faults against fixture data instead.
