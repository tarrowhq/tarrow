// Proof that a result meaning "clear" does not type-check.
//
// Spec FR-010 requires an unqualified clearance to be "structurally
// inexpressible, not merely absent from the current rendering." A test
// asserting that today's renderer omits a word proves the second thing and not
// the first. So this test compiles a fixture that TRIES to express a clearance
// and asserts the compiler refuses it -- five ways, including by widening the
// union, which is the way a future contributor would actually do it.
//
// Two compilers run here:
//
//   1. `tsc -p tests/types/tsconfig.compile-failure.json` over the fixture,
//      which MUST fail, with one diagnostic per case.
//   2. `npm run typecheck` over the whole app, which MUST pass -- and which
//      includes tests/types/clearance-guard.ts, where the same cases sit
//      behind @ts-expect-error. That file stops compiling if any of them ever
//      starts compiling, so the gate is enforced by the ordinary build and not
//      only by this test.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

const APP_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TSC = path.join(APP_ROOT, "node_modules", "typescript", "bin", "tsc");

function runTsc(project: string): { status: number | null; output: string } {
  const result = spawnSync(
    process.execPath,
    [TSC, "-p", project, "--pretty", "false"],
    { cwd: APP_ROOT, encoding: "utf8" },
  );
  return {
    status: result.status,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

describe("a result meaning approved, legal, permitted, or clear is inexpressible", () => {
  test("the compile-failure fixture does not compile", () => {
    const { status, output } = runTsc("tests/types/tsconfig.compile-failure.json");
    console.log("\n--- tsc over the clearance fixture ---\n" + output);

    assert.notEqual(
      status,
      0,
      "tests/types/clearance.compile-failure.ts COMPILED. A clearance is " +
        "expressible in the result type, which spec FR-010 forbids.",
    );

    const diagnostics = output.match(/error TS\d+/g) ?? [];
    assert.ok(
      diagnostics.length >= 5,
      `expected at least one diagnostic per case, got ${diagnostics.length}`,
    );

    // Each case is rejected, and rejected for its own reason.
    const cases: readonly [string, RegExp][] = [
      ["1: no variant may mean clear", /"clear"/],
      ["2: no field may name permission", /permitted/],
      ["3: no reason may read as permission", /address-is-legal/],
      ["4: the manifest is mandatory", /manifest/],
      ["5: widening the union is itself rejected", /clear-to-live-here/],
    ];
    for (const [label, pattern] of cases) {
      assert.match(output, pattern, `case ${label} was not rejected`);
    }
  });

  test("the healthy tree, including the @ts-expect-error guard, type-checks", () => {
    const result = spawnSync("npm", ["run", "typecheck"], {
      cwd: APP_ROOT,
      encoding: "utf8",
    });
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    assert.equal(
      result.status,
      0,
      "the ordinary typecheck failed. If it names tests/types/clearance-guard.ts, " +
        "an @ts-expect-error there became unused -- meaning a clearance-shaped " +
        "construction now compiles.\n" +
        output,
    );
  });
});

describe("the union's inhabitants", () => {
  test("none of them is named in permission vocabulary", async () => {
    const { SEARCH_RESULT_KINDS } = await import("../server/result.ts");
    const forbidden =
      /clear|approv|legal|permit|allow|complian|eligib|unrestricted|lawful|authoriz|qualif|granted|safe|okay|green|valid|pass/i;
    for (const kind of SEARCH_RESULT_KINDS) {
      assert.doesNotMatch(kind, forbidden, `result kind "${kind}" reads as permission`);
    }
    // The strongest available answer, per Constitution Principle I.
    assert.ok(
      SEARCH_RESULT_KINDS.includes("outside-every-buffer-we-checked"),
      "the strongest answer somap may give must exist as its own variant",
    );
  });
});
