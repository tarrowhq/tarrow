// The ArcGIS paging fetcher, ported from spikes/task-0001-geocoding/fetch_summit.py.
//
// Two behaviours are carried over deliberately, because both were learned
// against real servers rather than read from documentation:
//
//   1. RETRY WITH BACKOFF. County and federal ArcGIS servers rate-limit and
//      occasionally 500. Anything transient is retried.
//
//   2. ARCGIS SIGNALS FAILURE INSIDE A 200 BODY. `{"error": {...}}` arrives
//      with HTTP 200 and, on the `geojson` output format, without a
//      `features` key. Treating a 200 as success is how a partial ingest
//      becomes a silent coverage gap -- exactly the failure Constitution
//      Principle II exists to forbid. Every response body is checked for an
//      `error` member and raised as one.
//
// The fetcher writes newline-delimited GeoJSON to a file rather than
// streaming into the database, for the same reason the spike did: the load
// is a separate, re-runnable step, so a load bug does not cost another
// half-hour of paging against someone else's server.

import { createWriteStream } from "node:fs";
import { once } from "node:events";

export interface LayerQuery {
  /** Service layer URL, e.g. https://host/rest/services/X/FeatureServer/0 */
  readonly url: string;
  /** ArcGIS WHERE clause. `1=1` for a whole layer. */
  readonly where: string;
  /** Comma-separated source field names. */
  readonly outFields: string;
  /** Field to order by, so paging is stable across requests. */
  readonly orderByFields: string;
  /** Page size; must not exceed the layer's maxRecordCount. */
  readonly pageSize: number;
}

const USER_AGENT = "tarrow-etl/0.1 (+https://github.com/tarrowhq/tarrow)";
const REQUEST_TIMEOUT_MS = 180_000;
const ATTEMPTS = 5;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function requestJson(
  url: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams(params).toString();
  let lastError: unknown;

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    try {
      const response = await fetch(`${url}?${qs}`, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      const payload: unknown = await response.json();
      if (!isRecord(payload)) {
        throw new Error("response body was not a JSON object");
      }
      // The quirk. A 200 whose body carries `error` is a failure.
      if ("error" in payload) {
        throw new Error(`ArcGIS error in 200 body: ${JSON.stringify(payload.error)}`);
      }
      return payload;
    } catch (err) {
      lastError = err;
      if (attempt === ATTEMPTS - 1) break;
      const backoff = 2 ** attempt;
      console.error(
        `    retry ${attempt + 1}/${ATTEMPTS - 1} in ${backoff}s: ${(err as Error).message}`,
      );
      await new Promise((resolve) => setTimeout(resolve, backoff * 1000));
    }
  }
  throw new Error(
    `giving up on ${url} after ${ATTEMPTS} attempts: ${(lastError as Error)?.message}`,
    { cause: lastError },
  );
}

/** The server's own count for the query, used as the completeness check. */
export async function countFeatures(query: LayerQuery): Promise<number> {
  const payload = await requestJson(`${query.url}/query`, {
    where: query.where,
    returnCountOnly: "true",
    f: "json",
  });
  const count = payload.count;
  if (typeof count !== "number") {
    throw new Error(`layer ${query.url} did not report a feature count`);
  }
  return count;
}

export interface FetchResult {
  /** Features the server said the query matches. */
  readonly reported: number;
  /** Features actually written to `outPath`. */
  readonly written: number;
}

/**
 * Page `query` into `outPath` as newline-delimited GeoJSON features.
 *
 * Throws if fewer features are written than the server reported. A short
 * fetch that is merely warned about becomes an undetectable coverage gap:
 * the pipeline would run green with schools missing, which is the
 * under-restriction failure Principle I calls unrecoverable. The spike could
 * afford a warning because a human was reading its output; a build step
 * cannot.
 */
export async function fetchLayer(
  query: LayerQuery,
  outPath: string,
): Promise<FetchResult> {
  const reported = await countFeatures(query);
  console.log(`  ${query.url}`);
  console.log(`    ${reported} features reported -> ${outPath}`);

  const out = createWriteStream(outPath, { encoding: "utf8" });
  let written = 0;
  let offset = 0;

  try {
    for (;;) {
      const payload = await requestJson(`${query.url}/query`, {
        where: query.where,
        outFields: query.outFields,
        returnGeometry: "true",
        outSR: "4326",
        orderByFields: query.orderByFields,
        resultOffset: String(offset),
        resultRecordCount: String(query.pageSize),
        f: "geojson",
      });

      const features = Array.isArray(payload.features) ? payload.features : [];
      if (features.length === 0) break;

      for (const feature of features) {
        if (!out.write(`${JSON.stringify(feature)}\n`)) {
          await once(out, "drain");
        }
      }
      written += features.length;
      offset += features.length;
      console.log(
        `    ${written}/${reported} (${reported ? ((100 * written) / reported).toFixed(1) : "0.0"}%)`,
      );
      if (features.length < query.pageSize) break;
    }
  } finally {
    out.end();
    await once(out, "close");
  }

  if (written < reported) {
    throw new Error(
      `short fetch for ${query.url}: wrote ${written} of ${reported} reported features. ` +
        `A partial layer is a silent coverage gap; refusing to continue.`,
    );
  }
  console.log(`    done, ${written} features`);
  return { reported, written };
}
