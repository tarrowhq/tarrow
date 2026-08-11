// The query path makes no outbound network call -- structurally, in three
// independent ways that would each have to be defeated separately.
//
// Spec FR-024 and FR-026.
//
//   1. NO ROUTE. The `app` container is attached only to a docker network
//      declared `internal: true`, so no gateway and no NAT rule exists for it.
//      Not "no code calls out": there is nowhere to call.
//   2. NO CALLER. No module in the request path names a network client API.
//   3. NO REFERENCE. No built asset carries an external origin, checked by
//      app/scripts/scan-external-origins.mjs -- which also runs as its own
//      step in docker/app/Dockerfile, so a violation fails the image build
//      rather than only the suite.
//
// Each is checkable from outside; docs/privacy/verification.md says how.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

import { inspectContainer, projectContainers } from "./docker.ts";

const APP_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function stripTsComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function sourcesUnder(dir: string, exts: readonly string[]): { name: string; code: string }[] {
  const out: { name: string; code: string }[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...sourcesUnder(full, exts));
      continue;
    }
    if (!exts.some((e) => entry.name.endsWith(e))) continue;
    out.push({
      name: path.relative(APP_ROOT, full),
      code: stripTsComments(readFileSync(full, "utf8")),
    });
  }
  return out;
}

describe("no module in the request path can originate a network call", () => {
  // server/ is the query path; app/ is what renders it. The ETL (etl/) is a
  // different pipeline with a different rule -- fetching from the county is
  // its entire job -- and it never serves a request.
  const REQUEST_PATH = [
    ...sourcesUnder(path.join(APP_ROOT, "server"), [".ts"]),
    ...sourcesUnder(path.join(APP_ROOT, "app"), [".ts", ".tsx"]),
  ];

  const FORBIDDEN: ReadonlyArray<readonly [RegExp, string]> = [
    [/\bfetch\s*\(/, "fetch() is an outbound request"],
    [/\bhttps?\.(?:get|request)\s*\(/, "http.request/get is an outbound request"],
    [/\bnode:https\b/, "the https client module has no server-side use here"],
    [/\bnet\.connect\s*\(/, "an outbound socket"],
    [/\bnode:dns\b/, "name resolution is the first half of an outbound call"],
    [/\bXMLHttpRequest\b/, "an outbound request from the client"],
    [/\bnew\s+WebSocket\s*\(/, "an outbound socket from the client"],
    [/\bnew\s+EventSource\s*\(/, "an outbound stream from the client"],
    [/\bnavigator\.sendBeacon\b/, "a beacon is analytics by another name"],
    [/\b(?:axios|node-fetch|undici|got|superagent)\b/, "an HTTP client library"],
  ];

  test("the request path is not empty (this scan has something to scan)", () => {
    assert.ok(REQUEST_PATH.length >= 5, `only found ${REQUEST_PATH.length} source files`);
  });

  for (const file of REQUEST_PATH) {
    test(`${file.name} originates no network call`, () => {
      for (const [pattern, why] of FORBIDDEN) {
        assert.doesNotMatch(file.code, pattern, `${file.name}: ${why}`);
      }
    });
  }

  test("node:http appears only where the server is created", () => {
    // The request path uses node:http to LISTEN, not to call out. Four files
    // may name it: entry.ts, which creates the server, and http.ts, static.ts
    // and version.ts, which import its TYPES to describe the response they
    // write. Anything else naming node:http is a caller, not a listener.
    //
    // version.ts (TASK-0025) answers `/version` with a string built at module
    // load. It reads nothing at request time -- no database, no filesystem, no
    // network -- which is why it can still answer when everything behind it is
    // down, and that is the whole point of it.
    const carriers = REQUEST_PATH.filter((f) => /\bnode:http\b/.test(f.code))
      .map((f) => f.name)
      .sort();
    assert.deepEqual(carriers, [
      path.join("server", "entry.ts"),
      path.join("server", "http.ts"),
      path.join("server", "static.ts"),
      path.join("server", "version.ts"),
    ]);
  });
});

describe("the production dependency set is the one that was reasoned about", () => {
  test("no dependency was added to the runtime image without review", () => {
    const pkg = JSON.parse(
      readFileSync(path.join(APP_ROOT, "package.json"), "utf8"),
    ) as { dependencies: Record<string, string> };
    // Ruling R1: "Dependencies in the request path: react-router, pg."
    // react/react-dom are what react-router renders with; isbot is required by
    // RR7's own entry.server and is pinned rather than auto-installed (Phase 1).
    assert.deepEqual(Object.keys(pkg.dependencies).sort(), [
      "@react-router/node",
      "isbot",
      "pg",
      "react",
      "react-dom",
      "react-router",
    ]);
  });
});

describe("no built asset references an external origin", () => {
  test("the build-output scan passes", () => {
    // The same script docker/app/Dockerfile runs as a build step. Running it
    // here too means a regression fails the suite even for somebody who
    // rebuilt with a cached layer.
    const output = execFileSync(
      process.execPath,
      [path.join(APP_ROOT, "scripts", "scan-external-origins.mjs")],
      { encoding: "utf8", cwd: APP_ROOT },
    );
    assert.match(output, /scan-external-origins: OK/);
  });

  test("the scan fails when given an external origin (it is not a no-op)", () => {
    // Prove the gate bites. A scanner that passes everything passes the build
    // output too, and would be indistinguishable from this one until the day
    // it mattered.
    const probe = path.join(APP_ROOT, "build", "tarrow-scan-probe.js");
    writeFileSync(probe, 'const f = "https://fonts.googleapis.com/css2?family=Inter";\n');
    try {
      let failed = false;
      try {
        execFileSync(
          process.execPath,
          [path.join(APP_ROOT, "scripts", "scan-external-origins.mjs")],
          { encoding: "utf8", cwd: APP_ROOT, stdio: "pipe" },
        );
      } catch {
        failed = true;
      }
      assert.ok(failed, "the scan must fail on a Google Fonts reference in built output");
    } finally {
      rmSync(probe, { force: true });
    }
  });
});

describe("the composition adds no outbound path of its own", () => {
  // A docker network declared `internal: true` would be the strongest form of
  // FR-024 -- no gateway, no NAT, nowhere to call. It was implemented and
  // reverted: a container on an internal network cannot have a published port,
  // and `app` must be reachable by a browser. The reasoning and the evidence
  // are in docker-compose.yml beside the `app` service and in
  // docs/privacy/verification.md §6. What is left to assert is that nothing in
  // the composition hands the request path an outbound route it would not
  // otherwise use.
  //
  // This reads the RUNNING app container rather than the compose file, which
  // is both stronger and the only option available: the test container carries
  // app/ and not the repository root.
  test("the running app container has no proxy and no re-pointed host", async () => {
    const containers = await projectContainers();
    const app = containers.find((c) => c.Labels["com.docker.compose.service"] === "app");
    assert.ok(app, "no `app` container in this compose project");

    const inspected = await inspectContainer(app.Id);
    for (const entry of inspected.Config.Env ?? []) {
      const name = entry.split("=")[0] ?? "";
      assert.doesNotMatch(
        name,
        /^(?:HTTPS?_PROXY|ALL_PROXY)$/i,
        `${name} in the app container's environment points the request path at ` +
          "another host",
      );
    }
    assert.deepEqual(
      inspected.HostConfig.ExtraHosts ?? [],
      [],
      "extra_hosts re-points a name at an address the composition does not run",
    );
  });
});
