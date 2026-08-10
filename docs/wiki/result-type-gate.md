---
name: result-type-gate
description: The closed result union plus compile-time assertions that reject any variant, reason, basis, or field name reading as permission — making an unqualified clearance structurally inexpressible rather than merely absent.
kind: pattern
sources:
  - app/server/result.ts
  - app/tests/types/clearance.compile-failure.ts
  - app/tests/types/clearance-guard.ts
  - app/tests/result-type.test.ts
verified_against: ad1085047fbf413d249818b651dcb224725409e3
---

# Result type gate

`app/server/result.ts` defines the shape of an answer. Constitution Principle I says tarrow
never says approved, legal, or clear; spec FR-010 sharpens that into a requirement on this
file — an unqualified clearance must be *structurally inexpressible*, not merely absent from
the current rendering.

## How it works

Two mechanisms, and the difference between them is the point.

**The union is closed.** `SearchResult` has exactly five inhabitants:
`premises-within-buffer`, `outside-every-buffer-we-checked`, `declined`, `could-not-locate`,
`search-failed`. None means approved or clear. That alone is only "absent from the current
rendering" — somebody could add one.

**The vocabulary is gated at compile time.** `PermissionWord` is a union of twenty
substrings (`clear`, `approv`, `legal`, `permit`, `allow`, `eligib`, `safe`, `valid`,
`pass`, …). Substrings rather than whole words, so "approved", "approval", "preapproved" and
"APPROVE" all fall to `approv` — an enumeration of exact words is something a plausible
synonym walks straight past. `AssertNoPermissionVocabulary<U>` evaluates to `true` when no
member offends and to *the offending member itself* otherwise, so the compiler error names
it: `Type 'true' is not assignable to type '"clear"'`.

Seven assertions at the bottom of the file are declared `true` constants using that type.
They cover kinds, reasons, measurement bases and corroborations, and — the one that
forecloses smuggling a verdict in as data — every **field name** in the union and the
manifest, via `KeysOf<T>`. Adding a `kind: "clear"` variant or a `permitted: boolean` field
produces a build failure *in this file*, in code the author never touched. Two further
assertions make the manifest mandatory and non-optional on every variant; one more pins
`ManifestRuleContent["verified"]` to `false`, so this release cannot express a verified rule
because it does not have one.

`tests/types/clearance.compile-failure.ts` is the executable proof: a fixture adding exactly
such a variant, with a test asserting `tsc` refuses it. `RESULT_TYPE_GATES` re-exports the
constants so unused-locals tooling cannot delete the gates as dead code.

The union's payload types carry the measurement vocabulary the rest of the system speaks:
`FlaggedPremises` with `distanceMeters` (d), `residenceUncertaintyMeters` (r_a),
`premisesUncertaintyMeters` (r_b), and `pessimisticDistanceMeters` (d_min); and
`AmbiguityDeclaration`, whose only resolution is `most-restrictive-candidate`.

## Connections

- [[search-orchestration]] constructs these variants; [[answer-rendering]] renders them
  without deciding anything.
- [[coverage-manifest]] is the mandatory field the assertions enforce.
- [[measurement-uncertainty]] defines the radii these fields report.
- [[constitution-and-principles]] Principle I is what this file implements.

## Operational notes

The gate surfaces through `npm run typecheck`, which runs inside
`docker compose --profile test run --rm test`. The test image is built from the Dockerfile's
`build` stage because that is the only stage carrying `tsc` — the runtime image deliberately
has no dev dependencies. See [[test-suite]].
