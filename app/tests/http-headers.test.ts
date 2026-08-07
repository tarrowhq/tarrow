// Every response carries the policy. Including the ones nobody wrote.
//
// Spec FR-025 and FR-026, and the runbook's enumerated per-PR gate: "CSP is the
// AC #6 enforcement mechanism, with a build-output scan as the second layer.
// Every response carries at least: default-src 'self'; ..."
//
// "Every response" is the whole claim, so this test does not fetch the home
// page and stop. It fetches a route that exists, a route that does not, a
// method the route does not accept, a static asset, and a request malformed
// enough that Node rejects it before a response object exists -- and it builds
// a server around the same wrapper the real one uses, with a handler that
// throws, to reach the 500 that no fixture can provoke on demand.

import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import type { AddressInfo } from "node:net";
import { describe, test } from "node:test";

import {
  CLIENT_ERROR_CONTENT_SECURITY_POLICY,
  contentSecurityPolicy,
  nonce,
  FAILURE_BODY,
  HEADER_OVERFLOW_BODY,
  TLS_ON_PLAIN_PORT_BODY,
  withSecurityEnvelope,
} from "../server/http.ts";

/**
 * Send raw bytes to the running server and return everything it writes back.
 * Used for the failures that happen before a response object exists, which
 * fetch() cannot reach at all.
 */
async function rawExchange(payload: Buffer | string): Promise<string> {
  const url = new URL(ORIGIN);
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const socket = net.connect(
      { host: url.hostname, port: Number(url.port || 80) },
      () => socket.write(payload),
    );
    socket.on("data", (c: Buffer) => chunks.push(c));
    socket.on("close", () => resolve(Buffer.concat(chunks).toString("utf8")));
    socket.on("error", reject);
    setTimeout(() => {
      socket.destroy();
      resolve(Buffer.concat(chunks).toString("utf8"));
    }, 5000);
  });
}

const ORIGIN = process.env.TARROW_APP_ORIGIN ?? "http://app:3000";

/**
 * The policy, written out again here as a literal, with the nonce as a slot.
 *
 * Deliberately NOT derived from the function it is checking. A test that
 * compares the served header to the same string the server built it from
 * passes whatever that string says, including after somebody quietly adds
 * 'unsafe-inline' to it. This literal is transcribed from
 * docs/design/task-0002-walking-skeleton-runbook.md, and the runbook is what
 * the operator signed off on.
 *
 * The runbook's Lane 0 string had a bare `script-src 'self'`. It was amended
 * under TASK-0008.01 to add the nonce, explicitly and by the operator rather
 * than by an implementer working around a gate -- see the amendment note in the
 * runbook and docs/decisions/task-0008-01-nonce.md. Everything either side of
 * that clause is unchanged, which is most of what these tests are here to hold.
 */
const NONCE = /[A-Za-z0-9+/]{22,}={0,2}/;

const EXPECTED_CSP = new RegExp(
  "^default-src 'self'; " +
    `script-src 'self' 'nonce-${NONCE.source}'; ` +
    "style-src 'self'; " +
    "img-src 'self' data:; " +
    "connect-src 'self'; " +
    "base-uri 'none'; " +
    "form-action 'self'; " +
    "frame-ancestors 'none'$",
);

const EXPECTED_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ["referrer-policy", "same-origin"],
  ["x-content-type-options", "nosniff"],
  ["x-frame-options", "DENY"],
];

function assertEnvelope(where: string, headers: Headers): void {
  const csp = headers.get("content-security-policy") ?? "";
  assert.match(
    csp,
    EXPECTED_CSP,
    `${where}: the policy must be the runbook's, with this response's nonce`,
  );
  for (const [name, expected] of EXPECTED_HEADERS) {
    assert.equal(
      headers.get(name),
      expected,
      `${where}: ${name} must be exactly "${expected}"`,
    );
  }
  const cache = headers.get("cache-control") ?? "";
  assert.match(
    cache,
    /no-store/,
    `${where}: a result page written to a browser or proxy cache is a durable ` +
      "record of where somebody is trying to move. no-store is the only " +
      "directive that forbids writing it down.",
  );
}

describe("the served policy is the one the runbook specifies", () => {
  test("the server's own policy matches the runbook, character for character", () => {
    assert.match(contentSecurityPolicy("TESTNONCEVALUE0000000000"), EXPECTED_CSP);
  });

  test("script-src admits a nonce and nothing else beyond 'self'", () => {
    const policy = contentSecurityPolicy("TESTNONCEVALUE0000000000");
    assert.doesNotMatch(
      policy,
      /unsafe-inline/,
      "'unsafe-inline' admits ANY inline script, which is the hole a nonce " +
        "exists to avoid opening. A nonce admits only what this server put in " +
        "this document; 'unsafe-inline' admits what anybody else put there.",
    );
    assert.doesNotMatch(policy, /unsafe-eval/);
    assert.doesNotMatch(
      policy,
      /\*/,
      "a wildcard source in any directive re-opens the third-party load this " +
        "policy exists to close",
    );
  });

  test("a nonce is 128 bits of CSPRNG output, and never repeats", () => {
    // The security property is unguessability. A short nonce, or one drawn
    // from a predictable source, is decoration: an injected script that can
    // guess the value runs. 16 bytes base64 is 22 characters before padding.
    const seen = new Set<string>();
    for (let i = 0; i < 100; i += 1) {
      const value = nonce();
      assert.match(
        value,
        new RegExp(`^${NONCE.source}$`),
        "a nonce must be at least 128 bits, base64",
      );
      assert.ok(!seen.has(value), "a nonce must never repeat across responses");
      seen.add(value);
    }
  });

  test("the pre-request failure path serves no script at all", () => {
    // entry.ts answers a malformed request line from a raw socket, before a
    // ServerResponse exists. That body is a fixed plain-text constant, so the
    // policy is stricter than the document one rather than looser.
    assert.match(CLIENT_ERROR_CONTENT_SECURITY_POLICY, /script-src 'none'/);
    assert.doesNotMatch(CLIENT_ERROR_CONTENT_SECURITY_POLICY, /nonce-/);
    assert.doesNotMatch(CLIENT_ERROR_CONTENT_SECURITY_POLICY, /unsafe-inline/);
  });
});

describe("every response from the running server carries it", () => {
  test("a route that exists (200)", async () => {
    const res = await fetch(`${ORIGIN}/`);
    assert.equal(res.status, 200);
    assertEnvelope("GET /", res.headers);
    await res.text();
  });

  test("a route that does not exist (404)", async () => {
    const res = await fetch(`${ORIGIN}/no-such-route-privacy-probe`);
    assert.equal(res.status, 404);
    assertEnvelope("GET /no-such-route-privacy-probe", res.headers);
    await res.text();
  });

  test("a method the route does not accept (405)", async () => {
    const res = await fetch(`${ORIGIN}/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "address=probe",
    });
    assert.ok(res.status >= 400, `expected an error status, got ${res.status}`);
    assertEnvelope("POST /", res.headers);
    await res.text();
  });

  test("a static asset served from the client build", async () => {
    const html = await (await fetch(`${ORIGIN}/`)).text();
    const asset = html.match(/(?:href|src)="(\/assets\/[^"]+)"/)?.[1];
    assert.ok(
      asset,
      "the document must reference at least one same-origin built asset for " +
        "this check to mean anything",
    );
    const res = await fetch(`${ORIGIN}${asset}`);
    assert.equal(res.status, 200);
    assertEnvelope(`GET ${asset}`, res.headers);
    await res.text();
  });

  test("a request malformed at the protocol level (400, before any route runs)", async () => {
    const url = new URL(ORIGIN);
    const raw = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const socket = net.connect(
        { host: url.hostname, port: Number(url.port || 80) },
        () => socket.write("GET / HTTP/9.9\r\n\r\n"),
      );
      socket.on("data", (c: Buffer) => chunks.push(c));
      socket.on("close", () => resolve(Buffer.concat(chunks).toString("utf8")));
      socket.on("error", reject);
      setTimeout(() => {
        socket.destroy();
        resolve(Buffer.concat(chunks).toString("utf8"));
      }, 3000);
    });

    assert.match(raw, /^HTTP\/1\.1 400 /, `expected a 400 response, got:\n${raw}`);
    assert.ok(
      raw.includes(`Content-Security-Policy: ${EXPECTED_CSP}`),
      "Node's default clientError handler answers 400 with no headers at all. " +
        `That would be the one response in this process without a policy on it.\n${raw}`,
    );
    assert.ok(raw.includes("Referrer-Policy: same-origin"));
    // The generic body is the RIGHT answer here: a bad request line is a
    // failure tarrow genuinely cannot explain. The two it can are below, and
    // this assertion is what stops them being applied to everything.
    assert.ok(
      raw.includes(FAILURE_BODY),
      `an unclassifiable malformed request keeps the generic body\n${raw}`,
    );
  });

  // TASK-0014. Both of the failures tarrow CAN explain. Neither is reachable
  // through fetch() -- the parser rejects them before a response object exists
  // -- which is why they are raw-socket exchanges and why they went unnoticed.
  test("a TLS handshake on the plain-HTTP port is explained", async () => {
    // The first bytes of a real ClientHello: record type 0x16 (handshake),
    // version 0x03 0x01. This is what a browser sends after silently
    // upgrading http:// to https://, which it does for every hostname it does
    // not consider trustworthy -- so this is the self-hoster's failure, not an
    // exotic one. tarrow's own browser suite hit it.
    const raw = await rawExchange(
      Buffer.from([0x16, 0x03, 0x01, 0x02, 0x00, 0x01, 0x00, 0x01, 0xfc, 0x03, 0x03]),
    );

    assert.match(raw, /^HTTP\/1\.1 400 /, `expected a 400, got:\n${raw}`);
    assert.ok(
      raw.includes(TLS_ON_PLAIN_PORT_BODY),
      "A ClientHello must be answered with the body that names TLS and offers " +
        `a way out, not with the generic failure.\n${raw}`,
    );
    assert.ok(!raw.includes(FAILURE_BODY), "the generic body must not appear");
    assert.ok(
      raw.includes(
        `Content-Security-Policy: ${CLIENT_ERROR_CONTENT_SECURITY_POLICY}`,
      ),
    );
  });

  test("an oversized header block is explained", async () => {
    // Past the raised 64 KB ceiling, so this exercises the overflow path
    // rather than the headroom that now absorbs real cookie jars.
    const bloat = "x".repeat(80_000);
    const raw = await rawExchange(
      `GET / HTTP/1.1\r\nHost: ${new URL(ORIGIN).host}\r\nCookie: bloat=${bloat}\r\n\r\n`,
    );

    assert.match(raw, /^HTTP\/1\.1 400 /, `expected a 400, got:\n${raw}`);
    assert.ok(
      raw.includes(HEADER_OVERFLOW_BODY),
      `An overflow must name the cause and a way out.\n${raw}`,
    );
    assert.ok(!raw.includes(FAILURE_BODY), "the generic body must not appear");
    assert.ok(
      raw.includes(
        `Content-Security-Policy: ${CLIENT_ERROR_CONTENT_SECURITY_POLICY}`,
      ),
    );
    // Nothing from the request may come back. The parser read no URL and no
    // address; the only thing sent was the bloat, so its echo is what to hunt.
    assert.ok(
      !raw.includes(bloat.slice(0, 200)),
      `the response echoed request content back\n${raw.slice(0, 400)}`,
    );
    assert.ok(
      !/HPE_|ERR_HTTP|at Socket|node:internal/.test(raw),
      `the response carried a parser code or a stack frame\n${raw}`,
    );
  });

  // The headroom itself, asserted rather than assumed: a cookie jar the size a
  // polluted shared hostname actually produces must simply work.
  test("a realistic polluted cookie jar (32 KB) is served normally", async () => {
    const res = await fetch(ORIGIN, {
      headers: { Cookie: `jar=${"x".repeat(32_000)}` },
    });
    assert.equal(
      res.status,
      200,
      "32 KB of cookies is well within what a shared hostname accumulates and " +
        "must not reach the overflow path at all.",
    );
    assertEnvelope("GET / with 32 KB of cookies", res.headers);
    await res.text();
  });

  // TASK-0015, the half that serves the hardened client. `Origin: null` is what
  // a sandboxed frame, a data: document, or a privacy extension that strips the
  // header sends. Principle III takes it as given that tarrow's users are
  // paranoid for good reason; answering the ones who act on it with a 400 is
  // the wrong trade. A genuine cross-site origin is still refused -- that case
  // is asserted below, so this test cannot pass by disabling the check.
  test("an opaque Origin is served; a foreign Origin is still refused", async () => {
    const form = new URLSearchParams({ address: "1464 Garman Rd, Akron, OH 44313" });

    const opaque = await fetch(`${ORIGIN}/answer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "null",
      },
      body: form,
    });
    assert.equal(
      opaque.status,
      200,
      "Origin: null must be served. A hardened browser sends it, and tarrow " +
        "has no cookies, no session, and no writable table to protect.",
    );
    await opaque.text();

    const foreign = await fetch(`${ORIGIN}/answer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "https://evil.example",
      },
      body: form,
    });
    assert.notEqual(
      foreign.status,
      200,
      "A named cross-site Origin must still be refused. If this passes, the " +
        "opaque-origin normalization was written too broadly and turned off " +
        "the check instead of narrowing it.",
    );
    await foreign.text().catch(() => {});
  });
});

describe("the error path answers without saying what was asked", () => {
  test("a handler that throws produces a 500 with the policy and no query context", async () => {
    const CANARY = "8675309 ZZYZX SENTINEL PRIVACY WAY";
    const server = http.createServer(
      withSecurityEnvelope(() => {
        throw new Error(`boom while handling ${CANARY}`);
      }),
    );
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;

    try {
      const res = await fetch(
        `http://127.0.0.1:${port}/search/${encodeURIComponent(CANARY)}?address=${encodeURIComponent(CANARY)}`,
      );
      assert.equal(res.status, 500);
      assertEnvelope("thrown handler", res.headers);

      const body = await res.text();
      assert.equal(body, FAILURE_BODY);
      assert.equal(
        body.includes("ZZYZX"),
        false,
        "the error body carries the searched address (FR-027: an error may say " +
          "what failed, never what was searched)",
      );
      assert.equal(body.includes("boom"), false, "the caught error leaked into the body");
      assert.equal(body.includes("/search/"), false, "the request URL leaked into the body");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  test("a handler whose promise rejects produces the same 500", async () => {
    const server = http.createServer(
      withSecurityEnvelope(async () => {
        throw new Error("rejected with 1464 GARMAN RD in the message");
      }),
    );
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/`);
      assert.equal(res.status, 500);
      assertEnvelope("rejected handler", res.headers);
      const body = await res.text();
      assert.equal(body.includes("GARMAN"), false);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe("the served document loads nothing from anywhere else", () => {
  test("no absolute or protocol-relative src/href in the response body", async () => {
    const html = await (await fetch(`${ORIGIN}/`)).text();
    const refs = [...html.matchAll(/\b(?:src|href|srcset|action)="([^"]*)"/g)].map(
      (m) => m[1] ?? "",
    );
    assert.ok(refs.length > 0, "the document should reference at least its stylesheet");
    for (const ref of refs) {
      assert.doesNotMatch(
        ref,
        /^(?:https?:)?\/\//,
        `the served document references ${ref}, which is off this origin`,
      );
    }
  });

  test("the error document says nothing about what was asked", async () => {
    const probe = "8675309-ZZYZX-SENTINEL";
    const res = await fetch(`${ORIGIN}/search/${probe}`);
    assert.equal(res.status, 404);
    const html = await res.text();
    assert.equal(
      html.includes(probe),
      false,
      "the error page echoes the requested path back at the reader. On a shared " +
        "computer that puts the searched address on the screen and into the " +
        "browser's back-button cache (FR-027).",
    );
    assert.doesNotMatch(
      html,
      /Hey developer/i,
      "React Router's DEFAULT root error boundary emits a 'Hey developer' " +
        "console tip as an inline script carrying no nonce, which a browser " +
        "refuses. If this fires, app/app/root.tsx's ErrorBoundary stopped " +
        "being used.",
    );
  });

  test("every script in the document is admitted by the policy that carried it", async () => {
    // The gate is no longer "there is no script" -- there is, and hydration
    // needs it. It is that every script the document carries is one this
    // response authorised: an inline block stamped with THIS response's nonce,
    // or a same-origin src. Anything else is a script a browser would refuse,
    // which means the page is working by accident rather than by design.
    const res = await fetch(`${ORIGIN}/`);
    const csp = res.headers.get("content-security-policy") ?? "";
    const served = /'nonce-([A-Za-z0-9+/]+={0,2})'/.exec(csp)?.[1];
    assert.ok(served, `no nonce in the served policy: ${csp}`);

    const html = await res.text();
    for (const [tag] of html.matchAll(/<script\b[^>]*>/gi)) {
      const src = /\bsrc="([^"]*)"/.exec(tag)?.[1];
      if (src !== undefined) {
        assert.ok(
          src.startsWith("/") && !src.startsWith("//"),
          `a script is loaded from ${src}, which is off this origin`,
        );
        continue;
      }
      const stamped = /\bnonce="([^"]*)"/.exec(tag)?.[1];
      assert.equal(
        stamped,
        served,
        `an inline script carries ${stamped ?? "no nonce"} but the policy ` +
          `admits ${served}. A browser refuses it, so whatever it does is ` +
          `not happening.`,
      );
    }
  });

  test("the document declares no third-party preconnect or dns-prefetch", async () => {
    const html = await (await fetch(`${ORIGIN}/`)).text();
    assert.doesNotMatch(html, /rel="(?:preconnect|dns-prefetch)"/i);
  });

  test("the stylesheet is served from this origin and pulls in no font host", async () => {
    const html = await (await fetch(`${ORIGIN}/`)).text();
    const href = html.match(/href="(\/assets\/[^"]+\.css)"/)?.[1];
    assert.ok(href, "a same-origin stylesheet must be linked");
    const css = await (await fetch(`${ORIGIN}${href}`)).text();
    assert.doesNotMatch(css, /@import/i, "@import can reach any origin");
    assert.doesNotMatch(
      css,
      /url\(\s*['"]?(?:https?:)?\/\//i,
      "a url() pointing off-origin -- a webfont request carries the reader's " +
        "IP and the referring page to whoever serves it",
    );
    assert.doesNotMatch(css, /fonts\.(googleapis|gstatic)\.com/i);
  });
});
