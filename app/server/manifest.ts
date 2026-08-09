// Building the coverage manifest from sql/query/manifest.sql.
//
// Everything below is a shape translation. There is no list of layers here, no
// list of gaps, no hardcoded set of what this release covers -- Principle II
// says coverage is "data rendered to the user, never an assumption baked into
// the code", and a constant in this file would be exactly that assumption.
//
// The one thing this module does add is a GATE: it refuses to produce a
// manifest at all unless the coverage-gap ledger carries a `rule_content` row.
// That row is the disclosure that tarrow's 304.8 m buffer is not verified rule
// data (Principle V is only partially satisfied in this release -- plan.md
// Complexity Tracking). Deleting it does not quietly remove a paragraph from a
// page; it fails every search loudly. That is the difference between honesty
// held as a gate and honesty held as a habit.

import type { PoolClient } from "pg";

import { query } from "./db.ts";
import type {
  CoverageManifest,
  LoadedCoverageManifest,
  ManifestGap,
  ManifestLayer,
  ManifestMeasurementBasis,
  ManifestRuleContent,
  UnreadableCoverageManifest,
} from "./result.ts";

/** The gap-ledger subject type carrying tarrow's own rule-content disclosure. */
export const RULE_CONTENT_SUBJECT_TYPE = "rule_content";

export class MissingRuleDisclosureError extends Error {}

interface RawLayer {
  id: string;
  description: string;
  source_url: string;
  jurisdiction: string;
  fetched_at: string | null;
  verified_at: string | null;
  row_count: number | null;
  notes: string | null;
  queried: boolean;
}

interface RawGap {
  id: number;
  layer_id: string | null;
  subject_type: string;
  subject_ref: string | null;
  label: string;
  description: string;
  discovered_at: string | null;
}

interface RawBasis {
  match_basis: string;
  match_corroboration: string | null;
  premises: number;
  uncertainty_m: number | null;
}

interface RawManifestRow {
  layers: RawLayer[] | null;
  gaps: RawGap[] | null;
  measurement_bases: RawBasis[] | null;
  premises: { total: number; measurable: number; not_measurable: number } | null;
  address_point_count: string;
  measurable_parcel_count: string;
  data_fetched_at: Date | null;
  oldest_layer_fetched_at: Date | null;
  buffer_m: number;
}

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

/**
 * Read the manifest. Throws MissingRuleDisclosureError when the gap ledger
 * carries no rule-content row -- see the gate described at the top of this
 * file. Every other failure propagates as-is, and the caller renders an
 * explicitly unreadable manifest rather than a confident empty one.
 */
export async function readManifest(
  client: PoolClient,
): Promise<LoadedCoverageManifest> {
  const { rows } = await client.query<RawManifestRow>(query("manifest"));
  const row = rows[0];
  if (row === undefined) {
    throw new Error("manifest query returned no row");
  }

  const gaps: ManifestGap[] = (row.gaps ?? []).map((g) => ({
    id: g.id,
    layerId: g.layer_id,
    subjectType: g.subject_type,
    subjectRef: g.subject_ref,
    label: g.label,
    description: g.description,
    discoveredAt: iso(g.discovered_at),
  }));

  const ruleGap = gaps.find(
    (g) => g.subjectType === RULE_CONTENT_SUBJECT_TYPE,
  );
  if (ruleGap === undefined) {
    throw new MissingRuleDisclosureError(
      `The coverage-gap ledger carries no '${RULE_CONTENT_SUBJECT_TYPE}' row. ` +
        `That row is how every answer discloses that tarrow's buffer is applied ` +
        `without the file-authored, human-verified rule record Constitution ` +
        `Principle V requires (TASK-0003 builds it). Serving results without ` +
        `the disclosure would let the interface imply a verification that never ` +
        `happened, so no result is served at all until it is restored ` +
        `(app/etl/sources.ts, DECLARED_GAPS).`,
    );
  }

  const ruleContent: ManifestRuleContent = {
    verified: false,
    source: "coverage-gap-ledger",
    subjectRef: ruleGap.subjectRef ?? RULE_CONTENT_SUBJECT_TYPE,
    statement: ruleGap.description,
  };

  const layers: ManifestLayer[] = (row.layers ?? []).map((l) => ({
    id: l.id,
    description: l.description,
    sourceUrl: l.source_url,
    jurisdiction: l.jurisdiction,
    fetchedAt: iso(l.fetched_at),
    verifiedAt: iso(l.verified_at),
    rowCount: l.row_count,
    notes: l.notes,
    queried: l.queried,
  }));

  const measurementBases: ManifestMeasurementBasis[] = (
    row.measurement_bases ?? []
  ).map((b) => ({
    matchBasis: b.match_basis,
    matchCorroboration: b.match_corroboration,
    premises: Number(b.premises),
    uncertaintyMeters: b.uncertainty_m,
  }));

  return {
    availability: "read-from-data",
    deliveryPath: "server-query-endpoint",
    layers,
    gaps,
    measurementBases,
    premises: {
      total: Number(row.premises?.total ?? 0),
      measurable: Number(row.premises?.measurable ?? 0),
      notMeasurable: Number(row.premises?.not_measurable ?? 0),
    },
    ruleContent,
    bufferMeters: Number(row.buffer_m),
    addressPointCount: Number(row.address_point_count),
    measurableParcelCount: Number(row.measurable_parcel_count),
    dataFetchedAt: iso(row.data_fetched_at),
    oldestLayerFetchedAt: iso(row.oldest_layer_fetched_at),
  };
}

/**
 * The manifest when the ledger itself could not be read. Still mandatory on
 * the result, and it says the only thing that is true in that state: nothing
 * was checked, and tarrow cannot even tell you what it would have checked.
 *
 * The rule-content statement here is not read from data because there is no
 * data to read. It claims no coverage -- it withdraws every claim -- which is
 * why it is not the hardcoded coverage list Principle II forbids.
 */
export function unreadableManifest(
  statement: string,
): UnreadableCoverageManifest {
  return {
    availability: "could-not-be-read",
    deliveryPath: "server-query-endpoint",
    ruleContent: {
      verified: false,
      source: "could-not-be-read",
      // Rendered to a member of the public. No issue numbers, no internal
      // task ids, no "not yet built" -- see DeclaredGap.description in
      // app/etl/sources.ts for why.
      statement:
        "tarrow could not read its own coverage record, so it cannot say which " +
        "layers were loaded, which are absent, or how old any of them are. " +
        "Nothing was checked. Its buffer is in any case not verified rule data: " +
        "no rule record checked by a person exists here.",
    },
    statement,
  };
}

/** True when the manifest was read from data rather than withdrawn. */
export function manifestWasRead(
  manifest: CoverageManifest,
): manifest is LoadedCoverageManifest {
  return manifest.availability === "read-from-data";
}
