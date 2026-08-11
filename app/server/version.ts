// What this instance is running, answerable from outside it.
//
// WHY THIS EXISTS
//
// On 2026-08-11 demo.tarrow.org was found serving code from 2026-08-06 -- five
// days and four merged pull requests behind, missing an entire redesign and a
// CSP change. Nothing was broken. The container was healthy, the site answered
// every request, and the compose healthcheck (`fetch('/').then(r => r.ok)`)
// passed throughout, because a stale instance is a working instance. There was
// no way to ask the running site which build it was, so nobody asked, and the
// drift was invisible for five days.
//
// This endpoint makes "is that instance current?" a single request rather than
// an investigation. It is the check TASK-0025's deploy verification runs, and
// it works from OUTSIDE the host -- which matters, because under the pull-based
// deploy decided in docs/decisions/task-0025-pull-based-cd.md, no CI job can
// see the host's logs. The origin is the only vantage point CI and a stranger
// share.
//
// WHAT IT DELIBERATELY DOES NOT DO
//
// It reveals the build, and NOTHING about the host, the database, the process,
// or any request. No uptime, no hostname, no versions of anything else, no
// counts. Those are the fields that turn a version endpoint into a
// reconnaissance endpoint, and none of them are needed to answer the one
// question this is for. A reader of this file should be able to see the entire
// set of facts it can disclose without leaving the page.
//
// It also reads NOTHING at request time. The values are baked in at image build
// and captured once at module load, so this path touches no database, no
// filesystem, and no environment beyond process start -- an instance whose
// database is down still answers it, which is exactly when you most want to
// know what is running.
//
// It writes nothing, like every other path in this server (REQUEST_LOGGING in
// server/http.ts).

import type { IncomingMessage, ServerResponse } from "node:http";

import { CLIENT_ERROR_CONTENT_SECURITY_POLICY } from "./http.ts";

/**
 * Stamped by the image build (see docker/app/Dockerfile). Not read from
 * package.json: that file's version is what the source tree claims, whereas
 * these are what the artifact was actually built from, and the whole point of
 * this endpoint is to tell those two apart when they disagree.
 *
 * `unknown` rather than a throw or a default version. A locally-built image
 * legitimately has no release tag, and an instance that cannot say what it is
 * should say so plainly rather than assert something false or refuse to start.
 * The verification script treats `unknown` as a failure to match any expected
 * version, which is the correct outcome: it means nobody can prove what is
 * running there.
 */
const VERSION = process.env.TARROW_VERSION || "unknown";
const REVISION = process.env.TARROW_REVISION || "unknown";

/**
 * The body is computed once, at module load, and served byte-identical
 * thereafter. There is nothing per-request in it -- no timestamp, no request
 * echo -- so building it per request would only create the opportunity for
 * something request-derived to creep in later.
 */
const BODY = JSON.stringify({ version: VERSION, revision: REVISION }) + "\n";

/** The one path this handles. */
const VERSION_PATH = "/version";

/**
 * Answers `GET`/`HEAD /version` and returns true; returns false for everything
 * else so the caller falls through to React Router untouched.
 *
 * Mounted in server/entry.ts alongside serveStaticAsset, i.e. BEFORE the React
 * Router listener and inside `withSecurityEnvelope`, so this response carries
 * the same security headers and the same `no-store` as every other response.
 * It is not a route in app/app/routes.ts because it is a property of the
 * SERVER, not a page: it must keep answering when the application bundle,
 * the database, or the data behind them cannot.
 *
 * The query string is ignored rather than parsed -- `/version?anything` is
 * still `/version`, and nothing from the URL reaches the response.
 */
export function serveVersion(req: IncomingMessage, res: ServerResponse): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") return false;

  const url = req.url ?? "";
  const pathOnly = url.split("?", 1)[0];
  if (pathOnly !== VERSION_PATH) return false;

  // The policy is set HERE rather than inherited, and that is not boilerplate.
  //
  // `applySecurityHeaders` deliberately skips Content-Security-Policy: on a
  // header merge the value it set would WIN over the one a rendered document
  // passes to writeHead, so a document could never supersede it with the nonce
  // it needs. The consequence is that every responder must set its own policy,
  // and a new one that forgets is the single response in this process without
  // one. server/static.ts sets the same script-free policy for the same reason.
  //
  // This response is JSON, never a document, so it carries no nonce and admits
  // no script at all.
  const body = Buffer.from(BODY, "utf8");
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Security-Policy", CLIENT_ERROR_CONTENT_SECURITY_POLICY);
  res.setHeader("Content-Length", String(body.length));

  if (req.method === "HEAD") {
    res.end();
    return true;
  }

  res.end(body);
  return true;
}

/** Exported for the test suite, which asserts the served body matches these. */
export const BUILD = Object.freeze({ version: VERSION, revision: REVISION });
