// The response envelope: what somap puts on EVERY response, and what it
// refuses to put anywhere.
//
// This module exists separately from entry.ts for one reason: entry.ts must
// import the generated RR7 bundle, which has no type declarations and cannot
// be type-checked or imported by a test. Everything an outsider is asked to
// verify -- the Content-Security-Policy, the absence of request logging, the
// error path that carries no query context -- lives here instead, in a file
// that `npm run typecheck` checks and `tests/http-headers.test.ts` exercises
// directly.
//
// Constitution Principle III. The uniquely dangerous datum is where somebody
// is TRYING to move. It exists nowhere else in the world, and somap does not
// create it as a record.

import type { IncomingMessage, RequestListener, ServerResponse } from "node:http";

/**
 * REQUEST LOGGING IS OFF. This is the single greppable line the runbook asks
 * for, and it is a statement about the whole process, not about this function.
 *
 * There is no access log, no per-request line, no request counter, no timing
 * sample, and no error report anywhere in `server/`. The way that is kept true
 * is structural rather than careful: nothing in the request path is given the
 * address to write down. `server/search.ts` never writes; the two functions
 * below never receive the request body; the only `console` call in the whole
 * server is the startup line in entry.ts, which carries a port number and
 * nothing else.
 *
 * grep -rn "REQUEST_LOGGING" app/server/ finds this. grep -rn "console\." app/
 * finds every place the process can write at all.
 */
export const REQUEST_LOGGING = "disabled" as const;

/**
 * The policy the runbook specifies, verbatim, as one string.
 *
 * `script-src 'self'` with no `'unsafe-inline'` and no nonce is the load-bearing
 * clause, and it is why this application ships no client-side JavaScript at all
 * (see app/app/root.tsx). React Router's hydration bootstrap is three inline
 * <script> blocks; a policy that admitted them would have to admit every other
 * inline script too, which is exactly the hole a third-party analytics snippet
 * walks through. The resolution that does not weaken the policy is to have no
 * inline script to admit.
 *
 * `connect-src 'self'` means the page cannot open an XHR, fetch, WebSocket, or
 * EventSource to anywhere but this origin. `base-uri 'none'` means an injected
 * <base> tag cannot re-point every relative URL at another host.
 * `form-action 'self'` means a typed address cannot be submitted anywhere else.
 * `frame-ancestors 'none'` means no other site can embed somap and read the
 * user's interaction with it.
 */
export const CONTENT_SECURITY_POLICY =
  "default-src 'self'; " +
  "script-src 'self'; " +
  "style-src 'self'; " +
  "img-src 'self' data:; " +
  "connect-src 'self'; " +
  "base-uri 'none'; " +
  "form-action 'self'; " +
  "frame-ancestors 'none'";

/**
 * Every header somap sets on every response, with the reason each one is here.
 *
 * The CSP is the one the runbook enumerates. The rest are leak vectors for the
 * same datum that the CSP does not close:
 *
 *   Referrer-Policy: no-referrer
 *     Phase 5 puts sheriff-confirmation guidance on every result, and guidance
 *     tends to grow links. A link to a county website would otherwise send this
 *     page's URL to that county as a Referer header. `no-referrer` makes that
 *     structurally impossible rather than dependent on nobody ever adding an
 *     <a href> to an outside host.
 *
 *   Cache-Control / Pragma / Expires
 *     A result page written to disk by a browser cache -- or by a proxy, or by
 *     a shared or library computer -- is a durable record of where somebody is
 *     trying to move. That is precisely the record Principle III says somap
 *     does not create. `no-store` is the only directive that forbids writing
 *     the response anywhere; `no-cache` merely requires revalidation.
 *
 *   Permissions-Policy
 *     `geolocation=()` denies the page the browser geolocation API outright.
 *     somap asks where you want to live; it must never be able to ask, or be
 *     tricked into asking, where you are.
 *
 *   X-Content-Type-Options / X-Frame-Options / Cross-Origin-*
 *     Belt to the CSP's braces for older engines, and isolation from other
 *     origins that might otherwise share a browsing context group with this one.
 */
export const SECURITY_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ["Content-Security-Policy", CONTENT_SECURITY_POLICY],
  ["Referrer-Policy", "no-referrer"],
  ["Cache-Control", "no-store, no-cache, must-revalidate, private"],
  ["Pragma", "no-cache"],
  ["Expires", "0"],
  [
    "Permissions-Policy",
    "geolocation=(), camera=(), microphone=(), payment=(), usb=(), " +
      "interest-cohort=(), browsing-topics=()",
  ],
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "DENY"],
  ["Cross-Origin-Opener-Policy", "same-origin"],
  ["Cross-Origin-Resource-Policy", "same-origin"],
];

/**
 * The body of every failure this layer produces. A fixed constant: it names
 * what failed and says nothing whatever about what was asked.
 *
 * FR-027. An error may say what failed; it may never say what was searched.
 * There is no interpolation here, no request URL, no method, no header, no
 * caught error, and no stack -- not because the caller is careful, but because
 * this function is never given any of them.
 */
export const FAILURE_BODY =
  "somap failed while handling this request.\n\n" +
  "Nothing about the request was recorded, and no statement about any address " +
  "is being made. If you were searching an address, treat this as no answer at " +
  "all and confirm with the registering sheriff's office.\n";

/** Set the response envelope before anything decides what the response is. */
export function applySecurityHeaders(res: ServerResponse): void {
  // Set BEFORE the handler runs. Node merges headers set here with any passed
  // to writeHead() later, so a route cannot accidentally drop the policy by
  // calling writeHead with its own header object -- and a response nobody
  // wrote a route for (404, 405, a framework-internal 500) carries it too.
  for (const [name, value] of SECURITY_HEADERS) res.setHeader(name, value);
}

/**
 * Answer a failed request without saying anything about it.
 *
 * Takes no error argument on purpose. A signature that accepted one would make
 * leaking query context a one-line edit by somebody who wanted a better log
 * line; there is nothing here to leak because nothing here is passed in.
 */
export function respondWithoutQueryContext(
  res: ServerResponse,
  status = 500,
): void {
  if (res.writableEnded) return;
  if (res.headersSent) {
    res.end();
    return;
  }
  applySecurityHeaders(res);
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(FAILURE_BODY);
}

/**
 * Wrap a request handler so the envelope holds on every path out of it --
 * including the paths the handler itself does not know it has.
 */
export function withSecurityEnvelope(inner: RequestListener): RequestListener {
  return (req: IncomingMessage, res: ServerResponse) => {
    applySecurityHeaders(res);
    try {
      const returned: unknown = inner(req, res);
      if (
        returned !== null &&
        typeof returned === "object" &&
        typeof (returned as PromiseLike<unknown>).then === "function"
      ) {
        // No `.catch(err => ...)` with a body that uses `err`: the rejection
        // value is discarded at the boundary, not inspected and then withheld.
        void Promise.resolve(returned as PromiseLike<unknown>).then(undefined, () => {
          respondWithoutQueryContext(res);
        });
      }
    } catch {
      respondWithoutQueryContext(res);
    }
  };
}
