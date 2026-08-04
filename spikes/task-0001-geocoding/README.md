# TASK-0001 spike — geocoding and distance stack

**Decision: [DECISION.md](DECISION.md)** — the authoritative outcome of this spike.
**Evidence: [RESULTS.md](RESULTS.md)** — the measurement it rests on.

This is a measurement harness, not production code. Nothing here is an architectural
commitment about the language or shape of the real ingest pipeline.

## Reproducing

Requires a container runtime and nothing else (Constitution VII).

```bash
docker compose up -d --build

# Fetch source data (~200MB, ~5 min). Public, freely redistributable.
docker compose exec tools python /work/spikes/task-0001-geocoding/fetch_summit.py \
    parcels    /work/spikes/task-0001-geocoding/data/parcels.ndjson
docker compose exec tools python /work/spikes/task-0001-geocoding/fetch_summit.py \
    addrpoints /work/spikes/task-0001-geocoding/data/addrpoints.ndjson

# Load, normalize, measure
docker compose exec tools python /work/spikes/task-0001-geocoding/load.py
docker compose exec -T db psql -U somap -d somap -f - < spikes/task-0001-geocoding/sql/02_normalize.sql
docker compose exec -T db psql -U somap -d somap -f - < spikes/task-0001-geocoding/sql/07_measure_final.sql

docker compose exec -T db psql -U somap -d somap -c "
SELECT approach,
  round(100.0*sum(n) FILTER (WHERE outcome='UNIQUE_CORRECT')/sum(n),2) AS correct,
  round(100.0*sum(n) FILTER (WHERE outcome='UNIQUE_WRONG')/sum(n),2)   AS wrong,
  round(100.0*sum(n) FILTER (WHERE outcome LIKE 'AMBIG%')/sum(n),2)    AS ambiguous,
  round(100.0*sum(n) FILTER (WHERE outcome='NO_MATCH')/sum(n),2)       AS no_match
FROM scoreboard GROUP BY approach ORDER BY 1;"
```

The sample is deterministic (`ap_uid % 5`), so the numbers reproduce exactly.

## Files

| File | Role |
|---|---|
| `fetch_summit.py` | Pages the county ArcGIS FeatureServers to NDJSON |
| `load.py` | Bulk-loads NDJSON into PostGIS via staging tables |
| `sql/01_schema.sql` | Tables |
| `sql/02_normalize.sql` | **The thing under test** — address normalization |
| `sql/03_measure.sql` | v1. Superseded; retained as the record of a method defect |
| `sql/04_measure_v2.sql` | v2. Tolerant ground truth, projected CRS, typing variants |
| `sql/05_classify.sql` | v3. Superseded — crashed on the quadratic join |
| `sql/06_classify_v2.sql` | v4. Superseded — keyed on the non-unique `ADDR_ID` |
| `sql/07_measure_final.sql` | **Authoritative.** Self-contained; documents all four defects |

The superseded scripts are kept deliberately. Four defects in the method were each capable of
producing a confident wrong answer, and the corrections are what make the final number
credible. Deleting them would leave the result looking like it arrived on the first try.

`data/` is gitignored — large and re-fetchable from the URLs in `fetch_summit.py`.
