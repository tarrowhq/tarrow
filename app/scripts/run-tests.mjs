// `npm test`, with the failure mode that reads as success taken away from it.
//
// THE HAZARD THIS SCRIPT EXISTS FOR
//
// The suite was `node --test tests/*.test.ts`. Run in the runtime image --
// `docker compose run --rm app npm test` -- the shell finds no match for the
// glob, hands the literal pattern to node, and node exits 0 having collected
// ZERO tests. The runtime image excludes tests/ by design (docker/app/
// Dockerfile copies server/, sql/ and etl/ and nothing else), so that is not a
// mistake in the image; it is a wrong invocation that prints nothing alarming
// and returns success.
//
// That was found by the orchestrator verifying Phase 3, and it is harmless
// exactly as long as a human is reading the test count. The moment it reaches
// CI, a README, or a release checklist, "everything passes" and "nothing ran"
// become the same output. Constitution Principle VII makes the container the
// only environment, so the wrong container is the mistake most available to
// make.
//
// WHAT THIS SCRIPT CHECKS, AND WHAT IT DOES NOT
//
//   1. The tests directory exists and holds at least MINIMUM_TEST_FILES files.
//      Fewer means files were lost, not that the suite got smaller quietly.
//   2. node --test reported at least MINIMUM_TESTS tests and zero failures.
//      A run that collects nothing reports `pass 0`, which now fails.
//
// It does NOT check that any particular test ran, and it is not a substitute
// for reading the output. The two floors are bumped deliberately when the
// suite grows; lowering one is a decision somebody makes in a diff.
//
// THE ONLY SANCTIONED WAY TO RUN THE SUITE:
//
//     docker compose --profile test run --rm test
//
// That builds the Dockerfile's `build` stage, which is the only stage carrying
// tests/ and the dev dependencies (tsc, which the compile-failure fixture
// needs), and it runs against the real composition as the read-only somap_app
// role. A check run on a host is not a check.

import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Bumped deliberately. See the header. */
const MINIMUM_TEST_FILES = 10;
const MINIMUM_TESTS = 146;

const APP_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DIR = path.join(APP_ROOT, "tests");

const SANCTIONED = `
  The only sanctioned way to run somap's test suite is:

      docker compose --profile test run --rm test

  \`docker compose run --rm app npm test\` cannot work: the runtime image
  deliberately carries no tests/ and no dev dependencies. It used to exit 0
  having run nothing, which is why this check exists.
`;

function refuse(why) {
  process.stderr.write(`\nsomap: REFUSING TO REPORT A PASS.\n\n  ${why}\n${SANCTIONED}\n`);
  process.exit(1);
}

if (!existsSync(TEST_DIR)) {
  refuse(
    `There is no tests directory at ${TEST_DIR}, so nothing could be ` +
      `collected. A run that collects nothing is not a run that passed.`,
  );
}

const files = readdirSync(TEST_DIR)
  .filter((name) => name.endsWith(".test.ts"))
  .sort()
  .map((name) => path.join(TEST_DIR, name));

if (files.length < MINIMUM_TEST_FILES) {
  refuse(
    `Collected ${files.length} test files from ${TEST_DIR}, and this suite ` +
      `has at least ${MINIMUM_TEST_FILES}. Either files are missing from this ` +
      `image, or the suite genuinely shrank -- in which case lower ` +
      `MINIMUM_TEST_FILES in this file, in a diff somebody reviews.`,
  );
}

const child = spawn(
  process.execPath,
  [
    "--test",
    // Pinned so the summary this script parses has a stable shape, rather than
    // changing with whether a TTY happens to be attached.
    "--test-reporter=spec",
    "--test-reporter-destination=stdout",
    ...files,
  ],
  { cwd: APP_ROOT, stdio: ["inherit", "pipe", "inherit"] },
);

let output = "";
child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  output += chunk;
  process.stdout.write(chunk);
});

child.on("close", (code, signal) => {
  // `ℹ pass 107` (spec reporter) or `# pass 107` (tap), tolerated either way.
  const read = (label) => {
    const match = output.match(new RegExp(`(?:^|\\n)\\D*${label}\\s+(\\d+)`));
    return match === null ? null : Number(match[1]);
  };
  const total = read("tests");
  const passed = read("pass");
  const failed = read("fail");

  if (signal !== null) {
    refuse(`The test process was killed by ${signal} before it could report.`);
  }
  if (total === null || passed === null || failed === null) {
    refuse(
      "node --test printed no summary, so this script cannot tell a passing " +
        "run from a run that never started.",
    );
  }
  if (passed === 0) {
    refuse(
      `node --test reported ${total} tests and ${passed} passing. A run that ` +
        `collected nothing exits 0 on its own; this does not.`,
    );
  }
  if (total < MINIMUM_TESTS) {
    refuse(
      `node --test reported ${total} tests, and this suite has at least ` +
        `${MINIMUM_TESTS}. Something was not collected -- or the suite ` +
        `genuinely shrank, in which case lower MINIMUM_TESTS in this file, in ` +
        `a diff somebody reviews.`,
    );
  }
  if (failed > 0 || code !== 0) {
    process.stderr.write(
      `\nsomap: ${failed} test${failed === 1 ? "" : "s"} failed ` +
        `(exit ${code}).\n`,
    );
    process.exit(code === 0 ? 1 : code);
  }

  process.stdout.write(
    `\nsomap: ${total} tests collected, ${passed} passed, ${failed} failed, ` +
      `across ${files.length} files.\n`,
  );
});
