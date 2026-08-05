// The coverage manifest is on EVERY result, and it is built from data.
//
// Constitution Principle II: absence of a flag is meaningful only against a
// stated list of what was searched. That makes the manifest part of the answer
// rather than metadata about it -- so these tests treat a manifest-less or
// thin manifest as a safety defect, not a formatting one.
//
// The five result shapes are all exercised, including the two that only occur
// when something is broken. Those are reached with a stubbed connection rather
// than by breaking the real database: a decline or a failure is exactly when a
// user most needs to be told what was not checked, and it is exactly the path
// least likely to be exercised by hand.

import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import type { PoolClient } from "pg";

import { pool } from "../server/db.ts";
import { MissingRuleDisclosureError, readManifest } from "../server/manifest.ts";
import type { CoverageManifest, SearchResult } from "../server/result.ts";
import { search } from "../server/search.ts";
import {
  BUFFER_METERS,
  FAR_FROM_EVERY_SCHOOL,
  NEAR_A_SCHOOL,
  NO_SUCH_ADDRESS,
  RESOLVES_BUT_HAS_NO_PARCEL,
} from "./fixtures.ts";

after(async () => {
  await pool.end();
});

// ---------------------------------------------------------------------------
// A stub connection, so the failure variants are reachable
// ---------------------------------------------------------------------------

const RULE_GAP = {
  id: 1,
  layer_id: null,
  subject_type: "rule_content",
  subject_ref: "orc_2950_034_buffer_unverified",
  description: "The buffer this release applies is NOT verified rule data.",
  discovered_at: "2026-08-04T00:00:00.000Z",
};

function manifestRow(overrides: Record<string, unknown> = {}) {
  return {
    layers: [
      {
        id: "stub_layer",
        description: "stub",
        source_url: "https://example.invalid",
        jurisdiction: "Summit County, OH",
        fetched_at: "2026-08-04T00:00:00.000Z",
        verified_at: null,
        row_count: 1,
        notes: null,
        queried: true,
      },
    ],
    gaps: [RULE_GAP],
    measurement_bases: [
      {
        match_basis: "board_of_education_parcel",
        match_corroboration: "tax_exempt_parcel",
        premises: 1,
        uncertainty_m: 0,
      },
    ],
    premises: { total: 1, measurable: 1, not_measurable: 0 },
    address_point_count: "1",
    measurable_parcel_count: "1",
    data_fetched_at: new Date("2026-08-04T00:00:00.000Z"),
    oldest_layer_fetched_at: new Date("2026-08-04T00:00:00.000Z"),
    buffer_m: BUFFER_METERS,
    ...overrides,
  };
}

function isManifestQuery(sql: string): boolean {
  return sql.includes("layer_rows");
}

/** A client that answers the manifest query and fails everything after it. */
function stubClient(options: {
  manifest?: Record<string, unknown> | "throw";
  afterManifest?: "throw";
}): PoolClient {
  return {
    query(sql: string) {
      if (isManifestQuery(sql)) {
        if (options.manifest === "throw") throw new Error("stub failure");
        return Promise.resolve({ rows: [manifestRow(options.manifest ?? {})] });
      }
      if (options.afterManifest === "throw") throw new Error("stub failure");
      return Promise.resolve({ rows: [] });
    },
    release() {},
  } as unknown as PoolClient;
}

// ---------------------------------------------------------------------------
// What "complete" means
// ---------------------------------------------------------------------------

function assertManifestIsComplete(manifest: CoverageManifest, where: string): void {
  assert.equal(manifest.deliveryPath, "server-query-endpoint", `${where}: delivery path`);

  // The rule-content disclosure is on every manifest in both availabilities,
  // and it can only ever say `verified: false` -- the type has no other
  // inhabitant, and this asserts the value matches the type.
  assert.equal(manifest.ruleContent.verified, false, `${where}: rule content`);
  assert.ok(manifest.ruleContent.statement.length > 40, `${where}: rule statement`);
  assert.match(
    manifest.ruleContent.statement,
    /not verified|could not read/i,
    `${where}: the rule disclosure must say the rule is not verified data`,
  );

  if (manifest.availability === "could-not-be-read") {
    assert.ok(manifest.statement.length > 20, `${where}: withdrawal statement`);
    return;
  }

  assert.ok(manifest.layers.length > 0, `${where}: layers`);
  for (const layer of manifest.layers) {
    assert.ok(layer.id.length > 0, `${where}: layer id`);
    assert.ok(layer.description.length > 0, `${where}: layer description`);
    assert.ok(layer.sourceUrl.length > 0, `${where}: layer source url`);
    assert.ok(layer.jurisdiction.length > 0, `${where}: layer jurisdiction`);
    assert.ok(layer.fetchedAt !== null, `${where}: layer freshness`);
  }

  assert.ok(manifest.gaps.length > 0, `${where}: gaps`);
  for (const gap of manifest.gaps) {
    assert.ok(gap.subjectType.length > 0, `${where}: gap subject type`);
    assert.ok(gap.description.length > 0, `${where}: gap description`);
  }

  assert.ok(manifest.measurementBases.length > 0, `${where}: measurement bases`);
  assert.ok(manifest.premises.total > 0, `${where}: premises count`);
  assert.equal(
    manifest.premises.total,
    manifest.premises.measurable + manifest.premises.notMeasurable,
    `${where}: every premises is either measurable or declared not measurable`,
  );
  assert.equal(manifest.bufferMeters, BUFFER_METERS, `${where}: buffer`);
  assert.ok(manifest.dataFetchedAt !== null, `${where}: data build date`);
  assert.ok(manifest.addressPointCount > 0, `${where}: address point count`);
  assert.ok(manifest.measurableParcelCount > 0, `${where}: parcel count`);
}

// ---------------------------------------------------------------------------

describe("the manifest is complete on every result variant", () => {
  const seen = new Set<SearchResult["kind"]>();

  async function checkVariant(
    label: string,
    run: () => Promise<SearchResult>,
    expected: SearchResult["kind"],
  ): Promise<void> {
    const result = await run();
    assert.equal(result.kind, expected, `${label}: expected ${expected}`);
    assertManifestIsComplete(result.manifest, label);
    seen.add(result.kind);
  }

  test("premises-within-buffer", async () => {
    await checkVariant(
      "flagged",
      () => search(NEAR_A_SCHOOL.typed),
      "premises-within-buffer",
    );
  });

  test("outside-every-buffer-we-checked", async () => {
    await checkVariant(
      "unflagged",
      () => search(FAR_FROM_EVERY_SCHOOL.typed),
      "outside-every-buffer-we-checked",
    );
  });

  test("declined (no parcel)", async () => {
    await checkVariant(
      "declined",
      () => search(RESOLVES_BUT_HAS_NO_PARCEL.typed),
      "declined",
    );
  });

  test("could-not-locate", async () => {
    await checkVariant(
      "could-not-locate",
      () => search(NO_SUCH_ADDRESS.typed),
      "could-not-locate",
    );
  });

  test("declined (data not loaded)", async () => {
    const result = await search("anything", async () =>
      stubClient({
        manifest: {
          address_point_count: "0",
          premises: { total: 0, measurable: 0, not_measurable: 0 },
        },
      }),
    );
    assert.equal(result.kind, "declined");
    if (result.kind !== "declined") return;
    assert.equal(result.reason, "data-not-loaded");
    // An unloaded instance still says what it would have checked, and still
    // discloses that its rule is unverified.
    assert.equal(result.manifest.availability, "read-from-data");
    assert.equal(result.manifest.ruleContent.verified, false);
    seen.add(result.kind);
  });

  test("search-failed (database unreachable)", async () => {
    await checkVariant(
      "unreachable",
      () => search("anything", () => Promise.reject(new Error("no connection"))),
      "search-failed",
    );
  });

  test("search-failed (query failed after the manifest was read)", async () => {
    await checkVariant(
      "query-failed",
      () => search("anything", async () => stubClient({ afterManifest: "throw" })),
      "search-failed",
    );
  });

  test("every variant of the union was covered", () => {
    const kinds: SearchResult["kind"][] = [
      "premises-within-buffer",
      "outside-every-buffer-we-checked",
      "declined",
      "could-not-locate",
      "search-failed",
    ];
    // Guards against a variant being added later and quietly skipping the
    // completeness check above.
    for (const kind of kinds) {
      assert.ok(seen.has(kind), `no test produced a ${kind} result`);
    }
  });
});

describe("the manifest is built from data, not from a list in the code", () => {
  test("it names the absent facility classes and jurisdictions the ledger records", async () => {
    const client = await pool.connect();
    try {
      const manifest = await readManifest(client);

      const subjects = new Set(manifest.gaps.map((g) => g.subjectType));
      for (const required of ["facility_class", "jurisdiction", "rule_content"]) {
        assert.ok(subjects.has(required), `the ledger must carry a ${required} gap`);
      }

      // The specific disclosures this release depends on for its honesty. Each
      // is a row somebody wrote at ingest, read here rather than restated.
      const text = manifest.gaps.map((g) => g.description).join("\n").toLowerCase();
      assert.match(text, /preschool/);
      assert.match(text, /child day-care|child care|day-care/);
      assert.match(text, /municipal/);
      assert.match(text, /summit county/);

      // Layer identities come from the registry, never from this test.
      const ids = manifest.layers.map((l) => l.id);
      assert.ok(ids.length >= 5, "every registered layer appears in the manifest");
      assert.ok(
        manifest.layers.every((l) => l.verifiedAt === null),
        "no layer in this release has been human-verified, and the manifest must " +
          "report that rather than substitute a fetch date",
      );
    } finally {
      client.release();
    }
  });

  test("a ledger with no rule-content row produces no manifest at all", async () => {
    const client = stubClient({ manifest: { gaps: [] } });
    await assert.rejects(
      () => readManifest(client),
      MissingRuleDisclosureError,
      "removing the rule-content disclosure must fail loudly, not silently drop a paragraph",
    );

    // ...and the search built on it refuses to answer.
    const result = await search("anything", async () => client);
    assert.equal(result.kind, "search-failed");
    if (result.kind !== "search-failed") return;
    assertManifestIsComplete(result.manifest, "missing-disclosure");
  });
});
