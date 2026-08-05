// Serving tarrow's own built assets, from tarrow's own origin.
//
// WHY THIS FILE EXISTS
//
// `createRequestListener` bridges React Router onto Node's http server and
// does nothing else -- in particular it does not serve the client build. The
// usual answer is `@react-router/serve`, which is Express, or a reverse proxy
// in front. Ruling R1 forecloses both: React Router 7 owns the HTTP port and
// no adapter sits in the request path.
//
// So the stylesheet 404s, and a 404 stylesheet is a privacy defect rather than
// a cosmetic one. `style-src 'self'` and a system font stack are only worth
// anything if the same-origin stylesheet actually loads; the next person to
// find the page unstyled reaches for a CDN, and that is the accidental
// violation of AC #6 the runbook names as most likely. Found by
// app/tests/http-headers.test.ts asserting the asset the document links is
// actually served -- it was not, and had not been since Phase 1.
//
// WHAT IT WILL AND WILL NOT DO
//
// GET and HEAD, from build/client only, for paths that resolve inside that
// directory after normalisation. No directory listing, no index fallback, no
// range requests, no user-supplied path reaching the filesystem un-normalised.
// Anything it does not recognise falls through to React Router untouched.
//
// It writes nothing. Not a hit, not a miss, not a byte count.

import { createReadStream, statSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CLIENT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "build",
  "client",
);

/**
 * Content types are chosen from a fixed table rather than sniffed. With
 * `X-Content-Type-Options: nosniff` on every response, an unknown extension
 * served as octet-stream is inert, which is the safe direction.
 */
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  // Self-hosted webfonts, if a future phase vendors any. They are served from
  // here or they are not served at all -- there is no third-party origin this
  // application is allowed to fetch one from (spec FR-026).
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

/** The file this request names, or null if it names nothing under build/client. */
function resolveAsset(url: string | undefined): string | null {
  if (!url) return null;
  let pathname: string;
  try {
    // The base is a placeholder: only the path is used. Parsing rather than
    // string-splitting is what strips the query and normalises the escapes,
    // so `%2e%2e%2f` never reaches path.join as text.
    pathname = decodeURIComponent(new URL(url, "http://localhost").pathname);
  } catch {
    return null;
  }
  if (pathname.includes("\0")) return null;

  const candidate = path.resolve(CLIENT_DIR, "." + path.posix.normalize(pathname));
  // The containment check is on the RESOLVED path, so a traversal that
  // survived normalisation still fails here rather than being trusted.
  if (candidate !== CLIENT_DIR && !candidate.startsWith(CLIENT_DIR + path.sep)) {
    return null;
  }
  try {
    if (!statSync(candidate).isFile()) return null;
  } catch {
    return null;
  }
  return candidate;
}

/**
 * Serve a built asset if this request names one.
 *
 * Returns true when it answered the request, false when the caller should hand
 * it to React Router.
 */
export function serveStaticAsset(
  req: IncomingMessage,
  res: ServerResponse,
): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") return false;

  const file = resolveAsset(req.url);
  if (file === null) return false;

  const type =
    CONTENT_TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";

  // Cache-Control is NOT set here. The envelope in server/http.ts already set
  // `no-store` on this response, and it is left alone deliberately: assets are
  // content-hashed and would be safe to cache, but a per-response exception is
  // one edit away from becoming a per-response exception for a result page.
  res.writeHead(200, { "Content-Type": type });

  if (req.method === "HEAD") {
    res.end();
    return true;
  }

  const stream = createReadStream(file);
  // No 'error' logging: a failed read ends the response and says nothing.
  stream.on("error", () => res.end());
  stream.pipe(res);
  return true;
}
