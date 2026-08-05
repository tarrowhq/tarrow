-- TASK-0001 AC#1: classification of both approaches across typing variants.
--
-- A candidate parcel is CORRECT when the address point being queried lies
-- inside it or within 5m of it. No single "true parcel" is chosen, which is
-- what makes condominium and overlapping parcels behave sensibly.
--
-- Outcome classes, in the order that matters for Principle I:
--
--   UNIQUE_CORRECT   one candidate, and it is at the address.  The good case.
--   UNIQUE_WRONG     one candidate, and it is NOT at the address.
--                    THE DANGEROUS CASE: confidently measuring from a house
--                    that is not theirs. Worse than returning nothing.
--   AMBIG_INCLUDES   several candidates, one of which is right. Recoverable by
--                    asking the user, or by measuring the most restrictive.
--   AMBIG_EXCLUDES   several candidates, none right. Dangerous.
--   NO_MATCH         nothing matched. Honest failure; user is declined.

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- Every (address, typing-variant) probe
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS probe;
CREATE TABLE probe AS
SELECT addr_id, '1_canonical' AS variant, n_canonical AS norm FROM variant
UNION ALL SELECT addr_id, '2_verbose', n_verbose FROM variant
UNION ALL SELECT addr_id, '3_messy',   n_messy   FROM variant;
CREATE INDEX ON probe (norm);
CREATE INDEX ON probe (addr_id);
ANALYZE probe;

-- ---------------------------------------------------------------------------
-- Approach B's build-time artifact: each address point's parcel.
-- This is what tarrow would precompute; here it doubles as the lookup table.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS ap_parcel;
CREATE TABLE ap_parcel AS
SELECT a.addr_id, p.parcelid
FROM addrpoint a
CROSS JOIN LATERAL (
    SELECT p2.parcelid
    FROM parcel p2
    WHERE ST_DWithin(p2.geom_m, a.geom_m, 5)
    ORDER BY p2.geom_m <-> a.geom_m
    LIMIT 1
) p;
CREATE INDEX ON ap_parcel (addr_id);
ANALYZE ap_parcel;

-- ---------------------------------------------------------------------------
-- APPROACH A: user text -> parcel.siteaddress -> parcel
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS res_a;
CREATE TABLE res_a AS
WITH c AS (
    SELECT pr.addr_id, pr.variant, p.parcelid,
           ST_DWithin(p.geom_m, a.geom_m, 5) AS at_point
    FROM probe pr
    JOIN addrpoint a ON a.addr_id = pr.addr_id
    JOIN parcel p    ON p.norm_addr = pr.norm
    WHERE pr.norm IS NOT NULL
)
SELECT addr_id, variant,
       count(*) AS n_cand,
       count(*) FILTER (WHERE at_point) AS n_at_point
FROM c GROUP BY addr_id, variant;
CREATE INDEX ON res_a (addr_id, variant);
ANALYZE res_a;

-- ---------------------------------------------------------------------------
-- APPROACH B: user text -> address point -> that point's parcel
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS res_b;
CREATE TABLE res_b AS
WITH c AS (
    SELECT pr.addr_id, pr.variant, ap.parcelid,
           ST_DWithin(p.geom_m, a.geom_m, 5) AS at_point
    FROM probe pr
    JOIN addrpoint a ON a.addr_id = pr.addr_id          -- who is asking
    JOIN addrpoint m ON m.norm_addr = pr.norm           -- text-matched point(s)
    JOIN ap_parcel ap ON ap.addr_id = m.addr_id
    JOIN parcel p    ON p.parcelid = ap.parcelid
    WHERE pr.norm IS NOT NULL
)
SELECT addr_id, variant,
       count(DISTINCT parcelid) AS n_cand,
       count(DISTINCT parcelid) FILTER (WHERE at_point) AS n_at_point
FROM c GROUP BY addr_id, variant;
CREATE INDEX ON res_b (addr_id, variant);
ANALYZE res_b;

-- ---------------------------------------------------------------------------
-- Unified scoreboard, scored only over addresses that HAVE a parcel
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS scoreboard;
CREATE TABLE scoreboard AS
SELECT 'A_parcel_text' AS approach, p.variant,
       CASE
         WHEN coalesce(r.n_cand,0) = 0 THEN 'NO_MATCH'
         WHEN r.n_cand = 1 AND r.n_at_point = 1 THEN 'UNIQUE_CORRECT'
         WHEN r.n_cand = 1 THEN 'UNIQUE_WRONG'
         WHEN r.n_at_point > 0 THEN 'AMBIG_INCLUDES'
         ELSE 'AMBIG_EXCLUDES'
       END AS outcome,
       count(*) AS n
FROM probe p
JOIN gt ON gt.addr_id = p.addr_id AND gt.has_parcel
LEFT JOIN res_a r ON r.addr_id = p.addr_id AND r.variant = p.variant
GROUP BY 1,2,3
UNION ALL
SELECT 'B_addrpoint_spatial', p.variant,
       CASE
         WHEN coalesce(r.n_cand,0) = 0 THEN 'NO_MATCH'
         WHEN r.n_cand = 1 AND r.n_at_point = 1 THEN 'UNIQUE_CORRECT'
         WHEN r.n_cand = 1 THEN 'UNIQUE_WRONG'
         WHEN r.n_at_point > 0 THEN 'AMBIG_INCLUDES'
         ELSE 'AMBIG_EXCLUDES'
       END,
       count(*)
FROM probe p
JOIN gt ON gt.addr_id = p.addr_id AND gt.has_parcel
LEFT JOIN res_b r ON r.addr_id = p.addr_id AND r.variant = p.variant
GROUP BY 1,2,3;
