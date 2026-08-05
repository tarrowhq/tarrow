-- TASK-0001 AC#1, measurement v2.
--
-- Three corrections and one addition over v1.
--
-- CORRECTION 1 -- TOLERANT GROUND TRUTH. v1 used strict ST_Contains. Diagnosis
-- showed 14.6% of address points fell in no parcel, but ~80% of those sit
-- within 3m of one and 97% within 10m: coordinate and topology noise between
-- two independently digitized layers, not addresses on parcel-less land.
-- Strict containment was measuring GIS precision, not address matching.
--
-- CORRECTION 2 -- NO SINGLE "TRUE PARCEL". Picking one true parcel per address
-- mishandles condominium and overlapping parcels. Instead a candidate is
-- judged CORRECT if the address point lies inside it or within 5m of it. That
-- is the question we actually care about: does the matched parcel correspond
-- to where this address physically is?
--
-- CORRECTION 3 -- PROJECTED CRS. v1's ST_DWithin(::geography) could not use
-- the spatial index and ran 12+ minutes before being cancelled. Everything
-- spatial now happens in EPSG:3734 (Ohio North, US survey feet -> meters via
-- the metre-based 3734 variant), where distance is planar, index-assisted, and
-- exact enough at these scales.
--
-- ADDITION -- APPROACH B. v1 tested only the architecture as decided:
--     user text --> parcel.siteaddress --> parcel
-- Diagnosis suggests a better one:
--     user text --> address point (authoritative list) --> containing parcel
-- Approach B never text-matches the parcel table's freetext siteaddress at
-- all. Both are measured so the choice rests on evidence.

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- Projected geometry, in metres. EPSG:6549 = NAD83(2011) Ohio North (metre).
-- ---------------------------------------------------------------------------
ALTER TABLE parcel    ADD COLUMN IF NOT EXISTS geom_m geometry(MultiPolygon, 6549);
ALTER TABLE addrpoint ADD COLUMN IF NOT EXISTS geom_m geometry(Point, 6549);

UPDATE parcel    SET geom_m = ST_Transform(geom, 6549) WHERE geom_m IS NULL;
UPDATE addrpoint SET geom_m = ST_Transform(geom, 6549) WHERE geom_m IS NULL;

CREATE INDEX IF NOT EXISTS parcel_geom_m_idx    ON parcel    USING GIST (geom_m);
CREATE INDEX IF NOT EXISTS addrpoint_geom_m_idx ON addrpoint USING GIST (geom_m);
ANALYZE parcel;
ANALYZE addrpoint;

-- ---------------------------------------------------------------------------
-- Does this address point have ANY parcel at it? (denominator eligibility)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS gt;
CREATE TABLE gt AS
SELECT a.addr_id,
       EXISTS (SELECT 1 FROM parcel p
               WHERE ST_DWithin(p.geom_m, a.geom_m, 5)) AS has_parcel
FROM addrpoint a;
CREATE INDEX ON gt (addr_id);
ANALYZE gt;

-- ---------------------------------------------------------------------------
-- Reverse lookups, to synthesize realistic user typing variants
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS street_type_long;
CREATE TABLE street_type_long (canonical text PRIMARY KEY, long text NOT NULL);
INSERT INTO street_type_long VALUES
    ('ST','STREET'),('AVE','AVENUE'),('RD','ROAD'),('DR','DRIVE'),
    ('BLVD','BOULEVARD'),('LN','LANE'),('CT','COURT'),('CIR','CIRCLE'),
    ('PL','PLACE'),('TER','TERRACE'),('PKWY','PARKWAY'),('HWY','HIGHWAY'),
    ('TRL','TRAIL'),('PT','POINT'),('SQ','SQUARE');

DROP TABLE IF EXISTS dir_long;
CREATE TABLE dir_long (canonical text PRIMARY KEY, long text NOT NULL);
INSERT INTO dir_long VALUES
    ('N','NORTH'),('S','SOUTH'),('E','EAST'),('W','WEST'),
    ('NE','NORTHEAST'),('NW','NORTHWEST'),('SE','SOUTHEAST'),('SW','SOUTHWEST');

-- ---------------------------------------------------------------------------
-- User typing variants, synthesized from the structured components
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS variant;
CREATE TABLE variant AS
SELECT
    a.addr_id,
    -- V1: exactly as the addressing authority composes it.
    a.lsn AS v_canonical,
    -- V2: spelled-out directional and street type, mixed case, full postal
    -- tail. What someone copying off a lease or utility bill types.
    initcap(trim(regexp_replace(
        coalesce(a.addr_num,'') || ' ' ||
        coalesce((SELECT long FROM dir_long WHERE canonical = upper(a.pre_dir)), a.pre_dir, '') || ' ' ||
        coalesce(a.str_name,'') || ' ' ||
        coalesce((SELECT long FROM street_type_long WHERE canonical = upper(a.str_type)), a.str_type, '') || ' ' ||
        coalesce(a.suf_dir,''), '\s+', ' ', 'g'))) ||
        ', ' || coalesce(initcap(a.city),'') || ', OH ' || coalesce(a.zip,'') AS v_verbose,
    -- V3: lowercase, no punctuation, unit appended when one exists. What
    -- someone types quickly on a phone.
    lower(trim(regexp_replace(
        coalesce(a.addr_num,'') || ' ' || coalesce(a.pre_dir,'') || ' ' ||
        coalesce(a.str_name,'') || ' ' || coalesce(a.str_type,'') || ' ' ||
        coalesce(a.suf_dir,'') || ' ' ||
        CASE WHEN coalesce(a.unit_num,'') <> ''
             THEN coalesce(nullif(a.unit_type,''),'APT') || ' ' || a.unit_num
             ELSE '' END, '\s+', ' ', 'g'))) AS v_messy
FROM addrpoint a;

ALTER TABLE variant ADD COLUMN n_canonical text;
ALTER TABLE variant ADD COLUMN n_verbose   text;
ALTER TABLE variant ADD COLUMN n_messy     text;
UPDATE variant SET
    n_canonical = tarrow_normalize_address(v_canonical),
    n_verbose   = tarrow_normalize_address(v_verbose),
    n_messy     = tarrow_normalize_address(v_messy);

CREATE INDEX ON variant (addr_id);
CREATE INDEX ON variant (n_canonical);
CREATE INDEX ON variant (n_verbose);
CREATE INDEX ON variant (n_messy);
ANALYZE variant;
