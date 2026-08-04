// Load the fetched NDJSON into PostGIS.
//
// Staging pattern, carried over from spikes/task-0001-geocoding/load.py: get
// the raw lines in with one bulk COPY, then convert to real geometry in a
// single set-based statement. Per-row ST_GeomFromGeoJSON through INSERT takes
// minutes on 261,160 parcels.
//
// The COPY is server-side. The NDJSON lands on a volume mounted into both the
// ETL container and the database container, so PostgreSQL reads the file
// itself and no streaming client library is needed -- which keeps the
// dependency list of the image that also serves the safety-critical query
// path exactly where plan.md R1/R4 left it.
//
// Every derived table is refreshed only through truncateAndReload
// (Principle IV). There is no upsert, no incremental sync, and no
// reconciliation logic in this file or anywhere below it.

import type { PoolClient } from "pg";
import {
  BOARD_OF_EDUCATION_USECD,
  EXEMPT_USECD_PATTERN,
  MINERAL_RIGHTS_USECD_PATTERN,
  SCHOOLS_BOARD_PARCELS,
  SCHOOLS_NAMED_EXEMPT_PARCELS,
  SCHOOLS_PRIVATE_NCES,
  SCHOOLS_PUBLIC_NCES,
  SCHOOL_OWNER_PATTERN,
  type DeclaredGap,
  type LayerSource,
} from "./sources.ts";

/** Source GeoJSON is fetched in WGS84; every measurement layer is stored in
 *  EPSG:6549, NAD83(2011) Ohio North (metres), per DECISION §2. */
const SRID = 6549;

const IDENT_RE = /^[a-z_][a-z0-9_]*$/;

function ident(name: string): string {
  if (!IDENT_RE.test(name)) throw new Error(`unsafe identifier: ${name}`);
  return `"${name}"`;
}

export interface LoadCounts {
  /** Lines staged from the NDJSON file. */
  readonly staged: number;
  /** Rows written to the derived table. */
  readonly loaded: number;
  /** Rows dropped because the source feature carried no usable geometry. */
  readonly droppedNoGeometry: number;
}

/**
 * COPY an NDJSON file into a single-column staging table.
 *
 * CSV format with control characters for the delimiter and quote makes each
 * line arrive as one uninterpreted text value: JSON escapes every control
 * character as \uXXXX, so 0x01 and 0x02 cannot occur in the payload, and the
 * text format's own backslash handling -- which would mangle every \" in the
 * GeoJSON -- is avoided entirely.
 */
export async function stageNdjson(
  client: PoolClient,
  stageTable: string,
  path: string,
): Promise<number> {
  await client.query(`DROP TABLE IF EXISTS ${ident(stageTable)}`);
  await client.query(`CREATE UNLOGGED TABLE ${ident(stageTable)} (line text)`);
  // COPY FROM takes a literal path, not a bind parameter; the path is a
  // pipeline-controlled constant built from a layer id, and is quoted here
  // rather than trusted.
  const literal = `'${path.replace(/'/g, "''")}'`;
  await client.query(
    `COPY ${ident(stageTable)} (line) FROM ${literal} WITH (FORMAT csv, DELIMITER E'\\x02', QUOTE E'\\x01')`,
  );
  const { rows } = await client.query<{ n: string }>(
    `SELECT count(*) AS n FROM ${ident(stageTable)}`,
  );
  return Number(rows[0].n);
}

export async function dropStage(client: PoolClient, stageTable: string): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS ${ident(stageTable)}`);
}

/** Insert the layer registry rows the rest of the load references. */
export async function insertLayers(
  client: PoolClient,
  layers: readonly {
    id: string;
    description: string;
    sourceUrl: string;
    jurisdiction: string;
    notes: string;
  }[],
): Promise<void> {
  for (const layer of layers) {
    await client.query(
      `INSERT INTO layers (id, description, source_url, jurisdiction, notes)
       VALUES ($1, $2, $3, $4, $5)`,
      [layer.id, layer.description, layer.sourceUrl, layer.jurisdiction, layer.notes],
    );
  }
}

/** Stamp a layer's fetch date and row count so freshness is queryable
 *  (Principle II: an instance must be able to say how old its data is). */
export async function stampLayer(
  client: PoolClient,
  layerId: string,
  fetchedAt: Date,
  rowCount: number,
): Promise<void> {
  await client.query(
    "UPDATE layers SET fetched_at = $2, row_count = $3 WHERE id = $1",
    [layerId, fetchedAt, rowCount],
  );
}

// ---------------------------------------------------------------------------
// Address points
// ---------------------------------------------------------------------------

export async function loadAddressPoints(
  client: PoolClient,
  layer: LayerSource,
  stageTable: string,
): Promise<LoadCounts> {
  const staged = await countStaged(client, stageTable);
  const { rowCount } = await client.query(
    `INSERT INTO address_points (
        addr_id, addr_num, pre_dir, pre_type, str_name, str_type, suf_dir,
        unit_type, unit_num, city, zip, full_address, geom, layer_id)
     SELECT p->>'ADDR_ID', p->>'ADDR_NUM', p->>'PRE_DIR', p->>'PRE_TYPE',
            p->>'STR_NAME', p->>'STR_TYPE', p->>'SUF_DIR', p->>'UNIT_TYPE',
            p->>'UNIT_NUM', p->>'CITY', p->>'ZIP', p->>'LSN',
            g, $1
       FROM (
         SELECT j->'properties' AS p,
                ST_Transform(
                  ST_SetSRID(ST_Force2D(ST_GeomFromGeoJSON(j->>'geometry')), 4326),
                  ${SRID}) AS g
           FROM (SELECT line::jsonb AS j FROM ${ident(stageTable)}) parsed
          WHERE j->'geometry' IS NOT NULL AND jsonb_typeof(j->'geometry') = 'object'
       ) shaped
      WHERE g IS NOT NULL AND NOT ST_IsEmpty(g)`,
    [layer.id],
  );
  const loaded = rowCount ?? 0;
  return { staged, loaded, droppedNoGeometry: staged - loaded };
}

// ---------------------------------------------------------------------------
// Parcels
// ---------------------------------------------------------------------------

export async function loadParcels(
  client: PoolClient,
  layer: LayerSource,
  stageTable: string,
): Promise<LoadCounts> {
  const staged = await countStaged(client, stageTable);
  const { rowCount } = await client.query(
    `INSERT INTO parcels (
        parcel_id, site_address, usecd, owner_name, is_mineral_rights, geom, layer_id)
     SELECT p->>'parcelid', p->>'siteaddress', p->>'usecd', p->>'ownernme1',
            -- DECISION §6: 200-series use codes are mineral rights, overlapping
            -- subsurface polygons that must never enter measurement geometry.
            -- Stored as a flag so the exclusion cannot drift between this load
            -- and the queries that read it.
            coalesce(p->>'usecd', '') ~ '${MINERAL_RIGHTS_USECD_PATTERN}',
            g, $1
       FROM (
         SELECT j->'properties' AS p,
                ST_Transform(
                  ST_SetSRID(
                    ST_Multi(ST_CollectionExtract(
                      -- ST_Force2D: source polygons carry a Z dimension nothing
                      -- here uses. Distance is measured on the ground, not
                      -- through the air.
                      ST_MakeValid(ST_Force2D(ST_GeomFromGeoJSON(j->>'geometry'))), 3)),
                    4326),
                  ${SRID}) AS g
           FROM (SELECT line::jsonb AS j FROM ${ident(stageTable)}) parsed
          WHERE j->'geometry' IS NOT NULL AND jsonb_typeof(j->'geometry') = 'object'
       ) shaped
      WHERE g IS NOT NULL AND NOT ST_IsEmpty(g)`,
    [layer.id],
  );
  const loaded = rowCount ?? 0;
  await client.query("ANALYZE parcels");
  return { staged, loaded, droppedNoGeometry: staged - loaded };
}

// ---------------------------------------------------------------------------
// Municipalities, and the parcel municipality derivation DECISION §6 requires
// ---------------------------------------------------------------------------

export async function loadMunicipalities(
  client: PoolClient,
  layer: LayerSource,
  stageTable: string,
): Promise<LoadCounts> {
  const staged = await countStaged(client, stageTable);
  const { rowCount } = await client.query(
    `INSERT INTO municipalities (name, kind, fips_place_code, geom, layer_id)
     SELECT p->>'NAME', p->>'TYPE', p->>'FIPS_PLACE_CODE', g, $1
       FROM (
         SELECT j->'properties' AS p,
                ST_Transform(
                  ST_SetSRID(
                    ST_Multi(ST_CollectionExtract(
                      ST_MakeValid(ST_Force2D(ST_GeomFromGeoJSON(j->>'geometry'))), 3)),
                    4326),
                  ${SRID}) AS g
           FROM (SELECT line::jsonb AS j FROM ${ident(stageTable)}) parsed
          WHERE j->'geometry' IS NOT NULL AND jsonb_typeof(j->'geometry') = 'object'
       ) shaped
      WHERE g IS NOT NULL AND NOT ST_IsEmpty(g)`,
    [layer.id],
  );
  const loaded = rowCount ?? 0;
  await client.query("ANALYZE municipalities");
  return { staged, loaded, droppedNoGeometry: staged - loaded };
}

/**
 * Derive each parcel's municipality by spatial join (DECISION §6: parcel
 * siteaddress carries no city and is not unique county-wide).
 *
 * The join is on ST_PointOnSurface rather than the whole polygon, so a parcel
 * straddling a boundary resolves to exactly one municipality instead of
 * duplicating. Returns how many parcels got no municipality -- parcels in
 * unincorporated slivers or outside the published boundaries.
 */
export async function deriveParcelMunicipality(client: PoolClient): Promise<number> {
  await client.query(
    `UPDATE parcels p
        SET municipality = m.name, municipality_id = m.id
       FROM municipalities m
      WHERE ST_Contains(m.geom, ST_PointOnSurface(p.geom))`,
  );
  const { rows } = await client.query<{ n: string }>(
    "SELECT count(*) AS n FROM parcels WHERE municipality IS NULL",
  );
  return Number(rows[0].n);
}

// ---------------------------------------------------------------------------
// School premises
// ---------------------------------------------------------------------------

export interface SchoolLoadReport {
  readonly fromPoints: number;
  readonly fromBoardParcels: number;
  readonly fromNamedParcels: number;
  readonly matchedInParcel: number;
  readonly matchedNearParcel: number;
  readonly unmatched: number;
  readonly uncorroborated: number;
}

/**
 * Build school_premises from the staged point sources plus the county's own
 * board-of-education parcels.
 *
 * The matching rule, and why it is what it is:
 *
 *   - A point inside a parcel takes that parcel. Where several overlap
 *     (condominium and split records do), the LARGEST is taken -- the
 *     over-restricting choice, which Principle I classifies as recoverable.
 *   - A point within 5 m of exactly one parcel takes it, recorded as a
 *     distinct, weaker basis. 5 m is the coordinate-noise tolerance DECISION
 *     §3/§4 already validated between two independently digitised county
 *     layers. It is NOT an assumed premises radius: it does not enlarge the
 *     geometry by a metre, it only decides which surveyed parcel a point
 *     belongs to.
 *   - Anything else gets NO geometry and a coverage_gaps row. DECISION §3 is
 *     explicit that a school known only by a point is a coverage gap and
 *     never a distance to estimate: at a p95 campus extent of 1,575 m against
 *     a 304.8 m buffer, an honest radius flags most of a city and a
 *     convenient one under-restricts.
 */
export async function loadSchoolPremises(
  client: PoolClient,
  publicStage: string,
  privateStage: string,
): Promise<SchoolLoadReport> {
  await client.query("DROP TABLE IF EXISTS school_source_stage");
  await client.query(
    `CREATE UNLOGGED TABLE school_source_stage (
        layer_id text, source_ref text, name text, school_type text,
        street text, city text, zip text, pt geometry(Point, ${SRID}))`,
  );

  const pointSources = [
    { stage: publicStage, layer: SCHOOLS_PUBLIC_NCES, ref: "NCESSCH", type: "public" },
    { stage: privateStage, layer: SCHOOLS_PRIVATE_NCES, ref: "PPIN", type: "nonpublic" },
  ];
  for (const source of pointSources) {
    await client.query(
      `INSERT INTO school_source_stage
         (layer_id, source_ref, name, school_type, street, city, zip, pt)
       SELECT $1, p->>'${source.ref}', p->>'NAME', $2,
              p->>'STREET', p->>'CITY', p->>'ZIP',
              ST_Transform(
                ST_SetSRID(ST_Force2D(ST_GeomFromGeoJSON(j->>'geometry')), 4326),
                ${SRID})
         FROM (SELECT line::jsonb AS j FROM ${ident(source.stage)}) parsed
        CROSS JOIN LATERAL (SELECT j->'properties' AS p) props
        WHERE j->'geometry' IS NOT NULL AND jsonb_typeof(j->'geometry') = 'object'`,
      [source.layer.id, source.type],
    );
  }

  const { rows: srcCount } = await client.query<{ n: string }>(
    "SELECT count(*) AS n FROM school_source_stage",
  );

  const { rowCount: fromPoints } = await client.query(
    `INSERT INTO school_premises (
        name, school_type, parcel_id, geom, layer_id, source_ref,
        street, city, zip, match_basis, match_corroboration)
     SELECT s.name, s.school_type, m.parcel_id, m.geom, s.layer_id, s.source_ref,
            s.street, s.city, s.zip,
            coalesce(m.basis, 'none'),
            CASE WHEN m.parcel_id IS NULL THEN NULL
                 WHEN coalesce(m.usecd, '') ~ '${EXEMPT_USECD_PATTERN}'
                      THEN 'tax_exempt_parcel'
                 ELSE 'uncorroborated' END
       FROM school_source_stage s
       LEFT JOIN LATERAL (
            SELECT p.id AS parcel_id, p.geom, p.usecd,
                   CASE WHEN ST_Contains(p.geom, s.pt) THEN 'point_in_parcel'
                        ELSE 'point_near_parcel' END AS basis
              FROM parcels p
             WHERE NOT p.is_mineral_rights
               AND ST_DWithin(p.geom, s.pt, 5)
             -- Deterministic: containment first, then the larger parcel (the
             -- over-restricting choice), then the tax-exempt one, then the
             -- county's own identifier. Without the last two terms two equal
             -- overlapping parcels tie and the winner varies between reloads,
             -- which would make the same address produce different premises on
             -- different days -- unreproducible, and Principle VII does not
             -- accept a measurement nobody else can reconstruct.
             ORDER BY ST_Contains(p.geom, s.pt) DESC,
                      ST_Area(p.geom) DESC,
                      (coalesce(p.usecd, '') ~ '${EXEMPT_USECD_PATTERN}') DESC,
                      p.parcel_id NULLS LAST
             LIMIT 1
       ) m ON true`,
  );

  // The county's own enumeration: parcels the tax roll says a board of
  // education owns. Real surveyed geometry, no geocoding step, and the only
  // reach somap has into ORC 2925.01(S)(b). Skipped where a named school has
  // already claimed the parcel, so the same premises is not listed twice.
  const { rowCount: fromBoardParcels } = await client.query(
    `INSERT INTO school_premises (
        name, school_type, parcel_id, geom, layer_id, source_ref,
        street, city, match_basis, match_corroboration)
     SELECT coalesce(nullif(btrim(p.owner_name), ''), 'Board of education')
              || ' (' || coalesce(nullif(btrim(p.site_address), ''), 'no site address') || ')',
            'public', p.id, p.geom, $1, p.parcel_id || '#' || p.id::text,
            nullif(btrim(p.site_address), ''), p.municipality,
            'board_of_education_parcel', 'tax_exempt_parcel'
       FROM parcels p
      WHERE p.usecd = $2
        AND NOT p.is_mineral_rights
        AND NOT EXISTS (SELECT 1 FROM school_premises sp WHERE sp.parcel_id = p.id)`,
    [SCHOOLS_BOARD_PARCELS.id, BOARD_OF_EDUCATION_USECD],
  );

  // Exempt parcels whose owner of record reads like a school. The county's
  // own answer to "who owns this", independent of whether the school ever
  // answered a federal survey -- see SCHOOLS_NAMED_EXEMPT_PARCELS for the
  // confirmed miss that made this source necessary.
  const { rowCount: fromNamedParcels } = await client.query(
    `INSERT INTO school_premises (
        name, school_type, parcel_id, geom, layer_id, source_ref,
        street, city, match_basis, match_corroboration)
     SELECT btrim(p.owner_name)
              || ' (' || coalesce(nullif(btrim(p.site_address), ''), 'no site address') || ')',
            'unclassified', p.id, p.geom, $1, p.parcel_id || '#' || p.id::text,
            nullif(btrim(p.site_address), ''), p.municipality,
            'named_exempt_parcel', 'tax_exempt_parcel'
       FROM parcels p
      WHERE p.usecd ~ '${EXEMPT_USECD_PATTERN}'
        AND p.usecd <> $2
        AND NOT p.is_mineral_rights
        AND p.owner_name ~* '${SCHOOL_OWNER_PATTERN}'
        AND NOT EXISTS (SELECT 1 FROM school_premises sp WHERE sp.parcel_id = p.id)`,
    [SCHOOLS_NAMED_EXEMPT_PARCELS.id, BOARD_OF_EDUCATION_USECD],
  );

  await client.query("DROP TABLE IF EXISTS school_source_stage");
  await client.query("ANALYZE school_premises");

  const { rows } = await client.query<{
    in_parcel: string;
    near_parcel: string;
    unmatched: string;
    uncorroborated: string;
  }>(
    `SELECT count(*) FILTER (WHERE match_basis = 'point_in_parcel')     AS in_parcel,
            count(*) FILTER (WHERE match_basis = 'point_near_parcel')   AS near_parcel,
            count(*) FILTER (WHERE match_basis = 'none')                AS unmatched,
            count(*) FILTER (WHERE match_corroboration = 'uncorroborated') AS uncorroborated
       FROM school_premises`,
  );

  if (Number(srcCount[0].n) !== (fromPoints ?? 0)) {
    throw new Error(
      `school point sources staged ${srcCount[0].n} rows but ${fromPoints} premises ` +
        `rows were written. A school that vanishes between the source and the ` +
        `database is the under-restriction defect Principle I forbids.`,
    );
  }

  return {
    fromPoints: fromPoints ?? 0,
    fromBoardParcels: fromBoardParcels ?? 0,
    fromNamedParcels: fromNamedParcels ?? 0,
    matchedInParcel: Number(rows[0].in_parcel),
    matchedNearParcel: Number(rows[0].near_parcel),
    unmatched: Number(rows[0].unmatched),
    uncorroborated: Number(rows[0].uncorroborated),
  };
}

/**
 * One coverage_gaps row per school with no parcel geometry, and one per
 * school whose attached parcel does not corroborate being a school premises.
 *
 * Written as data in the shape the manifest renders, never as a comment or a
 * TODO: the ledger is the artifact Principle II is satisfied by.
 */
export async function collectSchoolGaps(client: PoolClient): Promise<DeclaredGap[]> {
  const { rows: missing } = await client.query<{
    layer_id: string;
    source_ref: string;
    name: string;
    street: string | null;
    city: string | null;
  }>(
    `SELECT layer_id, source_ref, name, street, city
       FROM school_premises WHERE geom IS NULL ORDER BY name`,
  );
  const { rows: weak } = await client.query<{
    layer_id: string;
    source_ref: string;
    name: string;
    match_basis: string;
  }>(
    `SELECT layer_id, source_ref, name, match_basis
       FROM school_premises
      WHERE match_corroboration = 'uncorroborated' ORDER BY name`,
  );

  const gaps: DeclaredGap[] = [];
  for (const row of missing) {
    gaps.push({
      layerId: row.layer_id,
      subjectType: "school_premises",
      subjectRef: `${row.layer_id}:${row.source_ref}`,
      description:
        `${row.name}${row.street ? ` (${row.street}${row.city ? `, ${row.city}` : ""})` : ""} ` +
        `could not be matched to a tax parcel, so somap holds no premises boundary ` +
        `for it and does not measure distance to it at all. It is NOT given an ` +
        `assumed radius: a school campus's extent can exceed the entire 1,000-foot ` +
        `buffer, so any assumed value would be either useless or dangerous. ` +
        `Distance to this school must be confirmed with the sheriff's office.`,
    });
  }
  for (const row of weak) {
    gaps.push({
      layerId: row.layer_id,
      subjectType: "school_premises_match",
      subjectRef: `${row.layer_id}:${row.source_ref}`,
      description:
        `${row.name} was matched to a tax parcel that is not tax-exempt, which a ` +
        `school premises almost always is. The match came from a mailing-address ` +
        `geocode (${row.match_basis}) and has not been verified by a human, so the ` +
        `boundary somap measures from may be a neighbouring property and may be ` +
        `smaller than the real premises.`,
    });
  }
  return gaps;
}

export async function writeGaps(
  client: PoolClient,
  gaps: readonly DeclaredGap[],
): Promise<number> {
  for (const gap of gaps) {
    await client.query(
      `INSERT INTO coverage_gaps (layer_id, subject_type, subject_ref, description)
       VALUES ($1, $2, $3, $4)`,
      [gap.layerId, gap.subjectType, gap.subjectRef, gap.description],
    );
  }
  return gaps.length;
}

async function countStaged(client: PoolClient, stageTable: string): Promise<number> {
  const { rows } = await client.query<{ n: string }>(
    `SELECT count(*) AS n FROM ${ident(stageTable)}`,
  );
  return Number(rows[0].n);
}
