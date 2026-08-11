#!/usr/bin/env node
// Asks a running instance what it is, and fails if it is not what it should be.
//
// WHY A HEALTH CHECK WAS NOT ENOUGH
//
// demo.tarrow.org served 2026-08-06 code until 2026-08-11 while returning 200
// to everything. Its container was healthy. Its compose healthcheck --
// `fetch('/').then(r => r.ok)` -- passed on every interval for five days. Every
// check anyone had asked "is it up", and it was up. None of them asked "is it
// the thing we shipped", so nobody found out for five days.
//
// This script asks the second question, from outside, against the real origin:
// through Cloudflare, through the tunnel, against the process actually serving
// the public. That is the same vantage point a stranger auditing the claim has,
// and under the pull-based deploy (docs/decisions/task-0025-pull-based-cd.md)
// it is the ONLY vantage point CI has -- no CI job can read the host's logs,
// by design.
//
// USAGE
//
//     node scripts/verify-deployed-version.mjs --expect 0.1.0
//     node scripts/verify-deployed-version.mjs --expect 0.1.0 --origin https://demo.tarrow.org
//     node scripts/verify-deployed-version.mjs --expect 0.1.0 --timeout 600
//
// With --timeout it POLLS until the origin reports the expected version or the
// deadline passes, which is what a pull-based deploy needs: the host picks the
// release up on its own schedule, so "not yet" and "never" are different
// answers and only time tells them apart.
//
// Exit 0 = the origin serves the expected version. Exit 1 = it does not, or
// stopped answering, or the deadline passed.

const DEFAULT_ORIGIN = "https://demo.tarrow.org";
const POLL_SECONDS = 15;

function parseArgs(argv) {
  const out = { origin: DEFAULT_ORIGIN, expect: null, timeout: 0 };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--origin") out.origin = argv[++i];
    else if (argv[i] === "--expect") out.expect = argv[++i];
    else if (argv[i] === "--timeout") out.timeout = Number(argv[++i]);
  }
  return out;
}

/**
 * The version is normalised on both sides before comparison so that a release
 * tag and what the image was stamped with can be written either way. `v0.1.0`,
 * `0.1.0` and a leading/trailing space are the same claim; `sha-0a24287` is
 * compared verbatim.
 */
function normalise(v) {
  return String(v ?? "").trim().replace(/^v/, "");
}

async function readVersion(origin) {
  const res = await fetch(new URL("/version", origin), {
    headers: { Accept: "application/json" },
    redirect: "manual",
  });

  if (!res.ok) {
    // A 404 is the single most likely failure and deserves its own sentence:
    // it means the instance predates this endpoint, which is itself the answer
    // -- it is running something older than the build that introduced it.
    if (res.status === 404) {
      throw new Error(
        "the origin has no /version endpoint. That instance is older than the " +
          "build that added one (TASK-0025), so it is definitively not current.",
      );
    }
    throw new Error(`/version answered HTTP ${res.status}`);
  }

  const body = await res.json();
  return { version: normalise(body.version), revision: String(body.revision ?? "") };
}

async function attempt(origin, expected) {
  const { version, revision } = await readVersion(origin);

  if (version === "unknown" || version === "") {
    throw new Error(
      "the origin reports version `unknown` -- it is running an image that was " +
        "never stamped with a release (a local or hand-built one). Nobody can " +
        "prove what is running there.",
    );
  }

  if (version !== expected) {
    throw new Error(
      `the origin serves ${version} (revision ${revision || "unknown"}), ` +
        `expected ${expected}`,
    );
  }

  return { version, revision };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { origin, expect, timeout } = parseArgs(process.argv.slice(2));

  if (!expect) {
    process.stderr.write(
      "verify-deployed-version: --expect <version> is required.\n" +
        "There is no default: a verification that invents its own expectation " +
        "cannot fail, and a check that cannot fail is not a check.\n",
    );
    process.exit(1);
  }

  const expected = normalise(expect);
  const deadline = Date.now() + Math.max(0, timeout) * 1000;
  let last = null;

  for (;;) {
    try {
      const { version, revision } = await attempt(origin, expected);
      process.stdout.write(
        `${origin} serves ${version}` +
          (revision && revision !== "unknown" ? ` (revision ${revision})` : "") +
          " -- as expected.\n",
      );
      return;
    } catch (err) {
      last = err;
      if (Date.now() >= deadline) break;
      process.stdout.write(
        `not yet: ${err.message}. Retrying in ${POLL_SECONDS}s...\n`,
      );
      await sleep(POLL_SECONDS * 1000);
    }
  }

  process.stderr.write(
    "\n" +
      `THE ORIGIN IS NOT SERVING ${expected}.\n` +
      "\n" +
      `  origin: ${origin}\n` +
      `  ${last?.message ?? "unknown failure"}\n` +
      "\n" +
      (timeout > 0
        ? `Polled for ${timeout}s. Under the pull-based deploy the host picks up a\n` +
          "release on its own schedule, so a slow deploy and a failed one look the\n" +
          "same until the deadline passes. This one passed.\n\n"
        : "") +
      "This is the check that would have caught the five days demo.tarrow.org\n" +
      "spent serving pre-redesign code while healthy and answering every request.\n" +
      "Do not treat a 200 from the site as evidence against it.\n",
  );
  process.exit(1);
}

main().catch((err) => {
  process.stderr.write(`\nverify-deployed-version: ${err?.stack || err}\n`);
  process.exit(1);
});
