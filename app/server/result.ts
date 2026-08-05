// The shape of an answer.
//
// Constitution Principle I: "tarrow never says 'approved,' 'legal,' or 'clear.'
// The strongest available answer is 'outside every buffer we checked.'"
// Spec FR-010 sharpens that into a requirement on THIS file: "An unqualified
// clearance MUST be structurally inexpressible, not merely absent from the
// current rendering."
//
// Two mechanisms, and the difference between them is the whole point.
//
//   1. The result is a CLOSED discriminated union. None of its inhabitants
//      means approved, legal, permitted, or clear. That alone is only
//      "absent from the current rendering" -- somebody could add one.
//
//   2. A set of type-level assertions at the bottom of this file rejects, AT
//      COMPILE TIME, any kind, reason, basis, or FIELD NAME anywhere in the
//      union whose text carries permission vocabulary. Adding a
//      `kind: "clear"` variant, or a `permitted: boolean` field, does not
//      produce a result somebody must remember not to render -- it produces a
//      build failure in this file, in code the author of that variant never
//      touched. That is the structural half, and it is what FR-010 asks for.
//
// tests/types/clearance.compile-failure.ts is the executable proof: a fixture
// that adds exactly such a variant, and a test asserting `tsc` refuses it.
//
// Every variant carries the coverage manifest as a MANDATORY field, including
// declines and failures (Principle II: absence of a flag is meaningful only
// against a stated list of what was searched). A type-level assertion enforces
// that too, so a new variant cannot be added without one.

// ---------------------------------------------------------------------------
// The vocabulary that may never name a state of this type
// ---------------------------------------------------------------------------

/**
 * Substrings that would make a name read as permission. Substrings rather than
 * whole words so that "approved", "approval", "preapproved" and "APPROVE" are
 * all caught by "approv" -- an enumeration of exact words is something a
 * plausible synonym walks straight past.
 */
type PermissionWord =
  | "clear"
  | "approv"
  | "legal"
  | "permit"
  | "allow"
  | "complian"
  | "eligib"
  | "unrestricted"
  | "norestrict"
  | "no-restrict"
  | "lawful"
  | "authoriz"
  | "authoris"
  | "qualif"
  | "granted"
  | "safe"
  | "okay"
  | "green"
  | "valid"
  | "pass";

/** True when `S` reads as permission under the vocabulary above. */
export type MentionsPermission<S extends string> =
  Lowercase<S> extends `${string}${PermissionWord}${string}` ? true : false;

/** The members of `U` that read as permission. `never` when there are none. */
type PermissionMembers<U extends string> = U extends string
  ? MentionsPermission<U> extends true
    ? U
    : never
  : never;

/**
 * `true` when no member of `U` reads as permission; otherwise the offending
 * member itself, so the compiler error names it.
 *
 * Used as the declared type of a `true` constant: when a forbidden member
 * exists the constant stops type-checking and the diagnostic reads
 * `Type 'true' is not assignable to type '"clear"'`.
 */
export type AssertNoPermissionVocabulary<U extends string> = [
  PermissionMembers<U>,
] extends [never]
  ? true
  : PermissionMembers<U>;

/** Every key of every member of a union. */
type KeysOf<T> = T extends unknown ? Extract<keyof T, string> : never;

// ---------------------------------------------------------------------------
// The coverage manifest
// ---------------------------------------------------------------------------

/**
 * Which of DECISION §5's two delivery paths produced this answer. The
 * precomputed client-side index is out of scope for this release; the field
 * exists from the start so the manifest states which path answered rather than
 * acquiring the question later (DECISION §6).
 */
export type DeliveryPath = "server-query-endpoint";

export interface ManifestLayer {
  readonly id: string;
  readonly description: string;
  readonly sourceUrl: string;
  readonly jurisdiction: string;
  /** When this layer's data was last fetched. Null means never loaded. */
  readonly fetchedAt: string | null;
  /**
   * When a human last verified this layer. Null means NEVER -- rendered as
   * exactly that. No layer in this release has been human-verified, and a
   * fetch date is not permitted to stand in for a verification date
   * (Principle V).
   */
  readonly verifiedAt: string | null;
  readonly rowCount: number | null;
  readonly notes: string | null;
  /** Whether this layer actually contributed rows a search reads. */
  readonly queried: boolean;
}

export interface ManifestGap {
  readonly id: number;
  readonly layerId: string | null;
  readonly subjectType: string;
  readonly subjectRef: string | null;
  readonly description: string;
  readonly discoveredAt: string | null;
}

export interface ManifestMeasurementBasis {
  readonly matchBasis: string;
  readonly matchCorroboration: string | null;
  readonly premises: number;
  /** r_b applied to every premises on this basis, in metres. */
  readonly uncertaintyMeters: number | null;
}

export interface ManifestPremisesCounts {
  readonly total: number;
  /** Premises with real parcel geometry -- the ones distance was measured to. */
  readonly measurable: number;
  /**
   * Premises tarrow holds a name for but no boundary. NOT measured and NOT
   * approximated by a radius (DECISION §3). Each has a gap-ledger row.
   */
  readonly notMeasurable: number;
}

/**
 * The state of tarrow's own rule content.
 *
 * There is deliberately NO `verified: true` inhabitant. This release applies
 * ORC 2950.034's buffer without the file-authored, human-verified rule record
 * Principle V requires -- TASK-0003 builds that pipeline -- and the interface
 * must not be able to imply otherwise. When TASK-0003 lands it adds the
 * verified variant along with the data that earns it.
 */
export type ManifestRuleContent =
  | {
      readonly verified: false;
      /** Read from the coverage-gap ledger, not written down in code. */
      readonly source: "coverage-gap-ledger";
      readonly subjectRef: string;
      readonly statement: string;
    }
  | {
      readonly verified: false;
      readonly source: "could-not-be-read";
      readonly statement: string;
    };

export type ManifestAvailability = "read-from-data" | "could-not-be-read";

export interface LoadedCoverageManifest {
  readonly availability: "read-from-data";
  readonly deliveryPath: DeliveryPath;
  readonly layers: readonly ManifestLayer[];
  readonly gaps: readonly ManifestGap[];
  readonly measurementBases: readonly ManifestMeasurementBasis[];
  readonly premises: ManifestPremisesCounts;
  readonly ruleContent: ManifestRuleContent;
  /** The buffer applied, in metres. See ruleContent: it is not verified data. */
  readonly bufferMeters: number;
  readonly addressPointCount: number;
  readonly measurableParcelCount: number;
  /** Newest and oldest layer fetch dates -- how old this instance's data is. */
  readonly dataFetchedAt: string | null;
  readonly oldestLayerFetchedAt: string | null;
}

/**
 * What the manifest is when the database could not be read at all. Still a
 * manifest, still mandatory, and it says the only honest thing available:
 * nothing was checked, and we cannot even tell you what we would have checked.
 */
export interface UnreadableCoverageManifest {
  readonly availability: "could-not-be-read";
  readonly deliveryPath: DeliveryPath;
  readonly ruleContent: ManifestRuleContent;
  readonly statement: string;
}

export type CoverageManifest =
  | LoadedCoverageManifest
  | UnreadableCoverageManifest;

// ---------------------------------------------------------------------------
// Measurement detail
// ---------------------------------------------------------------------------

/** How a premises' measurement geometry was established (Phase 2's ingest). */
export type PremisesMeasurementBasis =
  | "board_of_education_parcel"
  | "named_exempt_parcel"
  | "point_in_parcel"
  | "point_near_parcel"
  | "none";

export type PremisesCorroboration = "tax_exempt_parcel" | "uncorroborated";

/** How the residence parcel was attributed to the resolved address point. */
export type ResidenceMeasurementBasis = "point_in_parcel" | "point_near_parcel";

export interface FlaggedPremises {
  readonly premisesId: number;
  readonly name: string;
  readonly schoolType: string;
  readonly layerId: string;
  readonly street: string | null;
  readonly city: string | null;
  readonly measurementBasis: PremisesMeasurementBasis;
  readonly corroboration: PremisesCorroboration | null;
  /** d(a,b): nearest parcel boundary to nearest parcel boundary, metres. */
  readonly distanceMeters: number;
  /** r_a. */
  readonly residenceUncertaintyMeters: number;
  /** r_b. */
  readonly premisesUncertaintyMeters: number;
  /** d_min = d - r_a - r_b. The value compared against the buffer. */
  readonly pessimisticDistanceMeters: number;
  readonly bufferMeters: number;
}

export interface ResolvedResidence {
  readonly parcelId: number;
  /** The county's situs label for the parcel. Never used to match. */
  readonly siteAddress: string | null;
  readonly municipality: string | null;
  /** The address point's own label, i.e. what the county calls this address. */
  readonly addressLabel: string | null;
  readonly measurementBasis: ResidenceMeasurementBasis;
  readonly uncertaintyMeters: number;
}

export interface AmbiguityCandidate {
  readonly parcelId: number;
  readonly siteAddress: string | null;
  readonly municipality: string | null;
  readonly flaggedPremisesCount: number;
  /** Smallest d_min found for this candidate; null when nothing was in range. */
  readonly nearestPessimisticDistanceMeters: number | null;
}

/**
 * One typed address matched several distinct parcels -- up to 505 for a
 * condominium; "2200 HIGH ST" appears 218 times (DECISION §4). tarrow never
 * silently picks one: the ambiguity is declared, and the answer shown is the
 * MOST RESTRICTIVE candidate.
 */
export interface AmbiguityDeclaration {
  readonly candidateCount: number;
  readonly resolution: "most-restrictive-candidate";
  readonly candidates: readonly AmbiguityCandidate[];
}

// ---------------------------------------------------------------------------
// The result union
// ---------------------------------------------------------------------------

/** At least one school premises is within the buffer of the residence parcel. */
export interface PremisesWithinBuffer {
  readonly kind: "premises-within-buffer";
  readonly manifest: CoverageManifest;
  readonly residence: ResolvedResidence;
  /** Non-empty by construction. */
  readonly premises: readonly FlaggedPremises[];
  readonly bufferMeters: number;
  readonly ambiguity: AmbiguityDeclaration | null;
}

/**
 * The strongest statement tarrow is permitted to make (Principle I). It is a
 * statement about what WE CHECKED, which is why the manifest beside it is not
 * decoration: this variant means nothing at all without the list of layers,
 * facility classes, and jurisdictions that were absent from the search.
 */
export interface OutsideEveryBufferWeChecked {
  readonly kind: "outside-every-buffer-we-checked";
  readonly manifest: CoverageManifest;
  readonly residence: ResolvedResidence;
  readonly bufferMeters: number;
  readonly ambiguity: AmbiguityDeclaration | null;
}

export type DeclineReason =
  /**
   * The address resolved, but its point sits inside no parcel and within 5 m
   * of none either. DECISION §3: measuring from a bare point OVERSTATES the
   * distance and therefore UNDER-restricts, and making it safe would mean
   * subtracting an unbounded assumed parcel reach (p95 1,575 m). So tarrow
   * declines. ~2.16% of address points, measured.
   */
  | "resolved-point-has-no-parcel"
  /**
   * Several address points matched and at least one of them has no parcel.
   * The measurable ones could be answered, but an answer covering some
   * candidates and silently omitting others is exactly the false
   * "outside every buffer" Principle I forbids. Measured cost: 61 of 232,728
   * distinct normalized addresses (0.03%).
   */
  | "some-candidates-have-no-parcel"
  /**
   * A layer a search must traverse is empty. An unloaded database must say its
   * data is absent, never return an empty confident-looking result.
   */
  | "data-not-loaded";

/** tarrow could answer, and refuses to, because answering would under-restrict. */
export interface Declined {
  readonly kind: "declined";
  readonly manifest: CoverageManifest;
  readonly reason: DeclineReason;
  readonly detail: string;
}

export type CouldNotLocateReason =
  /** Nothing in the county address layer normalizes to what was typed. */
  | "no-address-point-matched"
  /** The input reduced to nothing -- empty, or punctuation only. */
  | "input-normalized-to-nothing";

/**
 * tarrow could not resolve the address at all. Never a ZIP centroid, never a
 * street centroid, never a fuzzy match, never a nearby-parcel consolation
 * (DECISION §4) -- there is no code path that could produce one.
 */
export interface CouldNotLocate {
  readonly kind: "could-not-locate";
  readonly manifest: CoverageManifest;
  readonly reason: CouldNotLocateReason;
  readonly detail: string;
}

export type SearchFailureReason = "database-unreachable" | "query-failed";

/**
 * Something broke. `detail` is drawn from a fixed set of strings and NEVER
 * carries query context: an error may say what failed, never what was searched
 * (Principle III, FR-027).
 */
export interface SearchFailed {
  readonly kind: "search-failed";
  readonly manifest: CoverageManifest;
  readonly reason: SearchFailureReason;
  readonly detail: string;
}

export type SearchResult =
  | PremisesWithinBuffer
  | OutsideEveryBufferWeChecked
  | Declined
  | CouldNotLocate
  | SearchFailed;

/** Every inhabitant of the union, for exhaustiveness checks in renderers. */
export const SEARCH_RESULT_KINDS = [
  "premises-within-buffer",
  "outside-every-buffer-we-checked",
  "declined",
  "could-not-locate",
  "search-failed",
] as const satisfies readonly SearchResult["kind"][];

// ---------------------------------------------------------------------------
// The gates
//
// Each constant below is `true` typed as an assertion. When an assertion fails
// the declared type stops being `true` and the file does not compile -- so the
// build breaks in THIS file when somebody adds a clearance-shaped variant
// somewhere else. `npm run typecheck` (docker compose run --rm test) is where
// that surfaces.
// ---------------------------------------------------------------------------

/** No variant of the result may be named in permission vocabulary. */
const _kindsCarryNoPermission: AssertNoPermissionVocabulary<
  SearchResult["kind"]
> = true;

/** Nor may any reason a variant carries. */
const _reasonsCarryNoPermission: AssertNoPermissionVocabulary<
  DeclineReason | CouldNotLocateReason | SearchFailureReason
> = true;

/** Nor any measurement basis, corroboration, delivery path, or resolution. */
const _detailVocabularyIsSafe: AssertNoPermissionVocabulary<
  | PremisesMeasurementBasis
  | PremisesCorroboration
  | ResidenceMeasurementBasis
  | DeliveryPath
  | ManifestAvailability
  | AmbiguityDeclaration["resolution"]
  | ManifestRuleContent["source"]
> = true;

/**
 * Nor any FIELD NAME anywhere in the union or the manifest. This is the one
 * that forecloses `permitted: boolean`, `isClear`, `legalToLive`, and every
 * other shape that smuggles a verdict in as data rather than as a variant.
 */
const _fieldNamesCarryNoPermission: AssertNoPermissionVocabulary<
  | KeysOf<SearchResult>
  | KeysOf<CoverageManifest>
  | KeysOf<FlaggedPremises>
  | KeysOf<ResolvedResidence>
  | KeysOf<AmbiguityDeclaration>
  | KeysOf<AmbiguityCandidate>
  | KeysOf<ManifestLayer>
  | KeysOf<ManifestGap>
  | KeysOf<ManifestRuleContent>
  | KeysOf<ManifestPremisesCounts>
  | KeysOf<ManifestMeasurementBasis>
> = true;

/** The manifest is mandatory on EVERY variant, including declines and failures. */
const _manifestOnEveryVariant: SearchResult extends {
  readonly manifest: CoverageManifest;
}
  ? true
  : never = true;

/** ...and it is not optional, so a variant cannot omit it by leaving it undefined. */
const _manifestIsNotOptional: undefined extends SearchResult["manifest"]
  ? never
  : true = true;

/** This release cannot express a verified rule, because it does not have one. */
const _noVerifiedRuleContent: ManifestRuleContent["verified"] extends false
  ? true
  : never = true;

// The assertions are the product; referencing them keeps `noUnusedLocals`-style
// tooling from deleting the gates as dead code.
export const RESULT_TYPE_GATES = {
  _kindsCarryNoPermission,
  _reasonsCarryNoPermission,
  _detailVocabularyIsSafe,
  _fieldNamesCarryNoPermission,
  _manifestOnEveryVariant,
  _manifestIsNotOptional,
  _noVerifiedRuleContent,
} as const;
