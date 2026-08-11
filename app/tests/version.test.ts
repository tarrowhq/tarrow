// The endpoint that makes a stale instance findable.
//
// TASK-0025: demo.tarrow.org served 2026-08-06 code until 2026-08-11 while
// returning 200 to every request and passing its compose healthcheck on every
// interval. Nothing was down. The instance simply could not be asked what it
// was, so nobody asked.
//
// These tests hold the two halves of that fix: the endpoint answers with the
// build it was stamped with, and it discloses NOTHING ELSE. The second half
// matters as much as the first -- a version endpoint that grows a hostname, an
// uptime, or a request count becomes a reconnaissance endpoint on a site whose
// entire argument is that it holds nothing about the people who use it.

import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, test } from "node:test";

import { withSecurityEnvelope } from "../server/http.ts";
import { BUILD, serveVersion } from "../server/version.ts";

/**
 * The endpoint is mounted exactly as server/entry.ts mounts it -- inside
 * `withSecurityEnvelope`, ahead of a fallthrough -- so these tests exercise the
 * real composition rather than the handler in isolation. A version endpoint
 * that answered outside the security envelope would be the one response in the
 * process without a policy on it, and testing the bare function could not tell.
 */
async function withServer<T>(
  run: (origin: string) => Promise<T>,
): Promise<T> {
  const server = http.createServer(
    withSecurityEnvelope((req, res) => {
      if (serveVersion(req, res)) return;
      res.statusCode = 404;
      res.end("not the version endpoint");
    }),
  );

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  try {
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
}

describe("/version", () => {
  test("reports the build this image was stamped with", async () => {
    await withServer(async (origin) => {
      const res = await fetch(`${origin}/version`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get("content-type") ?? "", /application\/json/);

      const body = await res.json();
      assert.equal(body.version, BUILD.version);
      assert.equal(body.revision, BUILD.revision);
    });
  });

  test("discloses the build and nothing else", async () => {
    // The assertion is on the KEY SET, not on the presence of the two fields.
    // A test that only checked `version` and `revision` were present would pass
    // just as happily after somebody added a hostname or a process uptime,
    // which is the drift this test exists to prevent.
    await withServer(async (origin) => {
      const body = await (await fetch(`${origin}/version`)).json();
      assert.deepEqual(Object.keys(body).sort(), ["revision", "version"]);
    });
  });

  test("carries the same security envelope as every other response", async () => {
    await withServer(async (origin) => {
      const res = await fetch(`${origin}/version`);
      assert.ok(res.headers.get("content-security-policy"));
      assert.equal(res.headers.get("x-content-type-options"), "nosniff");
      assert.match(res.headers.get("cache-control") ?? "", /no-store/);
    });
  });

  test("answers HEAD without a body", async () => {
    await withServer(async (origin) => {
      const res = await fetch(`${origin}/version`, { method: "HEAD" });
      assert.equal(res.status, 200);
      assert.equal(await res.text(), "");
    });
  });

  test("does not answer POST", async () => {
    // A GET-only surface stays GET-only: this must never become somewhere a
    // request body is accepted, since a request body on this site carries the
    // one datum the project exists to protect.
    await withServer(async (origin) => {
      const res = await fetch(`${origin}/version`, { method: "POST" });
      assert.equal(res.status, 404); // fell through, not handled
    });
  });

  test("ignores the query string rather than reflecting it", async () => {
    // Nothing from the URL may reach the response. `/version?x=<script>` is
    // still `/version`, and the body is byte-identical to the plain request.
    await withServer(async (origin) => {
      const plain = await (await fetch(`${origin}/version`)).text();
      const withQuery = await (
        await fetch(`${origin}/version?x=%3Cscript%3E`)
      ).text();
      assert.equal(withQuery, plain);
    });
  });

  test("does not answer paths that merely start with /version", async () => {
    await withServer(async (origin) => {
      const res = await fetch(`${origin}/versions-of-things`);
      assert.equal(res.status, 404);
    });
  });
});
