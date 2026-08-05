// There must be NO code path that returns a coarse fallback.
//
// DECISION §4: "An address that cannot be confidently resolved returns an
// explicit could-not-locate. Never a low-confidence coordinate, never a ZIP or
// street centroid, never a nearby-parcel consolation. This is structural, not a
// policy: the only thing the pipeline can return is a matched address point or
// nothing. There is no coarse-fallback code path to accidentally take."
//
// "Structural" is a claim about the source, so this test reads the source. It
// strips comments first -- the files talk about centroids and fuzzy matching at
// length in order to explain why they do not do them, and a grep that cannot
// tell an explanation from an implementation would be satisfied by deleting the
// explanations.
//
// Scope is the query path only: sql/query/*.sql and server/*.ts. The ETL is a
// different pipeline with different rules (it legitimately uses
// ST_PointOnSurface to assign a parcel to a municipality, which is not a
// measurement).

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

const APP_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const QUERY_DIR = path.join(APP_ROOT, "sql", "query");
const SCHEMA_DIR = path.join(APP_ROOT, "sql", "schema");
const SERVER_DIR = path.join(APP_ROOT, "server");

function stripSqlComments(source: string): string {
  return source.replace(/--[^\n]*/g, "");
}

function stripTsComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function read(dir: string, ext: string): { name: string; code: string }[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(ext))
    .map((f) => {
      const raw = readFileSync(path.join(dir, f), "utf8");
      return {
        name: path.join(path.basename(dir), f),
        code: ext === ".sql" ? stripSqlComments(raw) : stripTsComments(raw),
      };
    });
}

const QUERY_FILES = read(QUERY_DIR, ".sql");
const SERVER_FILES = read(SERVER_DIR, ".ts");

describe("no coarse fallback exists in the query path", () => {
  const FORBIDDEN: readonly [RegExp, string][] = [
    [/\bsimilarity\s*\(/i, "trigram similarity is fuzzy matching"],
    [/\blevenshtein\s*\(/i, "edit distance is fuzzy matching"],
    [/\bsoundex\s*\(/i, "phonetic matching is fuzzy matching"],
    [/\bmetaphone\s*\(/i, "phonetic matching is fuzzy matching"],
    [/\bdifference\s*\(/i, "soundex difference is fuzzy matching"],
    [/%\s*>|<->/, "trigram/KNN operators are fuzzy or unbounded-nearest matching"],
    [/\bILIKE\b/i, "pattern matching against a typed address is fuzzy matching"],
    [/ST_Centroid/i, "a centroid is the coarse coordinate DECISION §4 forbids"],
    [/ST_PointOnSurface/i, "a representative point is not a measurement geometry"],
    [/ST_Buffer/i, "buffering a point is an assumed radius"],
    [/ST_ClosestPoint/i, "reducing a parcel to a point is not boundary-to-boundary"],
    [/geography/i, "a geography cast defeats the spatial index (DECISION §2)"],
  ];

  for (const file of [...QUERY_FILES, ...SERVER_FILES]) {
    test(`${file.name} contains no fallback or fuzzy-matching construct`, () => {
      for (const [pattern, why] of FORBIDDEN) {
        assert.doesNotMatch(file.code, pattern, `${file.name}: ${why}`);
      }
    });
  }

  test("a typed address is never matched against parcels.site_address", () => {
    const resolve = QUERY_FILES.find((f) => f.name.endsWith("resolve_address.sql"));
    assert.ok(resolve);
    // site_address may be SELECTed (it is shown to the user); it may never
    // appear in a predicate. DECISION §1 measured that path at 3.34% wrong
    // against 0.20%.
    assert.doesNotMatch(resolve.code, /site_address\s*(=|~|LIKE)/i);
  });

  test("the parcel search is bounded by 5 m and has no unbounded nearest", () => {
    const resolve = QUERY_FILES.find((f) => f.name.endsWith("resolve_address.sql"));
    assert.ok(resolve);
    assert.match(
      resolve.code,
      /ST_DWithin\(\s*p\.geom,\s*pt\.geom,\s*5\s*\)/,
      "the residence parcel lookup must carry its 5 m bound",
    );
    // Every LIMIT in the file must sit inside that bounded lateral. There is
    // exactly one, and losing the bound while keeping the LIMIT would turn it
    // into the nearest-parcel consolation DECISION §4 rejects.
    const limits = resolve.code.match(/\bLIMIT\b/gi) ?? [];
    assert.equal(limits.length, 1, "exactly one LIMIT, inside the bounded search");
  });
});

describe("the buffer and the radii are each written down exactly once", () => {
  const ALL_CODE = [
    ...read(SCHEMA_DIR, ".sql"),
    ...QUERY_FILES,
    ...SERVER_FILES,
  ];

  test("304.8 appears only in the single function that defines it", () => {
    const carriers = ALL_CODE.filter((f) => /\b304\.8\b/.test(f.code)).map((f) => f.name);
    assert.deepEqual(
      carriers,
      [path.join("schema", "013_measurement_uncertainty.sql")],
      "the buffer must have one definition; a second copy is a value that can " +
        "disagree with itself between the measurement and its disclosure",
    );
  });

  test("the uncertainty radii appear only in the single function that defines them", () => {
    const carriers = ALL_CODE.filter((f) => /\b126\.0\b|\b126\b/.test(f.code)).map(
      (f) => f.name,
    );
    assert.deepEqual(carriers, [path.join("schema", "013_measurement_uncertainty.sql")]);
  });

  test("proximity subtracts both radii and adds neither", () => {
    const proximity = QUERY_FILES.find((f) => f.name.endsWith("proximity.sql"));
    assert.ok(proximity);

    const subtractions = proximity.code.match(/d\.d_m\s*-\s*res\.r_a\s*-\s*u\.r_b/g) ?? [];
    assert.ok(
      subtractions.length >= 2,
      "d_min = d - r_a - r_b must appear both as the reported value and as the " +
        "predicate the flag is decided by",
    );
    assert.doesNotMatch(
      proximity.code,
      /d_m\s*\+\s*(res\.r_a|u\.r_b)|\+\s*res\.r_a\s*\+\s*u\.r_b/,
      "adding a radius to the measured distance shrinks the flagged set and " +
        "under-restricts -- the unrecoverable defect",
    );
    // The comparison is against the buffer function, never a literal.
    assert.match(proximity.code, /tarrow_unverified_state_buffer_m\(\)/);
  });
});
