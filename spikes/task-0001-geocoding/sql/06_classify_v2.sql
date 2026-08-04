-- TASK-0001 AC#1: classification, v2.
--
-- v1 crashed the server. The cause is itself a finding, not just an
-- engineering mishap: DISCARDING UNIT NUMBERS collapses every unit of an
-- apartment building onto one normalized address. "2200 HIGH ST" appears 218
-- times in the address points; one condo address maps to 505 separate parcels.
-- Self-joining on normalized address therefore goes quadratic on exactly the
-- addresses where people actually live densely.
--
-- Three changes:
--
--   SAMPLE. A deterministic 20% sample by hash of addr_id. AC#1 asks for a
--   documented accuracy sample, and ~50k addresses puts the 95% CI near
--   +/-0.4pp -- far tighter than the differences being decided. Deterministic
--   so the number is reproducible, per Principle VII.
--
--   BOUNDED CANDIDATES. A normalized address matching more than 20 parcels is
--   classified AMBIG_LARGE without materializing the cross product. This is
--   not a shortcut: an address matching 505 parcels is ambiguous under any
--   product behaviour, so resolving WHICH of the 505 is right changes no
--   decision. It is reported as its own row rather than hidden.
--
--   APPROACH B COLLAPSES FIRST. B looks up a distinct (normalized address ->
--   parcel) index, so a 218-unit building contributes ONE row, not 218. That
--   this falls out naturally is itself evidence about the two approaches.

\set ON_ERROR_STOP on
SET work_mem = '256MB';
SET max_parallel_workers_per_gather = 0;

-- ---------------------------------------------------------------------------
-- Deterministic 20% sample of addresses that have a parcel
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS sample_id;
CREATE TABLE sample_id AS
SELECT addr_id FROM gt
WHERE has_parcel AND (abs(hashtext(addr_id)) % 100) < 20;
CREATE INDEX ON sample_id (addr_id);
ANALYZE sample_id;

DROP TABLE IF EXISTS sprobe;
CREATE TABLE sprobe AS
SELECT p.addr_id, p.variant, p.norm
FROM probe p JOIN sample_id s ON s.addr_id = p.addr_id
WHERE p.norm IS NOT NULL;
CREATE INDEX ON sprobe (norm);
CREATE INDEX ON sprobe (addr_id);
ANALYZE sprobe;

-- ---------------------------------------------------------------------------
-- Per-norm fan-out on each side
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS parcel_norm_stat;
CREATE TABLE parcel_norm_stat AS
SELECT norm_addr AS norm, count(*) AS n FROM parcel
WHERE norm_addr IS NOT NULL GROUP BY norm_addr;
CREATE INDEX ON parcel_norm_stat (norm);
ANALYZE parcel_norm_stat;

-- Approach B's index: distinct normalized address -> parcel. The apartment
-- collapse happens HERE, once, instead of in every join.
DROP TABLE IF EXISTS ap_norm_parcel;
CREATE TABLE ap_norm_parcel AS
SELECT DISTINCT m.norm_addr AS norm, ap.parcelid
FROM addrpoint m
JOIN ap_parcel ap ON ap.addr_id = m.addr_id
WHERE m.norm_addr IS NOT NULL;
CREATE INDEX ON ap_norm_parcel (norm);
ANALYZE ap_norm_parcel;

DROP TABLE IF EXISTS ap_norm_stat;
CREATE TABLE ap_norm_stat AS
SELECT norm, count(*) AS n FROM ap_norm_parcel GROUP BY norm;
CREATE INDEX ON ap_norm_stat (norm);
ANALYZE ap_norm_stat;

-- ---------------------------------------------------------------------------
-- APPROACH A: user text -> parcel.siteaddress -> parcel
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS res_a;
CREATE TABLE res_a AS
WITH small AS (
    SELECT pr.addr_id, pr.variant, p.parcelid,
           ST_DWithin(p.geom_m, a.geom_m, 5) AS at_point
    FROM sprobe pr
    JOIN parcel_norm_stat st ON st.norm = pr.norm AND st.n <= 20
    JOIN parcel p    ON p.norm_addr = pr.norm
    JOIN addrpoint a ON a.addr_id = pr.addr_id
)
SELECT addr_id, variant, count(*) AS n_cand,
       count(*) FILTER (WHERE at_point) AS n_at_point, false AS large
FROM small GROUP BY addr_id, variant
UNION ALL
SELECT pr.addr_id, pr.variant, st.n, 0, true
FROM sprobe pr JOIN parcel_norm_stat st ON st.norm = pr.norm AND st.n > 20;
CREATE INDEX ON res_a (addr_id, variant);
ANALYZE res_a;

-- ---------------------------------------------------------------------------
-- APPROACH B: user text -> address point -> that point's parcel
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS res_b;
CREATE TABLE res_b AS
WITH small AS (
    SELECT pr.addr_id, pr.variant, anp.parcelid,
           ST_DWithin(p.geom_m, a.geom_m, 5) AS at_point
    FROM sprobe pr
    JOIN ap_norm_stat st ON st.norm = pr.norm AND st.n <= 20
    JOIN ap_norm_parcel anp ON anp.norm = pr.norm
    JOIN parcel p    ON p.parcelid = anp.parcelid
    JOIN addrpoint a ON a.addr_id = pr.addr_id
)
SELECT addr_id, variant, count(*) AS n_cand,
       count(*) FILTER (WHERE at_point) AS n_at_point, false AS large
FROM small GROUP BY addr_id, variant
UNION ALL
SELECT pr.addr_id, pr.variant, st.n, 0, true
FROM sprobe pr JOIN ap_norm_stat st ON st.norm = pr.norm AND st.n > 20;
CREATE INDEX ON res_b (addr_id, variant);
ANALYZE res_b;

-- ---------------------------------------------------------------------------
-- Scoreboard
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS scoreboard;
CREATE TABLE scoreboard AS
SELECT 'A_parcel_text' AS approach, s.variant, cls.outcome, count(*) AS n
FROM sprobe s
LEFT JOIN res_a r ON r.addr_id = s.addr_id AND r.variant = s.variant
CROSS JOIN LATERAL (SELECT CASE
    WHEN r.addr_id IS NULL OR coalesce(r.n_cand,0) = 0 THEN 'NO_MATCH'
    WHEN r.large                                       THEN 'AMBIG_LARGE'
    WHEN r.n_cand = 1 AND r.n_at_point = 1             THEN 'UNIQUE_CORRECT'
    WHEN r.n_cand = 1                                  THEN 'UNIQUE_WRONG'
    WHEN r.n_at_point > 0                              THEN 'AMBIG_INCLUDES'
    ELSE 'AMBIG_EXCLUDES' END AS outcome) cls
GROUP BY 1,2,3
UNION ALL
SELECT 'B_addrpoint_spatial', s.variant, cls.outcome, count(*)
FROM sprobe s
LEFT JOIN res_b r ON r.addr_id = s.addr_id AND r.variant = s.variant
CROSS JOIN LATERAL (SELECT CASE
    WHEN r.addr_id IS NULL OR coalesce(r.n_cand,0) = 0 THEN 'NO_MATCH'
    WHEN r.large                                       THEN 'AMBIG_LARGE'
    WHEN r.n_cand = 1 AND r.n_at_point = 1             THEN 'UNIQUE_CORRECT'
    WHEN r.n_cand = 1                                  THEN 'UNIQUE_WRONG'
    WHEN r.n_at_point > 0                              THEN 'AMBIG_INCLUDES'
    ELSE 'AMBIG_EXCLUDES' END AS outcome) cls
GROUP BY 1,2,3;
