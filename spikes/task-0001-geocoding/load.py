#!/usr/bin/env python3
"""Load the fetched NDJSON GeoJSON into PostGIS.

Staging-table pattern: COPY the raw rows in with geometry as GeoJSON text
(fast, one pass), then convert to real geometry in a single set-based
statement. Per-row ST_GeomFromGeoJSON via INSERT would take minutes.
"""

import json
import os
import sys

import psycopg

DATA = os.environ.get("SPIKE_DATA", "/work/spikes/task-0001-geocoding/data")

SPECS = {
    "parcel": {
        "path": f"{DATA}/parcels.ndjson",
        "cols": ["parcelid", "siteaddress"],
        "props": ["parcelid", "siteaddress"],
        # ST_Force2D: the source polygons carry a Z dimension that nothing here
        # uses. Distance is measured on the ground, not through the air.
        "geom_sql": "ST_Multi(ST_MakeValid(ST_Force2D(ST_GeomFromGeoJSON(g))))",
        "geom_type": "MultiPolygon",
    },
    "addrpoint": {
        "path": f"{DATA}/addrpoints.ndjson",
        "cols": ["addr_id", "addr_num", "pre_dir", "pre_type", "str_name",
                 "str_type", "suf_dir", "unit_type", "unit_num", "city",
                 "zip", "lsn"],
        "props": ["ADDR_ID", "ADDR_NUM", "PRE_DIR", "PRE_TYPE", "STR_NAME",
                  "STR_TYPE", "SUF_DIR", "UNIT_TYPE", "UNIT_NUM", "CITY",
                  "ZIP", "LSN"],
        "geom_sql": "ST_Force2D(ST_GeomFromGeoJSON(g))",
        "geom_type": "Point",
    },
}


def load(conn, table, spec):
    cols, props = spec["cols"], spec["props"]
    stage = f"{table}_stage"

    with conn.cursor() as cur:
        cur.execute(f"DROP TABLE IF EXISTS {stage}")
        coldefs = ", ".join(f"{c} text" for c in cols)
        cur.execute(f"CREATE UNLOGGED TABLE {stage} ({coldefs}, g text)")

    copy_sql = f"COPY {stage} ({', '.join(cols)}, g) FROM STDIN"
    n, skipped = 0, 0
    with conn.cursor() as cur, cur.copy(copy_sql) as cp:
        with open(spec["path"], encoding="utf-8") as fh:
            for line in fh:
                try:
                    feat = json.loads(line)
                except json.JSONDecodeError:
                    skipped += 1
                    continue
                geom = feat.get("geometry")
                if geom is None:
                    # A feature with no geometry cannot be measured against and
                    # cannot be ground truth. Counted, not silently dropped.
                    skipped += 1
                    continue
                attrs = feat.get("properties") or {}
                row = [attrs.get(p) for p in props]
                row.append(json.dumps(geom, separators=(",", ":")))
                cp.write_row(row)
                n += 1
                if n % 50000 == 0:
                    print(f"    {n} staged", flush=True)

    print(f"  {table}: {n} staged, {skipped} skipped (no geometry / bad json)",
          flush=True)

    with conn.cursor() as cur:
        collist = ", ".join(cols)
        cur.execute(
            f"INSERT INTO {table} ({collist}, geom) "
            f"SELECT {collist}, ST_SetSRID({spec['geom_sql']}, 4326) FROM {stage}"
        )
        cur.execute(f"DROP TABLE {stage}")
    conn.commit()

    with conn.cursor() as cur:
        cur.execute(f"SELECT count(*), count(geom) FROM {table}")
        total, withgeom = cur.fetchone()
    print(f"  {table}: {total} rows, {withgeom} with geometry", flush=True)
    return total


def main():
    with psycopg.connect() as conn:
        with conn.cursor() as cur:
            cur.execute(open(
                "/work/spikes/task-0001-geocoding/sql/01_schema.sql").read())
        conn.commit()
        print("schema created", flush=True)

        for table, spec in SPECS.items():
            if not os.path.exists(spec["path"]):
                sys.exit(f"missing input: {spec['path']}")
            print(f"loading {table} from {spec['path']}", flush=True)
            load(conn, table, spec)

        print("indexing (this is the slow part)", flush=True)
        with conn.cursor() as cur:
            cur.execute("CREATE INDEX ON parcel USING GIST (geom)")
            cur.execute("CREATE INDEX ON addrpoint USING GIST (geom)")
            cur.execute("ANALYZE parcel")
            cur.execute("ANALYZE addrpoint")
        conn.commit()
        print("done", flush=True)


if __name__ == "__main__":
    main()
