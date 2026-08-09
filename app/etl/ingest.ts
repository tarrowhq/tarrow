// The ingest entrypoint: fetch every source, reload every derived table in
// full, record what is missing, and refuse to finish quietly if anything is
// unaccounted for.
//
//   docker compose run --rm etl                 fetch + load
//   docker compose run --rm etl --skip-fetch    load from the NDJSON already
//                                               on the volume
//
// Connects as the database OWNER. `tarrow_app` -- the role the query surface
// uses -- has every write privilege explicitly revoked (sql/schema/010_grants.sql),
// which is Principle IV's enforcement point and is why the ETL cannot share
// its credentials.

import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import pg from "pg";

import { fetchLayer } from "./fetch.ts";
import {
  assertEveryNullGeomIsDeclared,
  assertKeyUnique,
  assertNoAssumedSchoolRadius,
  assertNoRowsLost,
  type KeyAudit,
} from "./assert.ts";
import {
  collectSchoolGaps,
  deriveParcelMunicipality,
  dropStage,
  insertLayers,
  loadAddressPoints,
  loadMunicipalities,
  loadParcels,
  loadSchoolPremises,
  normalizeAddressPoints,
  stageNdjson,
  stampLayer,
  writeGaps,
} from "./load.ts";
import {
  ADDRESS_POINTS,
  DECLARED_GAPS,
  FETCHED_LAYERS,
  MUNICIPALITIES,
  PARCELS,
  SCHOOLS_BOARD_PARCELS,
  SCHOOLS_NAMED_EXEMPT_PARCELS,
  SCHOOLS_PRIVATE_NCES,
  SCHOOLS_PUBLIC_NCES,
  type DeclaredGap,
} from "./sources.ts";
import { truncateAndReload } from "./reload.ts";

const DATA_DIR = process.env.ETL_DATA_DIR ?? "/data";

function ndjsonPath(layerId: string): string {
  return path.join(DATA_DIR, `${layerId}.ndjson`);
}

function auditLine(audit: KeyAudit): string {
  return (
    `${audit.table}.${audit.column}: ${audit.total} rows, ${audit.distinct} distinct, ` +
    `${audit.duplicated} sharing a duplicated value, ${audit.empty} empty`
  );
}

async function main(): Promise<void> {
  const skipFetch = process.argv.includes("--skip-fetch");
  const startedAt = new Date();

  mkdirSync(DATA_DIR, { recursive: true });

  // ------------------------------------------------------------------ fetch
  const fetchedAt = new Map<string, Date>();
  if (skipFetch) {
    console.log("== fetch skipped (--skip-fetch); using NDJSON already on the volume");
    for (const layer of FETCHED_LAYERS) {
      const file = ndjsonPath(layer.id);
      if (!existsSync(file)) {
        throw new Error(
          `--skip-fetch was given but ${file} does not exist. Run without it.`,
        );
      }
      fetchedAt.set(layer.id, statSync(file).mtime);
    }
  } else {
    console.log("== fetch");
    for (const layer of FETCHED_LAYERS) {
      console.log(`- ${layer.id}`);
      await fetchLayer(layer.query, ndjsonPath(layer.id));
      fetchedAt.set(layer.id, new Date());
    }
  }

  const pool = new pg.Pool({
    host: process.env.PGHOST ?? "db",
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.POSTGRES_USER ?? "tarrow",
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB ?? "tarrow",
  });
  const client = await pool.connect();

  const gaps: DeclaredGap[] = [...DECLARED_GAPS];
  const audits: KeyAudit[] = [];
  const summary: string[] = [];

  try {
    // ------------------------------------------------------------- registry
    // TRUNCATE layers CASCADE clears every derived table in one statement:
    // the whole database below this point is a projection of the sources and
    // is rebuilt from them, never reconciled with them (Principle IV).
    console.log("== layers registry");
    await truncateAndReload(client, "layers", async (c) => {
      await insertLayers(c, [
        ...FETCHED_LAYERS,
        SCHOOLS_BOARD_PARCELS,
        SCHOOLS_NAMED_EXEMPT_PARCELS,
      ]);
    });

    // -------------------------------------------------------- municipalities
    console.log("== municipalities");
    await truncateAndReload(client, "municipalities", async (c) => {
      const stage = "stage_municipalities";
      await stageNdjson(c, stage, ndjsonPath(MUNICIPALITIES.id));
      const counts = await loadMunicipalities(c, MUNICIPALITIES, stage);
      assertNoRowsLost(
        MUNICIPALITIES.id,
        counts.staged,
        counts.loaded,
        counts.droppedNoGeometry,
      );
      // Identity is (name, kind): TWINSBURG is both a city and a township
      // (see sql/schema/008_municipality_identity.sql).
      audits.push(
        await assertKeyUnique(
          c,
          "municipalities",
          "(name || '|' || coalesce(kind, ''))",
          MUNICIPALITIES.declaredNonUniqueKeys,
        ),
      );
      await dropStage(c, stage);
      const { rows: shared } = await c.query<{ name: string }>(
        "SELECT name FROM municipalities GROUP BY name HAVING count(*) > 1 ORDER BY name",
      );
      if (shared.length > 0) {
        gaps.push({
          layerId: MUNICIPALITIES.id,
          subjectType: "jurisdiction",
          subjectRef: "shared_jurisdiction_names",
          label: "Two places share a name",
          description:
            `${shared.map((r) => r.name).join(", ")} name both a municipality and a ` +
            `township in Summit County. A result naming one of them does not by itself ` +
            `say which jurisdiction's rules apply. Municipal ` +
            `ordinances are not loaded here.`,
        });
      }
      summary.push(`municipalities: ${counts.loaded}`);
    });

    // --------------------------------------------------------------- parcels
    console.log("== parcels");
    await truncateAndReload(client, "parcels", async (c) => {
      const stage = "stage_parcels";
      await stageNdjson(c, stage, ndjsonPath(PARCELS.id));
      const counts = await loadParcels(c, PARCELS, stage);
      assertNoRowsLost(PARCELS.id, counts.staged, counts.loaded, counts.droppedNoGeometry);
      audits.push(
        await assertKeyUnique(c, "parcels", "parcel_id", PARCELS.declaredNonUniqueKeys),
      );
      await dropStage(c, stage);

      const unassigned = await deriveParcelMunicipality(c);
      const { rows: mineral } = await c.query<{ n: string }>(
        "SELECT count(*) AS n FROM parcels WHERE is_mineral_rights",
      );
      summary.push(
        `parcels: ${counts.loaded} (${counts.droppedNoGeometry} without usable geometry, ` +
          `${mineral[0].n} mineral-rights excluded from measurement, ` +
          `${unassigned} with no municipality)`,
      );
      if (counts.droppedNoGeometry > 0) {
        gaps.push({
          layerId: PARCELS.id,
          subjectType: "source_records",
          subjectRef: "parcels_without_geometry",
          label: "A few parcels have no map shape",
          description:
            `${counts.droppedNoGeometry} of ${counts.staged} county parcel records carry no ` +
            `usable polygon and are absent from measurement geometry. An address on ` +
            `one of them cannot be resolved and is declined rather than guessed.`,
        });
      }
      if (unassigned > 0) {
        gaps.push({
          layerId: MUNICIPALITIES.id,
          subjectType: "source_coverage",
          subjectRef: "parcels_outside_published_boundaries",
          label: "Parcels outside any city boundary",
          description:
            `${unassigned} parcels fall outside every published jurisdiction boundary, so ` +
            `tarrow cannot say which municipality they are in. Municipal ordinances are ` +
            `not applied at all here, and this would limit them if they were.`,
        });
      }
    });

    // -------------------------------------------------------- address points
    console.log("== address points");
    await truncateAndReload(client, "address_points", async (c) => {
      const stage = "stage_address_points";
      await stageNdjson(c, stage, ndjsonPath(ADDRESS_POINTS.id));
      const counts = await loadAddressPoints(c, ADDRESS_POINTS, stage);
      assertNoRowsLost(
        ADDRESS_POINTS.id,
        counts.staged,
        counts.loaded,
        counts.droppedNoGeometry,
      );
      // DECISION §7. ADDR_ID is audited, not keyed on: the assertion below
      // aborts for any column NOT named in that layer's declaredNonUniqueKeys.
      const audit = await assertKeyUnique(
        c,
        "address_points",
        "addr_id",
        ADDRESS_POINTS.declaredNonUniqueKeys,
      );
      audits.push(audit);
      await dropStage(c, stage);

      // The matching index itself. Inside this reload rather than beside it:
      // a normalized column refreshed separately from the rows it describes
      // would be the reconciliation path Principle IV forbids.
      const norm = await normalizeAddressPoints(c);
      summary.push(
        `address_points: ${counts.loaded} (${counts.droppedNoGeometry} without geometry, ` +
          `${norm.normalized} normalized for matching, ${norm.unnormalizable} unnormalizable)`,
      );
      if (norm.unnormalizable > 0) {
        gaps.push({
          layerId: ADDRESS_POINTS.id,
          subjectType: "source_records",
          subjectRef: "address_points_without_normalized_form",
          label: "A few unreadable addresses",
          description:
            `${norm.unnormalizable} published address points carry no usable address ` +
            `label, so no typed address can ever match them. A search for one of those ` +
            `addresses returns could-not-locate rather than a nearby guess.`,
        });
      }
      gaps.push({
        layerId: ADDRESS_POINTS.id,
        subjectType: "source_records",
        subjectRef: "addr_id_not_unique",
        label: "Duplicate county address ids",
        description:
          `The county address layer's ADDR_ID is not a key: ${audit.duplicated} of ` +
          `${audit.total} points share a duplicated value and ${audit.empty} carry none. ` +
          `Every row is kept -- tarrow keys on none of them -- but a downstream consumer ` +
          `treating ADDR_ID as an identifier would silently merge distinct addresses.`,
      });
      if (counts.droppedNoGeometry > 0) {
        gaps.push({
          layerId: ADDRESS_POINTS.id,
          subjectType: "source_records",
          subjectRef: "address_points_without_geometry",
          label: "Some addresses have no map point",
          description:
            `${counts.droppedNoGeometry} published address points carry no coordinate and ` +
            `cannot be resolved. Those addresses are declined, never approximated.`,
        });
      }
    });

    // -------------------------------------------------------------- schools
    console.log("== school premises");
    await truncateAndReload(client, "school_premises", async (c) => {
      const publicStage = "stage_schools_public";
      const privateStage = "stage_schools_private";
      await stageNdjson(c, publicStage, ndjsonPath(SCHOOLS_PUBLIC_NCES.id));
      await stageNdjson(c, privateStage, ndjsonPath(SCHOOLS_PRIVATE_NCES.id));
      const report = await loadSchoolPremises(c, publicStage, privateStage);
      audits.push(await assertKeyUnique(c, "school_premises", "source_ref"));
      await dropStage(c, publicStage);
      await dropStage(c, privateStage);
      gaps.push(...(await collectSchoolGaps(c)));
      summary.push(
        `school_premises: ${report.fromPoints + report.fromBoardParcels + report.fromNamedParcels} ` +
          `(${report.fromPoints} from point sources, ${report.fromBoardParcels} from ` +
          `board-of-education parcels, ${report.fromNamedParcels} from school-named exempt ` +
          `parcels; ${report.matchedInParcel} point-in-parcel, ` +
          `${report.matchedNearParcel} point-near-parcel, ${report.unmatched} with NO ` +
          `geometry, ${report.uncorroborated} matched to a non-exempt parcel)`,
      );
    });

    // ----------------------------------------------------------------- gaps
    console.log("== coverage gaps");
    await truncateAndReload(client, "coverage_gaps", async (c) => {
      const written = await writeGaps(c, gaps);
      summary.push(`coverage_gaps: ${written}`);
    });

    // ------------------------------------------------------- layer freshness
    for (const layer of FETCHED_LAYERS) {
      const { rows } = await client.query<{ n: string }>(
        layer.id === SCHOOLS_PUBLIC_NCES.id || layer.id === SCHOOLS_PRIVATE_NCES.id
          ? "SELECT count(*) AS n FROM school_premises WHERE layer_id = $1"
          : layer.id === PARCELS.id
            ? "SELECT count(*) AS n FROM parcels WHERE layer_id = $1"
            : layer.id === ADDRESS_POINTS.id
              ? "SELECT count(*) AS n FROM address_points WHERE layer_id = $1"
              : "SELECT count(*) AS n FROM municipalities WHERE layer_id = $1",
        [layer.id],
      );
      await stampLayer(
        client,
        layer.id,
        fetchedAt.get(layer.id) ?? startedAt,
        Number(rows[0].n),
      );
    }
    // Both parcel-derived school layers are as fresh as the parcel fetch they
    // are filtered out of.
    for (const derived of [SCHOOLS_BOARD_PARCELS, SCHOOLS_NAMED_EXEMPT_PARCELS]) {
      const { rows: derivedRows } = await client.query<{ n: string }>(
        "SELECT count(*) AS n FROM school_premises WHERE layer_id = $1",
        [derived.id],
      );
      await stampLayer(
        client,
        derived.id,
        fetchedAt.get(PARCELS.id) ?? startedAt,
        Number(derivedRows[0].n),
      );
    }

    // ---------------------------------------------------- closing assertions
    console.log("== assertions");
    await assertNoAssumedSchoolRadius(client);
    const nullGeom = await assertEveryNullGeomIsDeclared(client);
    console.log(
      `  every one of the ${nullGeom} school premises without geometry has a ` +
        `coverage_gaps row explaining it`,
    );

    console.log("\n== row counts");
    for (const line of summary) console.log(`  ${line}`);
    console.log("\n== key audits");
    for (const audit of audits) console.log(`  ${auditLine(audit)}`);
    console.log("\ningest complete");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
