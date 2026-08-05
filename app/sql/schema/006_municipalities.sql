-- Summit County municipal boundaries (cities, villages, townships).
--
-- DECISION §6: parcel `siteaddress` is not unique county-wide, because the
-- parcel layer carries no city field at all. Deriving each parcel's
-- municipality by spatial join to these boundaries is what makes a parcel's
-- address interpretable, and it is the layer TASK-0007's municipal rule
-- stacking will need anyway.
--
-- Geometry in EPSG:6549 like every other measurement layer (DECISION §2) --
-- there is no geography column anywhere in this schema.

CREATE TABLE municipalities (
    id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name              text NOT NULL,
    kind              text,          -- CITY | VILLAGE | TOWNSHIP, as published
    fips_place_code   text,
    geom              geometry(MultiPolygon, 6549) NOT NULL,
    layer_id          text NOT NULL REFERENCES layers (id)
);

CREATE INDEX municipalities_geom_idx ON municipalities USING gist (geom);

-- A municipality name appearing twice would mean the spatial join that
-- derives parcels.municipality is ambiguous. The ETL asserts uniqueness on
-- this column; the constraint states the same thing where a reader of the
-- schema will see it.
CREATE UNIQUE INDEX municipalities_name_idx ON municipalities (name);

COMMENT ON TABLE municipalities IS
    'Summit County jurisdictions. Used to derive parcels.municipality '
    '(DECISION §6) and, later, to stack municipal residency rules '
    '(TASK-0007).';
