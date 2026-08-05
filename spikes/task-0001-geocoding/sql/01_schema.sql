-- TASK-0001 AC#1 measurement schema.
--
-- Two independently-maintained Summit County datasets:
--
--   parcel     -- Tax Parcels. Polygons. Address is ONE freetext field
--                 (siteaddress), no city, no ZIP. This is what tarrow would
--                 match a user's typed address against.
--
--   addrpoint  -- Address Points, maintained by the county addressing
--                 authority as a SEPARATE dataset with STRUCTURED components.
--                 This is the ground-truth address list: it tells us which
--                 addresses actually exist, spelled by someone other than the
--                 parcel table.
--
-- The two are joined SPATIALLY, not textually, to establish truth: an address
-- point physically inside a parcel polygon belongs to that parcel, and that
-- fact is completely independent of how either side spells the address. That
-- independence is what makes this a real measurement rather than a tautology.

DROP TABLE IF EXISTS parcel CASCADE;
DROP TABLE IF EXISTS addrpoint CASCADE;

CREATE TABLE parcel (
    parcelid    text,
    siteaddress text,
    geom        geometry(MultiPolygon, 4326)
);

CREATE TABLE addrpoint (
    addr_id   text,
    addr_num  text,
    pre_dir   text,
    pre_type  text,
    str_name  text,
    str_type  text,
    suf_dir   text,
    unit_type text,
    unit_num  text,
    city      text,
    zip       text,
    lsn       text,   -- pre-composed "4718 KRANCZ DR"
    geom      geometry(Point, 4326)
);
