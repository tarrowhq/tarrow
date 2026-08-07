// The response envelope: what tarrow puts on EVERY response, and what it
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
// is TRYING to move. It exists nowhere else in the world, and tarrow does not
// create it as a record.

import { randomBytes } from "node:crypto";
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
 * A fresh nonce for one response. 16 bytes -- 128 bits -- base64.
 *
 * The security property a nonce provides is unguessability, so this has to come
 * from a CSPRNG and must never be reused across responses. `randomBytes` is the
 * CSPRNG; calling this once per response is what makes the second half true.
 */
export function nonce(): string {
  return randomBytes(16).toString("base64");
}

/**
 * HOW THE RENDERER GETS THIS VALUE, since it is not obvious and the obvious
 * answers are wrong.
 *
 * The document has to carry the same nonce the header committed to. The two
 * are produced in different layers: this file sets the header on Node's
 * ServerResponse before React Router sees the request at all, while the
 * document is rendered inside a Fetch-standard handler that never receives
 * that object.
 *
 * The seam that works is app/entry.server.tsx, which is handed
 * `responseHeaders` -- the same envelope, by then -- and reads the nonce back
 * out of the policy string it finds there. Reading it back rather than passing
 * it forward is deliberate: the header is the half a browser enforces, so
 * deriving the document's value FROM it means the two cannot drift.
 *
 * A module-level AsyncLocalStorage was tried first and does not work here.
 * Vite bundles a copy of this module into build/server/index.js, so the
 * renderer and this file hold two different store instances and the renderer
 * reads an empty one -- a failure that produces no error, only scripts a
 * browser silently refuses.
 */

/**
 * The policy tarrow serves, as a function of one response's nonce.
 *
 * WHY THERE IS A NONCE. `script-src` admits `'self'` and this one per-response
 * value. It does not admit `'unsafe-inline'`, and that distinction is the whole
 * point: `'unsafe-inline'` admits ANY inline script, which is exactly the hole a
 * third-party analytics snippet walks through, whereas a nonce admits only
 * script this server put in this document. An injected script cannot guess 128
 * bits, and a script carrying a previous response's nonce does not run.
 *
 * This replaced a nonce-free policy whose side effect was that hydration could
 * not work at all -- React Router's bootstrap is inline <script> -- and which
 * had therefore left the application shipping no client-side JavaScript. That
 * state was never a requirement and was never chosen. It fell out of the CSP
 * string the TASK-0002 runbook specified in Lane 0, which that runbook records
 * honestly at its 2026-08-04 checkpoint. No principle asks for it: Principle III
 * forbids third-party scripts, analytics, and request logs, and FR-025 and
 * FR-026 are scoped to third-party ORIGINS -- all of which this policy still
 * enforces, unchanged. See docs/decisions/task-0008-01-nonce.md.
 *
 * Every other directive is exactly as it was. `connect-src 'self'` means the
 * page cannot open an XHR, fetch, WebSocket, or EventSource to anywhere but this
 * origin. `base-uri 'none'` means an injected <base> tag cannot re-point every
 * relative URL at another host. `form-action 'self'` means a typed address
 * cannot be submitted anywhere else. `frame-ancestors 'none'` means no other
 * site can embed tarrow and read the user's interaction with it.
 */
export function contentSecurityPolicy(responseNonce: string): string {
  return (
    "default-src 'self'; " +
    `script-src 'self' 'nonce-${responseNonce}'; ` +
    "style-src 'self'; " +
    "img-src 'self' data:; " +
    "connect-src 'self'; " +
    "base-uri 'none'; " +
    "form-action 'self'; " +
    "frame-ancestors 'none'"
  );
}

/**
 * The policy for the one response written before a request object exists: the
 * `clientError` path in entry.ts, which answers a malformed request line or an
 * oversized header block from a raw socket.
 *
 * `script-src 'none'` rather than a nonce, because that body is one of three
 * fixed plain-text constants and contains no script at all. There is nothing
 * for a nonce to admit, and minting one would tell a reader of this header that
 * some script on this response had been authorised when none exists. This is
 * the stricter of the two policies, not a relaxation of the other.
 */
export const CLIENT_ERROR_CONTENT_SECURITY_POLICY =
  "default-src 'self'; " +
  "script-src 'none'; " +
  "style-src 'self'; " +
  "img-src 'self' data:; " +
  "connect-src 'self'; " +
  "base-uri 'none'; " +
  "form-action 'self'; " +
  "frame-ancestors 'none'";

/**
 * Every header tarrow sets on every response, with the reason each one is here.
 *
 * The CSP is the one the runbook enumerates. The rest are leak vectors for the
 * same datum that the CSP does not close:
 *
 *   Referrer-Policy: same-origin
 *     Phase 5 puts sheriff-confirmation guidance on every result, and guidance
 *     tends to grow links. A link to a county website would otherwise send this
 *     page's URL to that county as a Referer header. `same-origin` sends NO
 *     referrer cross-origin, so that is still structurally impossible rather
 *     than dependent on nobody ever adding an <a href> to an outside host.
 *
 *     It is `same-origin` and NOT `no-referrer` because `no-referrer` breaks
 *     tarrow (TASK-0015). Under `no-referrer` Chromium serializes the origin of
 *     a cross-document form POST as `null`, React Router's origin check rejects
 *     a null origin, and the address form answers 400 Bad Request in every
 *     Chromium browser -- before any tarrow code runs. The two mechanisms are
 *     individually correct and jointly fatal, which is why neither looked
 *     wrong.
 *
 *     Nothing is conceded by the change. The referrer `same-origin` permits is
 *     sent only to tarrow itself, and it carries no address: what the user typed
 *     travels in a POST body and never appears in a URL, which is the property
 *     the form was deliberately built around. Do not "harden" this back to
 *     `no-referrer` -- it is not a hardening, it is an outage, and
 *     tests/browser-form.test.ts fails if you try.
 *
 *   Cache-Control / Pragma / Expires
 *     A result page written to disk by a browser cache -- or by a proxy, or by
 *     a shared or library computer -- is a durable record of where somebody is
 *     trying to move. That is precisely the record Principle III says tarrow
 *     does not create. `no-store` is the only directive that forbids writing
 *     the response anywhere; `no-cache` merely requires revalidation.
 *
 *   Permissions-Policy
 *     `geolocation=()` denies the page the browser geolocation API outright.
 *     tarrow asks where you want to live; it must never be able to ask, or be
 *     tricked into asking, where you are.
 *
 *   X-Content-Type-Options / X-Frame-Options / Cross-Origin-*
 *     Belt to the CSP's braces for older engines, and isolation from other
 *     origins that might otherwise share a browsing context group with this one.
 */
export const SECURITY_HEADERS: ReadonlyArray<readonly [string, string]> = [
    // The DEFAULT policy: no script at all. It is what a 404, a 405, an asset,
    // and a framework-internal 500 carry, because none of those is a document
    // and none of them needs script. A rendered document supersedes this line
    // with `contentSecurityPolicy(nonce)` from app/entry.server.tsx -- the one
    // place a nonce is minted, which is also the place the tags that carry it
    // are rendered.
    ["Content-Security-Policy", CLIENT_ERROR_CONTENT_SECURITY_POLICY],
    ["Referrer-Policy", "same-origin"],
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
  "tarrow failed while handling this request.\n\n" +
  "Nothing about the request was recorded, and no statement about any address " +
  "is being made. If you were searching an address, treat this as no answer at " +
  "all and confirm with the registering sheriff's office.\n";

/**
 * The two failures tarrow can explain, and why only these two.
 *
 * FAILURE_BODY says nothing about the request because it cannot: by the time it
 * is written, tarrow does not know what the request was and must not find out.
 * These are the exceptions, and they are exceptions for the same reason. Both
 * are rejected by the HTTP parser BEFORE anything is parsed -- so there is no
 * URL, no method, no header, and above all no address in existence to leak.
 * That is precisely what lets them afford to be specific.
 *
 * Being specific matters here. A person who has just typed their address into a
 * housing tool and been handed "tarrow failed" has been told that tarrow is
 * broken, when in both of these cases tarrow is fine and something between them
 * and it is not. They cannot act on the generic sentence. They can act on these.
 *
 * TASK-0014.
 */

/**
 * A header block too large for the parser.
 *
 * Nearly always cookies. Browsers key the cookie jar on hostname and ignore the
 * port (RFC 6265 provides no port isolation, deliberately), so every other
 * application ever served from this hostname has been depositing cookies that
 * are now sent here too. tarrow sets none and wants none, and it cannot decline
 * them -- it can only make the failure legible.
 */
export const HEADER_OVERFLOW_BODY =
  "tarrow could not read this request, and checked nothing.\n\n" +
  "Your browser sent more header data than tarrow accepts. This is almost " +
  "always cookies: browsers keep one cookie jar per hostname and ignore the " +
  "port, so anything else you have run on this hostname leaves cookies that " +
  "get sent here too. tarrow sets no cookies and has no use for any.\n\n" +
  "To get past it, open tarrow in a private window, or clear this hostname's " +
  "cookies in your browser.\n\n" +
  "No address was read, so nothing was checked and nothing is being said " +
  "about any address. If you were searching, treat this as no answer at all.\n";

/**
 * A TLS handshake delivered to a plain-HTTP port.
 *
 * This is the self-hoster's failure, and it is not exotic. Chromium silently
 * rewrites `http://` to `https://` for any host it does not consider
 * trustworthy -- `localhost` is exempt, a LAN hostname or an internal IP is
 * not. So somebody who stands tarrow up per Principle VII, serves it over plain
 * HTTP inside their own network, and opens a browser gets their request
 * upgraded out from under them, and this process receives a ClientHello where
 * it expected a request line.
 *
 * tarrow's own browser test suite hit exactly this and failed with
 * `ERR_SSL_PROTOCOL_ERROR`, saying nothing about tarrow at all -- which is how
 * the case was found, and a fair preview of what it does to a stranger who has
 * no reason to suspect TLS.
 */
export const TLS_ON_PLAIN_PORT_BODY =
  "tarrow could not read this request, and checked nothing.\n\n" +
  "Your browser tried to speak HTTPS to a tarrow that is serving plain HTTP. " +
  "Browsers now upgrade http:// to https:// automatically for most hostnames, " +
  "so this happens even when you typed http:// yourself.\n\n" +
  "If you are visiting somebody's tarrow: ask them for the https:// address, " +
  "or try http://127.0.0.1 or http://localhost if it is running on this " +
  "machine -- browsers do not upgrade those.\n\n" +
  "If you are running this tarrow: it is serving plain HTTP, and every browser " +
  "but a local one will try HTTPS against it. Put TLS in front of it, or reach " +
  "it as localhost.\n\n" +
  "No address was read, so nothing was checked and nothing is being said " +
  "about any address. If you were searching, treat this as no answer at all.\n";

/**
 * Choose the body for a request the HTTP parser refused, from the parser's own
 * verdict. Returns a fixed constant, always.
 *
 * This function reads the error where the rest of this file pointedly does not,
 * so the boundary is worth stating exactly. It reads two things:
 *
 *   - `err.code`, which is an enum from Node's parser (`HPE_*`). A constant.
 *   - the first two bytes of `err.rawPacket`, which for a TLS record are the
 *     content type (0x16, handshake) and the major protocol version (0x03).
 *     Protocol constants, fixed before any user existed.
 *
 * It reads nothing else from rawPacket, and NOTHING it reads reaches the
 * response: the return value is one of three module-level constants, chosen by
 * a comparison. There is no interpolation, no message, no stack, and no third
 * byte. A request that got far enough to contain an address is not a request
 * that reaches this function at all -- the parser rejected it first, which is
 * the whole reason these bodies can say anything specific.
 */
export function bodyForClientError(err: unknown): string {
  const e = err as { code?: string; rawPacket?: Buffer } | null | undefined;
  const raw = e?.rawPacket;
  if (Buffer.isBuffer(raw) && raw.length >= 2 && raw[0] === 0x16 && raw[1] === 0x03) {
    return TLS_ON_PLAIN_PORT_BODY;
  }
  if (e?.code === "HPE_HEADER_OVERFLOW") return HEADER_OVERFLOW_BODY;
  return FAILURE_BODY;
}

/**
 * Set the response envelope before anything decides what the response is, and
 * return the nonce that envelope committed to.
 *
 * The nonce is minted HERE, not by the document renderer, because the header is
 * the binding half: a document that stamps a value the header never admitted
 * simply does not run its scripts. Making this function the single source means
 * the two halves cannot drift apart -- the renderer is handed the value rather
 * than generating its own and hoping.
 */
export function applySecurityHeaders(res: ServerResponse): void {
  // Set BEFORE the handler runs. Node merges headers set here with any passed
  // to writeHead() later, so a route cannot accidentally drop the policy by
  // calling writeHead with its own header object -- and a response nobody
  // wrote a route for (404, 405, a framework-internal 500) carries it too.
  //
  // THE ONE EXCEPTION IS THE POLICY ITSELF, and the exception is why this
  // function does not set it. On a merge, the value set here WINS over the one
  // React Router passes to writeHead -- so a policy set here could not be
  // superseded by a rendered document, and a document needs a nonce this layer
  // cannot mint (it does not know whether the response will be a document).
  //
  // So the split is: app/entry.server.tsx sets the policy for anything it
  // renders, with its nonce; `respondWithoutQueryContext` below sets the
  // script-free policy for every failure this layer answers itself; and
  // server/static.ts sets it for assets. Every path is covered, and the test
  // that proves it is `assertEnvelope` in tests/http-headers.test.ts, which
  // checks 200, 404, 405, 400, 500 and an asset.
  for (const [name, value] of SECURITY_HEADERS) {
    if (name === "Content-Security-Policy") continue;
    res.setHeader(name, value);
  }
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
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    // This body is a fixed plain-text constant carrying no script, so the
    // policy is the script-free one rather than a nonce nothing would use.
    "Content-Security-Policy": CLIENT_ERROR_CONTENT_SECURITY_POLICY,
  });
  res.end(FAILURE_BODY);
}

/**
 * Drop an opaque `Origin: null` so the request is treated as originless.
 *
 * React Router refuses a non-GET request whose Origin is present and does not
 * match, and `null` never matches. That refusal is CSRF protection, and it is
 * kept: a genuine cross-site post arrives as `Origin: https://evil.example`,
 * which is still rejected. Only the OPAQUE origin is normalized away, and only
 * to the state tarrow already answers -- no Origin header at all.
 *
 * It is safe HERE specifically, and the reasoning does not transfer to an app
 * that has any of the things tarrow deliberately lacks. CSRF is an attack on
 * ambient authority: it makes a victim's browser perform an authenticated,
 * state-changing action. tarrow has no cookies, no sessions, no authentication,
 * and no state to change -- sql/schema/010_grants.sql revokes every write from
 * the role the request path connects as. A forged submission would make a
 * stranger's browser run a search and render the result to that stranger, who
 * chose nothing and learns nothing, while the attacker reads nothing back
 * (the response is a navigation to another origin). There is no authority to
 * ride and no effect to cause.
 *
 * Against that non-threat stands a real one. `Origin: null` is what a hardened
 * browser sends -- a sandboxed frame, a `data:` document, and, the case that
 * matters, a privacy extension that strips or nulls the header. Principle III
 * states as a premise not to be re-litigated that tarrow's users are paranoid
 * for good reason. Refusing the request of a user who took the precaution the
 * whole project recommends, and answering it with an unexplained 400, is the
 * wrong trade in both directions at once.
 *
 * TASK-0015. The Referrer-Policy fix stopped ordinary Chromium from sending
 * `null`; this makes the deliberately-hardened client work too.
 */
function normalizeOpaqueOrigin(req: IncomingMessage): void {
  if (req.headers.origin !== "null") return;
  delete req.headers.origin;
  // AND rawHeaders, which is the one that actually matters: React Router's
  // node adapter builds the Fetch Request via
  // `createHeaders(req.rawHeaders)` (@mjackson/node-fetch-server), so a
  // header deleted only from `req.headers` is still delivered to the router.
  // Deleting from `headers` alone looked correct, changed nothing, and was
  // caught by re-running the check rather than by reading the code.
  const raw = req.rawHeaders;
  if (!Array.isArray(raw)) return;
  const kept: string[] = [];
  for (let i = 0; i < raw.length; i += 2) {
    if (raw[i]?.toLowerCase() === "origin" && raw[i + 1] === "null") continue;
    kept.push(raw[i], raw[i + 1]);
  }
  req.rawHeaders = kept;
}

/**
 * Wrap a request handler so the envelope holds on every path out of it --
 * including the paths the handler itself does not know it has.
 */
export function withSecurityEnvelope(inner: RequestListener): RequestListener {
  return (req: IncomingMessage, res: ServerResponse) => {
    applySecurityHeaders(res);
    normalizeOpaqueOrigin(req);
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
