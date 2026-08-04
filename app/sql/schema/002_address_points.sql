-- Summit County Address Points -- the ground-truth address list
-- (spikes/task-0001-geocoding/DECISION.md §1). A typed address resolves
-- against THIS layer; somap never matches against parcels.site_address.
--
-- Geometry is stored in EPSG:6549 (NAD83(2011) Ohio North, metres), never
-- geography -- DECISION §2 makes this load-bearing: geography casts defeat
-- the spatial index.

CREATE TABLE address_points (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    addr_id       text,   -- source ADDR_ID. NOT unique in the source data
                           -- (30,426 duplicates, 26,660 empty -- DECISION
                           -- §7): Phase 2's load asserts uniqueness rather
                           -- than assuming it.
    addr_num      text,
    pre_dir       text,
    pre_type      text,
    str_name      text,
    str_type      text,
    suf_dir       text,
    unit_type     text,
    unit_num      text,
    city          text,
    zip           text,
    full_address  text,   -- pre-composed source label, e.g. "4718 KRANCZ DR"
    normalized    text,   -- normalized form used for matching (Phase 3)
    geom          geometry(Point, 6549) NOT NULL,
    layer_id      text NOT NULL REFERENCES layers (id)
);

CREATE INDEX address_points_geom_idx ON address_points USING gist (geom);
CREATE INDEX address_points_normalized_idx ON address_points (normalized);
