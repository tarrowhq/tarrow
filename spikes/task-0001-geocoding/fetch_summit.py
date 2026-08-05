#!/usr/bin/env python3
"""Page a Summit County ArcGIS FeatureServer layer down to newline-delimited JSON.

Evidence-gathering for TASK-0001 AC #1. This is a measurement harness, NOT an
architectural commitment -- the language and shape of the real ingest pipeline
is undecided and is not being decided here.

Both layers are public and freely redistributable, which is what makes them
admissible under Constitution Principle VII.
"""

import json
import sys
import time
import urllib.parse
import urllib.request

LAYERS = {
    "parcels": {
        "url": "https://scgis.summitoh.net/hosted/rest/services/"
               "parcels_web_GEODATA_Tax_Parcels/FeatureServer/0",
        "fields": "parcelid,siteaddress",
        "oid": "OBJECTID",
        "page": 2000,
    },
    "addrpoints": {
        "url": "https://scgis.summitoh.net/hosted/rest/services/"
               "AddressPoints_DBC/FeatureServer/0",
        "fields": "ADDR_ID,ADDR_NUM,PRE_DIR,PRE_TYPE,STR_NAME,STR_TYPE,SUF_DIR,"
                  "UNIT_TYPE,UNIT_NUM,CITY,ZIP,LSN",
        "oid": "OBJECTID",
        "page": 2000,
    },
}


def fetch(url, params, attempts=5):
    """GET with retry. ArcGIS servers rate-limit and occasionally 500."""
    qs = urllib.parse.urlencode(params)
    for attempt in range(attempts):
        try:
            req = urllib.request.Request(
                f"{url}?{qs}", headers={"User-Agent": "tarrow-spike/0.1"}
            )
            with urllib.request.urlopen(req, timeout=180) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            # ArcGIS signals failure in a 200 body rather than the status line.
            if "error" in payload:
                raise RuntimeError(payload["error"])
            return payload
        except Exception as exc:  # noqa: BLE001 - retry anything transient
            if attempt == attempts - 1:
                raise
            backoff = 2 ** attempt
            print(f"    retry {attempt + 1}/{attempts - 1} in {backoff}s: {exc}",
                  file=sys.stderr, flush=True)
            time.sleep(backoff)
    raise AssertionError("unreachable")


def main():
    name = sys.argv[1]
    out_path = sys.argv[2]
    spec = LAYERS[name]

    total = fetch(spec["url"] + "/query",
                  {"where": "1=1", "returnCountOnly": "true", "f": "json"})["count"]
    print(f"{name}: {total} features -> {out_path}", flush=True)

    written, offset = 0, 0
    with open(out_path, "w", encoding="utf-8") as out:
        while True:
            payload = fetch(spec["url"] + "/query", {
                "where": "1=1",
                "outFields": spec["fields"],
                "returnGeometry": "true",
                "outSR": "4326",
                "orderByFields": spec["oid"],
                "resultOffset": offset,
                "resultRecordCount": spec["page"],
                "f": "geojson",
            })
            feats = payload.get("features") or []
            if not feats:
                break
            for feat in feats:
                out.write(json.dumps(feat, separators=(",", ":")) + "\n")
            written += len(feats)
            offset += len(feats)
            pct = 100.0 * written / total if total else 0.0
            print(f"  {written}/{total} ({pct:.1f}%)", flush=True)
            if len(feats) < spec["page"]:
                break

    print(f"{name}: done, {written} features", flush=True)
    if written < total:
        print(f"WARNING: wrote {written} of {total} reported features",
              file=sys.stderr, flush=True)


if __name__ == "__main__":
    main()
