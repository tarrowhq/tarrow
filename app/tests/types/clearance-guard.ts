// The always-on half of the clearance proof.
//
// Same constructions as tests/types/clearance.compile-failure.ts, but each one
// carries `@ts-expect-error`, which INVERTS the check: this file compiles only
// while every construction below is still an error. If somebody makes a
// clearance expressible, `@ts-expect-error` becomes an unused directive and
// `npm run typecheck` fails on this file -- in the ordinary build, without
// anyone running the dedicated test.
//
// The separate fixture exists as well because a passing typecheck here proves
// "these are errors" only to the compiler. The test that runs `tsc` on the
// other file and reads its non-zero exit is what proves it to a human reading
// the test output.

import type {
  AssertNoPermissionVocabulary,
  CoverageManifest,
  SearchResult,
} from "../../server/result.ts";

declare const manifest: CoverageManifest;

// @ts-expect-error -- there is no result variant meaning "clear".
export const noClearVariant: SearchResult = { kind: "clear", manifest };

export const noPermittedField: SearchResult = {
  kind: "could-not-locate",
  manifest,
  reason: "no-address-point-matched",
  detail: "",
  // @ts-expect-error -- no field may name permission, and none may be added.
  permitted: true,
};

export const noPermissiveReason: SearchResult = {
  kind: "declined",
  manifest,
  // @ts-expect-error -- a decline reason may not read as permission.
  reason: "address-is-legal",
  detail: "",
};

// @ts-expect-error -- the coverage manifest is mandatory on every variant.
export const manifestIsMandatory: SearchResult = {
  kind: "could-not-locate",
  reason: "no-address-point-matched",
  detail: "",
};

interface AddressIsClear {
  readonly kind: "clear-to-live-here";
  readonly manifest: CoverageManifest;
}

// @ts-expect-error -- widening the union to admit a clearance is itself
// rejected: the assertion resolves to "clear-to-live-here", not `true`.
export const wideningIsRejected: AssertNoPermissionVocabulary<
  (SearchResult | AddressIsClear)["kind"]
> = true;
