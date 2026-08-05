// COMPILE-FAILURE FIXTURE. This file is SUPPOSED to fail to type-check.
//
// It is excluded from app/tsconfig.json and compiled only by
// tests/types/tsconfig.compile-failure.json, which tests/result-type.test.ts
// invokes directly. The test asserts `tsc` exits non-zero and reports one error
// for each case below.
//
// Spec FR-010: "The result type MUST have no field, enum value, or state
// meaning approved, legal, permitted, or clear. An unqualified clearance MUST
// be structurally inexpressible, not merely absent from the current rendering."
//
// "Not merely absent from the current rendering" is why this file exists rather
// than a test asserting the renderer omits a word. A renderer test proves what
// today's code happens to print. These cases prove that the clearance cannot be
// WRITTEN DOWN -- that a future contributor adding one gets a build failure,
// not a result somebody downstream must remember not to display.
//
// Case 5 is the load-bearing one. Cases 1-4 show the closed union rejecting
// clearance-shaped values; case 5 shows that WIDENING the union to admit one
// is itself rejected, by an assertion the widener never edited. That is the
// difference between "absent" and "inexpressible".

import type {
  AssertNoPermissionVocabulary,
  CoverageManifest,
  SearchResult,
} from "../../server/result.ts";

// A manifest value to satisfy the mandatory field, so each case fails for the
// reason it is testing and not for a missing manifest.
declare const manifest: CoverageManifest;

// --- CASE 1 -----------------------------------------------------------------
// A result variant meaning "clear". There is no such inhabitant.
export const case1: SearchResult = {
  kind: "clear",
  manifest,
};

// --- CASE 2 -----------------------------------------------------------------
// Smuggling the verdict in as a boolean field beside a legitimate kind. The
// field-name gate in result.ts forbids the name; excess-property checking
// forbids the shape.
export const case2: SearchResult = {
  kind: "outside-every-buffer-we-checked",
  manifest,
  residence: {
    parcelId: 1,
    siteAddress: null,
    municipality: null,
    addressLabel: null,
    measurementBasis: "point_in_parcel",
    uncertaintyMeters: 0,
  },
  bufferMeters: 304.8,
  ambiguity: null,
  permitted: true,
};

// --- CASE 3 -----------------------------------------------------------------
// A decline whose reason reads as permission.
export const case3: SearchResult = {
  kind: "declined",
  manifest,
  reason: "address-is-legal",
  detail: "",
};

// --- CASE 4 -----------------------------------------------------------------
// Dropping the coverage manifest. It is mandatory on every variant, including
// this one -- an answer without the statement of what was checked is the
// Principle II failure, and it is not constructible.
export const case4: SearchResult = {
  kind: "could-not-locate",
  reason: "no-address-point-matched",
  detail: "",
};

// --- CASE 5 -----------------------------------------------------------------
// The structural one. A contributor adds a clearance variant of their own and
// widens the union. The union itself accepts that -- unions always do. What
// does NOT accept it is the vocabulary gate, which is why the gate exists:
// `AssertNoPermissionVocabulary` resolves to the offending literal instead of
// `true`, and `true` stops being assignable to it.
interface AddressIsClear {
  readonly kind: "clear-to-live-here";
  readonly manifest: CoverageManifest;
}
type WidenedResult = SearchResult | AddressIsClear;

export const case5: AssertNoPermissionVocabulary<WidenedResult["kind"]> = true;
