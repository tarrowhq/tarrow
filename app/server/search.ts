// The query path: a typed address in, an honest answer out.
//
// This module is where DECISION §1, §2, §3 and §4 stop being documents and
// start being control flow. The order below is the safety argument:
//
//   1. Read the coverage manifest FIRST. Every answer carries it, including
//      the ones that say nothing was found -- so it is not something appended
//      to a result later, it is a precondition of producing one.
//   2. Refuse to answer at all when a layer a search traverses is empty. An
//      unloaded database must say its data is absent, never return an empty
//      confident-looking result.
//   3. Resolve. Address Points, then geometry. No fuzzy match, no coarse
//      fallback, no consolation -- see sql/query/resolve_address.sql.
//   4. Decline when the resolved point has no parcel. Measuring a residence
//      from a bare point overstates distance and therefore UNDER-restricts,
//      which is the unrecoverable error (DECISION §3).
//   5. Measure on the pessimistic bound, and check the arithmetic's sign at
//      runtime before trusting it.
//
// Nothing here logs. Not the address, not a normalized form of it, not a
// parcel id, not a timing. Principle III: the uniquely dangerous datum is
// where somebody is TRYING to move, and it exists nowhere else in the world --
// somap does not create it as a record. Error details below are drawn from
// fixed strings and never interpolate anything the user typed.

import type { PoolClient } from "pg";

import { pool, query } from "./db.ts";
import {
  MissingRuleDisclosureError,
  readManifest,
  unreadableManifest,
} from "./manifest.ts";
import type {
  AmbiguityCandidate,
  AmbiguityDeclaration,
  FlaggedPremises,
  LoadedCoverageManifest,
  PremisesCorroboration,
  PremisesMeasurementBasis,
  ResidenceMeasurementBasis,
  ResolvedResidence,
  SearchResult,
} from "./result.ts";

interface ResolveRow {
  normalized_input: string | null;
  address_point_id: string | null;
  full_address: string | null;
  city: string | null;
  zip: string | null;
  parcel_id: string | null;
  site_address: string | null;
  municipality: string | null;
  municipality_id: string | null;
  match_basis: ResidenceMeasurementBasis | null;
  gap_m: number | null;
  residence_uncertainty_m: number | null;
}

interface ProximityRow {
  parcel_id: string;
  premises_id: string;
  name: string;
  school_type: string;
  layer_id: string;
  match_basis: PremisesMeasurementBasis;
  match_corroboration: PremisesCorroboration | null;
  street: string | null;
  city: string | null;
  d_m: number;
  residence_uncertainty_m: number;
  premises_uncertainty_m: number;
  d_min_m: number;
  buffer_m: number;
}

/** A residence parcel a typed address might mean, plus what flags against it. */
interface Candidate {
  readonly residence: ResolvedResidence;
  readonly uncertaintyMeters: number;
  premises: FlaggedPremises[];
}

/**
 * Guard on the direction of the uncertainty arithmetic.
 *
 * DECISION §3: d_min = d - r_a - r_b, flag when d_min < buffer. Both radii are
 * SUBTRACTED, so d_min can never exceed d. A d_min larger than d would mean a
 * radius was added somewhere -- which would shrink the flagged set and
 * under-restrict, the one error Principle I calls unrecoverable. If that ever
 * becomes true, this throws and the search fails loudly rather than returning a
 * quietly wrong answer.
 */
function assertPessimistic(row: ProximityRow): void {
  const expected = row.d_m - row.residence_uncertainty_m - row.premises_uncertainty_m;
  const drift = Math.abs(expected - row.d_min_m);
  if (drift > 1e-6 || row.d_min_m > row.d_m || row.d_min_m >= row.buffer_m) {
    throw new Error(
      "proximity arithmetic failed its own sign check: d_min must equal " +
        "d - r_a - r_b, must never exceed d, and must be below the buffer to " +
        "have been returned at all. Subtracting the radii is what makes the " +
        "flag more likely; an addition here is the unrecoverable defect.",
    );
  }
}

function toResidence(row: ResolveRow): ResolvedResidence {
  if (row.parcel_id === null || row.match_basis === null) {
    throw new Error("toResidence called on a row with no parcel");
  }
  return {
    parcelId: Number(row.parcel_id),
    siteAddress: row.site_address,
    municipality: row.municipality,
    addressLabel: row.full_address,
    measurementBasis: row.match_basis,
    uncertaintyMeters: row.residence_uncertainty_m ?? 0,
  };
}

function toFlagged(row: ProximityRow): FlaggedPremises {
  return {
    premisesId: Number(row.premises_id),
    name: row.name,
    schoolType: row.school_type,
    layerId: row.layer_id,
    street: row.street,
    city: row.city,
    measurementBasis: row.match_basis,
    corroboration: row.match_corroboration,
    distanceMeters: row.d_m,
    residenceUncertaintyMeters: row.residence_uncertainty_m,
    premisesUncertaintyMeters: row.premises_uncertainty_m,
    pessimisticDistanceMeters: row.d_min_m,
    bufferMeters: row.buffer_m,
  };
}

function nearest(premises: readonly FlaggedPremises[]): number | null {
  let best: number | null = null;
  for (const p of premises) {
    if (best === null || p.pessimisticDistanceMeters < best) {
      best = p.pessimisticDistanceMeters;
    }
  }
  return best;
}

/**
 * Rank candidates most-restrictive first (DECISION §4: where candidates
 * disagree, somap resolves to the most restrictive -- it never silently picks
 * one). More flags beats fewer; among equals, the nearer pessimistic distance
 * wins; parcel id breaks remaining ties so two identical searches cannot
 * disagree between runs.
 */
function mostRestrictiveFirst(a: Candidate, b: Candidate): number {
  if (a.premises.length !== b.premises.length) {
    return b.premises.length - a.premises.length;
  }
  const na = nearest(a.premises);
  const nb = nearest(b.premises);
  if (na !== null && nb !== null && na !== nb) return na - nb;
  if (na !== null && nb === null) return -1;
  if (na === null && nb !== null) return 1;
  return a.residence.parcelId - b.residence.parcelId;
}

function declareAmbiguity(
  candidates: readonly Candidate[],
): AmbiguityDeclaration | null {
  if (candidates.length < 2) return null;
  const rows: AmbiguityCandidate[] = candidates.map((c) => ({
    parcelId: c.residence.parcelId,
    siteAddress: c.residence.siteAddress,
    municipality: c.residence.municipality,
    flaggedPremisesCount: c.premises.length,
    nearestPessimisticDistanceMeters: nearest(c.premises),
  }));
  return {
    candidateCount: candidates.length,
    resolution: "most-restrictive-candidate",
    candidates: rows,
  };
}

/**
 * Answer one address.
 *
 * Returns a result for every input. It never throws to its caller, because a
 * thrown error would have to be rendered by somebody who might render it as
 * nothing at all -- and a blank page after typing an address reads like a
 * clean answer. A failure is a variant of the result, with the manifest on it.
 */
export async function search(
  rawAddress: string,
  /**
   * How to obtain a database connection. Defaults to the application pool.
   * Parameterised only so tests can reach the failure variants -- an
   * unreachable database, a failing query, a ledger missing its rule-content
   * disclosure -- and assert that each still carries a coverage manifest. There
   * is no production caller that passes anything else.
   */
  connect: () => Promise<PoolClient> = () => pool.connect(),
): Promise<SearchResult> {
  const client = await connect().catch(() => null);
  if (client === null) {
    return {
      kind: "search-failed",
      manifest: unreadableManifest(
        "somap could not reach its database, so no address was checked against anything.",
      ),
      reason: "database-unreachable",
      detail:
        "The database could not be reached. Nothing was checked. This is a " +
        "fault in this somap instance, not an answer about the address.",
    };
  }

  try {
    let manifest: LoadedCoverageManifest;
    try {
      manifest = await readManifest(client);
    } catch (err) {
      const missingDisclosure = err instanceof MissingRuleDisclosureError;
      return {
        kind: "search-failed",
        manifest: unreadableManifest(
          missingDisclosure
            ? "somap's record of what it does and does not cover is missing its " +
              "rule-content disclosure, so no result may be served."
            : "somap could not read its coverage record, so nothing was checked.",
        ),
        reason: missingDisclosure ? "query-failed" : "database-unreachable",
        detail: missingDisclosure
          ? "This instance's coverage-gap ledger is missing the row disclosing " +
            "that its distance rule is not verified data. somap will not serve " +
            "a result that could be read as a verified legal conclusion, so it " +
            "serves none."
          : "The coverage record could not be read. Nothing was checked.",
      };
    }

    // An empty layer is not an empty answer. Refuse before resolving anything.
    if (
      manifest.addressPointCount === 0 ||
      manifest.measurableParcelCount === 0 ||
      manifest.premises.measurable === 0
    ) {
      return {
        kind: "declined",
        manifest,
        reason: "data-not-loaded",
        detail:
          "This somap instance has no data loaded for one or more of the layers " +
          "a search must read, so nothing could be checked. An empty database " +
          "cannot produce an answer about an address -- only the appearance of " +
          "one. Run the documented ingest, and confirm with the registering " +
          "sheriff's office in the meantime.",
      };
    }

    let resolved: ResolveRow[];
    try {
      const result = await client.query<ResolveRow>(query("resolve_address"), [
        rawAddress,
      ]);
      resolved = result.rows;
    } catch {
      // Deliberately does not inspect or forward the error: an error may say
      // what failed, never what was searched (FR-027).
      return {
        kind: "search-failed",
        manifest,
        reason: "query-failed",
        detail:
          "The address lookup failed inside this somap instance. Nothing was " +
          "checked, and nothing about the address was recorded.",
      };
    }

    const first = resolved[0];
    if (first === undefined || first.normalized_input === null) {
      return {
        kind: "could-not-locate",
        manifest,
        reason: "input-normalized-to-nothing",
        detail:
          "What was entered did not reduce to an address somap can look up. " +
          "somap does not guess at a nearby street, a ZIP code, or a city " +
          "centre: it says it could not locate the address.",
      };
    }

    const points = resolved.filter((r) => r.address_point_id !== null);
    if (points.length === 0) {
      return {
        kind: "could-not-locate",
        manifest,
        reason: "no-address-point-matched",
        detail:
          "No address point published by Summit County matches this address. " +
          "somap does not fuzzy-match, and it returns no ZIP centroid, street " +
          "centroid, or nearby parcel in place of a match -- a confident wrong " +
          "building is more dangerous than no answer. The address may be " +
          "outside Summit County, may be spelled differently in the county's " +
          "records, or may not be published by the county at all.",
      };
    }

    const withoutParcel = points.filter((r) => r.parcel_id === null);
    if (withoutParcel.length === points.length) {
      return {
        kind: "declined",
        manifest,
        reason: "resolved-point-has-no-parcel",
        detail:
          "This address resolved to a point, but that point sits on no county " +
          "parcel and within 5 m of none either. Measuring from a bare point " +
          "would overstate the distance to every school, which risks calling an " +
          "address outside the buffer when it is not. somap declines rather " +
          "than measure it. Confirm this address with the registering " +
          "sheriff's office.",
      };
    }
    if (withoutParcel.length > 0) {
      return {
        kind: "declined",
        manifest,
        reason: "some-candidates-have-no-parcel",
        detail:
          "This address matches several county address points, and at least one " +
          "of them sits on no parcel that somap can measure from. Answering for " +
          "the rest would state a result while silently leaving one possible " +
          "location unchecked. somap declines instead. Confirm this address " +
          "with the registering sheriff's office.",
      };
    }

    // One candidate per distinct parcel. Several address points on one parcel
    // are one answer, not an ambiguity: every unit of a building sits on the
    // same parcel and is the same distance from every premises.
    const byParcel = new Map<string, Candidate>();
    for (const row of points) {
      const key = row.parcel_id as string;
      if (!byParcel.has(key)) {
        byParcel.set(key, {
          residence: toResidence(row),
          uncertaintyMeters: row.residence_uncertainty_m ?? 0,
          premises: [],
        });
      }
    }
    const candidates = [...byParcel.values()];

    let flagged: ProximityRow[];
    try {
      const result = await client.query<ProximityRow>(query("proximity"), [
        candidates.map((c) => c.residence.parcelId),
        candidates.map((c) => c.uncertaintyMeters),
      ]);
      flagged = result.rows;
    } catch {
      return {
        kind: "search-failed",
        manifest,
        reason: "query-failed",
        detail:
          "The proximity measurement failed inside this somap instance. No " +
          "distance was computed, so no statement about this address is being " +
          "made either way.",
      };
    }

    for (const row of flagged) {
      assertPessimistic(row);
      byParcel.get(row.parcel_id)?.premises.push(toFlagged(row));
    }

    candidates.sort(mostRestrictiveFirst);
    const chosen = candidates[0];
    if (chosen === undefined) {
      throw new Error("no candidate after resolution, which cannot happen");
    }
    const ambiguity = declareAmbiguity(candidates);
    // Never a literal. Both sources are the same SQL function
    // (somap_unverified_state_buffer_m), so the number cannot disagree with
    // itself between the measurement and the disclosure of the measurement.
    const bufferMeters = chosen.premises[0]?.bufferMeters ?? manifest.bufferMeters;

    if (chosen.premises.length > 0) {
      return {
        kind: "premises-within-buffer",
        manifest,
        residence: chosen.residence,
        premises: chosen.premises,
        bufferMeters,
        ambiguity,
      };
    }

    return {
      kind: "outside-every-buffer-we-checked",
      manifest,
      residence: chosen.residence,
      bufferMeters,
      ambiguity,
    };
  } catch {
    return {
      kind: "search-failed",
      manifest: unreadableManifest(
        "somap failed while answering, so it is making no statement about this address.",
      ),
      reason: "query-failed",
      detail:
        "This somap instance failed while answering. Nothing about the address " +
        "was recorded, and no statement about it is being made.",
    };
  } finally {
    client.release();
  }
}
