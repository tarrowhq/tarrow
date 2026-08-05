-- TASK-0001 AC#1: the measurement.
--
-- QUESTION: if a user types their address, do we find the right parcel?
--
-- METHOD. Address Points is an independently maintained dataset of addresses
-- that actually exist, spelled by the county addressing authority. For each
-- one we compute two things that never consult each other:
--
--   TRUTH      -- which parcel polygon physically CONTAINS the address point.
--                 Pure geometry. Independent of every spelling decision.
--   CANDIDATE  -- which parcel(s) the normalizer's output matches textually
--                 against parcel.siteaddress.
--
-- Comparing them yields the number that matters. Not "did we match something"
-- but "did we match the RIGHT thing" -- because under Principle I a confident
-- match to the wrong parcel is measuring from a house that isn't theirs, and
-- can under-restrict. A wrong match is worse than no match.

\set ON_ERROR_STOP on
\timing on

-- ---------------------------------------------------------------------------
-- Materialize normalized forms on both sides
-- ---------------------------------------------------------------------------
ALTER TABLE parcel    ADD COLUMN IF NOT EXISTS norm_addr text;
ALTER TABLE addrpoint ADD COLUMN IF NOT EXISTS norm_addr text;

UPDATE parcel    SET norm_addr = tarrow_normalize_address(siteaddress);
-- LSN is the addressing authority's own composed form ("4718 KRANCZ DR").
-- Using it rather than re-composing from components keeps this a test of
-- matching, not of our own string assembly.
UPDATE addrpoint SET norm_addr = tarrow_normalize_address(lsn);

CREATE INDEX IF NOT EXISTS parcel_norm_idx    ON parcel (norm_addr);
CREATE INDEX IF NOT EXISTS addrpoint_norm_idx ON addrpoint (norm_addr);
ANALYZE parcel;
ANALYZE addrpoint;

-- ---------------------------------------------------------------------------
-- A. Is a normalized parcel address even unique county-wide?
--    siteaddress carries no city, so "100 MAIN ST" in two municipalities
--    collides. This bounds how well ANY text matcher could possibly do.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS m_uniqueness;
CREATE TABLE m_uniqueness AS
SELECT norm_addr, count(*) AS n_parcels
FROM parcel
WHERE norm_addr IS NOT NULL
GROUP BY norm_addr;

-- ---------------------------------------------------------------------------
-- B. Ground truth: which parcel contains each address point
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS truth;
CREATE TABLE truth AS
SELECT a.addr_id,
       array_agg(p.parcelid ORDER BY p.parcelid) FILTER (WHERE p.parcelid IS NOT NULL)
           AS true_parcels
FROM addrpoint a
LEFT JOIN parcel p ON ST_Contains(p.geom, a.geom)
GROUP BY a.addr_id;

CREATE INDEX ON truth (addr_id);

-- ---------------------------------------------------------------------------
-- C. Candidates: which parcels the text matcher proposes
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS cand;
CREATE TABLE cand AS
SELECT a.addr_id,
       array_agg(p.parcelid ORDER BY p.parcelid) FILTER (WHERE p.parcelid IS NOT NULL)
           AS cand_parcels
FROM addrpoint a
LEFT JOIN parcel p ON p.norm_addr = a.norm_addr AND p.norm_addr IS NOT NULL
GROUP BY a.addr_id;

CREATE INDEX ON cand (addr_id);

-- ---------------------------------------------------------------------------
-- D. Classify every address point
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS outcome;
CREATE TABLE outcome AS
SELECT
    a.addr_id,
    a.lsn,
    a.city,
    a.norm_addr,
    coalesce(array_length(t.true_parcels, 1), 0) AS n_true,
    coalesce(array_length(c.cand_parcels, 1), 0) AS n_cand,
    t.true_parcels,
    c.cand_parcels,
    CASE
        -- No ground truth: the point falls in no parcel polygon. We cannot
        -- judge a match we have no answer key for. Reported, not scored.
        WHEN coalesce(array_length(t.true_parcels, 1), 0) = 0
            THEN 'NO_GROUND_TRUTH'
        WHEN coalesce(array_length(c.cand_parcels, 1), 0) = 0
            THEN 'NO_MATCH'
        WHEN array_length(c.cand_parcels, 1) = 1
             AND c.cand_parcels[1] = ANY (t.true_parcels)
            THEN 'UNIQUE_CORRECT'
        WHEN array_length(c.cand_parcels, 1) = 1
            THEN 'UNIQUE_WRONG'
        WHEN c.cand_parcels && t.true_parcels
            THEN 'AMBIGUOUS_INCLUDES_TRUTH'
        ELSE 'AMBIGUOUS_EXCLUDES_TRUTH'
    END AS outcome
FROM addrpoint a
LEFT JOIN truth t ON t.addr_id = a.addr_id
LEFT JOIN cand  c ON c.addr_id = a.addr_id;

CREATE INDEX ON outcome (outcome);
ANALYZE outcome;
