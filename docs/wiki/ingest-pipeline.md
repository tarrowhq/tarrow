---
name: ingest-pipeline
description: The ETL job — fetch each source to NDJSON, stage with a server-side COPY, rebuild every derived table by truncate-and-reload, assert, and stamp layer freshness.
kind: pipeline
sources:
  - app/etl/ingest.ts
  - app/etl/load.ts
  - app/etl/fetch.ts
  - app/etl/reload.ts
verified_against: b5b247a6cb390ba505c674f0c77af551dd547949
---

# Ingest pipeline

`app/etl/ingest.ts` is a job, not a service: it sits behind the `etl` compose profile so
`docker compose up` never starts fetching a quarter of a million parcels. It connects as the
database **owner**, because the query path's role has every write privilege revoked — that
revocation is Principle IV's enforcement point and the reason the ETL needs its own
credentials.

## How it works

`docker compose run --rm etl` fetches every source; `--skip-fetch` loads from NDJSON already
on the shared volume, aborting if a file is absent rather than loading a partial set.

Loading is staged. `stageNdjson` bulk-COPYs raw lines into an unlogged single-column table,
then a single set-based statement converts them to geometry — per-row `ST_GeomFromGeoJSON`
through INSERT takes minutes on 261,160 parcels. The COPY is **server-side**: the NDJSON
lands on a volume mounted into both containers so PostgreSQL reads the file itself, which
keeps a streaming client library out of the image that also serves the query path. The CSV
delimiter and quote are control characters (`\x02`, `\x01`) so each line arrives as one
uninterpreted value — JSON escapes every control character, so neither can occur in the
payload, and the text format's backslash handling that would mangle GeoJSON is avoided.

Every derived table is refreshed only through `truncateAndReload`. There is no upsert, no
incremental sync, and no reconciliation logic anywhere. `TRUNCATE layers CASCADE` clears
every derived table in one statement: the database below that point is a projection of the
sources, rebuilt from them rather than reconciled with them.

The order is layers registry → municipalities → parcels → address points → school premises →
coverage gaps. Each load asserts (see [[ingest-assertions]]), audits its key, drops its
staging table, and appends discovered gaps: parcels without geometry, parcels outside every
published jurisdiction boundary, address points with no normalized form, the county address
layer's non-unique `ADDR_ID`. Address normalization runs *inside* the address-points reload,
not beside it — a normalized column refreshed separately from the rows it describes would be
the reconciliation path Principle IV forbids.

Afterwards every fetched layer is stamped with its fetch time and row count; the two
parcel-derived school layers are stamped with the parcel fetch's freshness, since that is what
they are filtered out of. Two closing assertions run: no assumed school radius, and every
null-geometry premises has a gap row explaining it. The job prints row counts and key audits,
then `ingest complete`.

## Connections

- [[data-sources]] enumerates what is fetched and what each source misses.
- [[ingest-assertions]] are the checks that abort a load.
- [[coverage-gap-ledger]] is what the gaps collected here become.
- [[database-schema]] defines the tables; [[coverage-manifest]] reads the stamps.
- [[container-composition]] holds the profile, volume, and credentials.

## Operational notes

`ETL_DATA_DIR` defaults to `/data`. Credentials come from `POSTGRES_USER` / `POSTGRES_PASSWORD`
/ `POSTGRES_DB`. Source geometry is fetched in WGS84 and stored in EPSG:6549 (`SRID` in
`etl/load.ts`). The ETL process is deliberately **not** output-sealed — it must report row
counts and assertion failures, and is never given an address somebody typed. A failure prints
the error and exits 1.
