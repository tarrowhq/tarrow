-- Summit County tax parcels. A unit of ownership and taxation, not of
-- addressable location (DECISION §1) -- site_address is a situs label
-- carried for reference and is never matched against a typed address.
--
-- Mineral-rights parcels (usecd 200-series: 1,128 records, 54,573 acres of
-- overlapping subsurface polygons, per DECISION §6) must never enter
-- measurement geometry. is_mineral_rights is a stored, indexable flag
-- rather than a usecd LIKE check repeated at query time, so the exclusion
-- can't silently drift between Phase 2's load and Phase 3's query.

CREATE TABLE parcels (
    id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    parcel_id          text NOT NULL,
    site_address       text,     -- situs label only; never matched against
    usecd              text,     -- county use code
    municipality       text,     -- derived by spatial join to municipal
                                  -- boundaries (DECISION §6); site_address
                                  -- alone is not unique county-wide
    is_mineral_rights  boolean NOT NULL DEFAULT false,
    geom               geometry(MultiPolygon, 6549) NOT NULL,
    layer_id           text NOT NULL REFERENCES layers (id)
);

CREATE INDEX parcels_geom_idx ON parcels USING gist (geom);
CREATE INDEX parcels_parcel_id_idx ON parcels (parcel_id);

-- The index the proximity and resolve-address queries actually want:
-- mineral-rights geometry excluded at the index level, not filtered out of
-- every plan by a WHERE clause hoping to hit a full index.
CREATE INDEX parcels_measurable_geom_idx ON parcels USING gist (geom)
    WHERE NOT is_mineral_rights;
