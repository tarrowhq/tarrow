-- TASK-0001 AC#1 -- authoritative, self-contained measurement.
--
-- Supersedes 03/04/05/06, which are retained as the record of how the method
-- was corrected. Four defects were found and fixed along the way; each one
-- would have produced a confidently wrong number:
--
--   1. STRICT CONTAINMENT (03). ST_Contains as ground truth reported 14.6% of
--      addresses as having no parcel. ~80% of those are within 3m and 97%
--      within 10m -- registration noise between two independently digitized
--      layers. It was measuring GIS precision, not address matching.
--
--   2. GEOGRAPHY CASTS (04). ST_DWithin(::geography) cannot use the spatial
--      index; the ground-truth build ran 12+ minutes before cancellation.
--      Everything spatial now runs in EPSG:6549 (Ohio North, metres).
--
--   3. QUADRATIC SELF-JOIN (05). Discarding unit numbers -- a deliberate
--      architectural choice -- collapses a 218-unit building onto one
--      normalized address, and one condo address onto 505 parcels. Joining on
--      normalized address went quadratic exactly where people live densely,
--      and killed the server. Now bounded.
--
--   4. ADDR_ID IS NOT UNIQUE (06). The source layer has 30,426 duplicate
--      ADDR_ID rows, including 26,660 with an EMPTY id and single ids repeated
--      up to 155 times. Every join keyed on it silently inflated counts. This
--      script keys on a surrogate id instead.
--
-- Defect 4 is worth stating plainly in the writeup: a field named ADDR_ID in
-- an authoritative government dataset was not an identifier. Nothing warned
-- us. It was caught only because a derived row count failed an arithmetic
-- sanity check (45,239 x 3 != 161,004).

\set ON_ERROR_STOP on
SET work_mem = '256MB';
SET max_parallel_workers_per_gather = 0;

-- ---------------------------------------------------------------------------
-- 0. Surrogate key
-- ---------------------------------------------------------------------------
ALTER TABLE addrpoint DROP COLUMN IF EXISTS ap_uid;
ALTER TABLE addrpoint ADD COLUMN ap_uid bigint GENERATED ALWAYS AS IDENTITY;
CREATE UNIQUE INDEX IF NOT EXISTS addrpoint_uid_idx ON addrpoint (ap_uid);
ANALYZE addrpoint;

-- ---------------------------------------------------------------------------
-- 1. Ground truth: does a parcel exist at this address point (<=5m)?
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS gt2;
CREATE TABLE gt2 AS
SELECT a.ap_uid,
       EXISTS (SELECT 1 FROM parcel p WHERE ST_DWithin(p.geom_m, a.geom_m, 5)) AS has_parcel
FROM addrpoint a;
CREATE UNIQUE INDEX ON gt2 (ap_uid);
ANALYZE gt2;

-- ---------------------------------------------------------------------------
-- 2. Each address point's parcel (Approach B's build-time artifact)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS ap_parcel2;
CREATE TABLE ap_parcel2 AS
SELECT a.ap_uid, p.parcelid
FROM addrpoint a
CROSS JOIN LATERAL (
    SELECT p2.parcelid FROM parcel p2
    WHERE ST_DWithin(p2.geom_m, a.geom_m, 5)
    ORDER BY p2.geom_m <-> a.geom_m LIMIT 1
) p;
CREATE UNIQUE INDEX ON ap_parcel2 (ap_uid);
ANALYZE ap_parcel2;

-- ---------------------------------------------------------------------------
-- 3. Typing variants, normalized
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS variant2;
CREATE TABLE variant2 AS
SELECT a.ap_uid,
    tarrow_normalize_address(a.lsn) AS n_canonical,
    tarrow_normalize_address(
        initcap(trim(regexp_replace(
            coalesce(a.addr_num,'') || ' ' ||
            coalesce((SELECT long FROM dir_long WHERE canonical = upper(a.pre_dir)), a.pre_dir, '') || ' ' ||
            coalesce(a.str_name,'') || ' ' ||
            coalesce((SELECT long FROM street_type_long WHERE canonical = upper(a.str_type)), a.str_type, '') || ' ' ||
            coalesce(a.suf_dir,''), '\s+', ' ', 'g'))) ||
        ', ' || coalesce(initcap(a.city),'') || ', OH ' || coalesce(a.zip,'')
    ) AS n_verbose,
    tarrow_normalize_address(
        lower(trim(regexp_replace(
            coalesce(a.addr_num,'') || ' ' || coalesce(a.pre_dir,'') || ' ' ||
            coalesce(a.str_name,'') || ' ' || coalesce(a.str_type,'') || ' ' ||
            coalesce(a.suf_dir,'') || ' ' ||
            CASE WHEN coalesce(a.unit_num,'') <> ''
                 THEN coalesce(nullif(a.unit_type,''),'APT') || ' ' || a.unit_num
                 ELSE '' END, '\s+', ' ', 'g')))
    ) AS n_messy
FROM addrpoint a;
CREATE UNIQUE INDEX ON variant2 (ap_uid);
ANALYZE variant2;

-- ---------------------------------------------------------------------------
-- 4. Deterministic 20% sample of addresses that have a parcel
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS sprobe2;
CREATE TABLE sprobe2 AS
SELECT v.ap_uid, x.variant, x.norm
FROM variant2 v
JOIN gt2 ON gt2.ap_uid = v.ap_uid AND gt2.has_parcel
CROSS JOIN LATERAL (VALUES
    ('1_canonical', v.n_canonical),
    ('2_verbose',   v.n_verbose),
    ('3_messy',     v.n_messy)
) x(variant, norm)
WHERE (v.ap_uid % 5) = 0          -- deterministic 20%
  AND x.norm IS NOT NULL;
CREATE INDEX ON sprobe2 (norm);
CREATE INDEX ON sprobe2 (ap_uid);
ANALYZE sprobe2;

-- ---------------------------------------------------------------------------
-- 5. Per-norm fan-out, both sides
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS pstat;
CREATE TABLE pstat AS
SELECT norm_addr AS norm, count(*) AS n FROM parcel
WHERE norm_addr IS NOT NULL GROUP BY norm_addr;
CREATE UNIQUE INDEX ON pstat (norm);
ANALYZE pstat;

DROP TABLE IF EXISTS anp;
CREATE TABLE anp AS
SELECT DISTINCT a.norm_addr AS norm, ap.parcelid
FROM addrpoint a JOIN ap_parcel2 ap ON ap.ap_uid = a.ap_uid
WHERE a.norm_addr IS NOT NULL;
CREATE INDEX ON anp (norm);
ANALYZE anp;

DROP TABLE IF EXISTS astat;
CREATE TABLE astat AS SELECT norm, count(*) AS n FROM anp GROUP BY norm;
CREATE UNIQUE INDEX ON astat (norm);
ANALYZE astat;

-- ---------------------------------------------------------------------------
-- 6. Approach A: user text -> parcel.siteaddress -> parcel
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS ra;
CREATE TABLE ra AS
SELECT ap_uid, variant, count(*) AS n_cand,
       count(*) FILTER (WHERE at_point) AS n_at, false AS large
FROM (
    SELECT s.ap_uid, s.variant,
           ST_DWithin(p.geom_m, a.geom_m, 5) AS at_point
    FROM sprobe2 s
    JOIN pstat st ON st.norm = s.norm AND st.n <= 20
    JOIN parcel p ON p.norm_addr = s.norm
    JOIN addrpoint a ON a.ap_uid = s.ap_uid
) q GROUP BY ap_uid, variant
UNION ALL
SELECT s.ap_uid, s.variant, st.n, 0, true
FROM sprobe2 s JOIN pstat st ON st.norm = s.norm AND st.n > 20;
CREATE INDEX ON ra (ap_uid, variant);
ANALYZE ra;

-- ---------------------------------------------------------------------------
-- 7. Approach B: user text -> address point -> that point's parcel
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS rb;
CREATE TABLE rb AS
SELECT ap_uid, variant, count(*) AS n_cand,
       count(*) FILTER (WHERE at_point) AS n_at, false AS large
FROM (
    SELECT s.ap_uid, s.variant,
           ST_DWithin(p.geom_m, a.geom_m, 5) AS at_point
    FROM sprobe2 s
    JOIN astat st ON st.norm = s.norm AND st.n <= 20
    JOIN anp ON anp.norm = s.norm
    JOIN parcel p ON p.parcelid = anp.parcelid
    JOIN addrpoint a ON a.ap_uid = s.ap_uid
) q GROUP BY ap_uid, variant
UNION ALL
SELECT s.ap_uid, s.variant, st.n, 0, true
FROM sprobe2 s JOIN astat st ON st.norm = s.norm AND st.n > 20;
CREATE INDEX ON rb (ap_uid, variant);
ANALYZE rb;

-- ---------------------------------------------------------------------------
-- 8. Scoreboard
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS scoreboard;
CREATE TABLE scoreboard AS
SELECT 'A_parcel_text' AS approach, s.variant, c.outcome, count(*) AS n
FROM sprobe2 s
LEFT JOIN ra r ON r.ap_uid = s.ap_uid AND r.variant = s.variant
CROSS JOIN LATERAL (SELECT CASE
    WHEN r.ap_uid IS NULL OR coalesce(r.n_cand,0)=0 THEN 'NO_MATCH'
    WHEN r.large                                    THEN 'AMBIG_LARGE'
    WHEN r.n_cand=1 AND r.n_at=1                    THEN 'UNIQUE_CORRECT'
    WHEN r.n_cand=1                                 THEN 'UNIQUE_WRONG'
    WHEN r.n_at>0                                   THEN 'AMBIG_INCLUDES'
    ELSE 'AMBIG_EXCLUDES' END AS outcome) c
GROUP BY 1,2,3
UNION ALL
SELECT 'B_addrpoint_spatial', s.variant, c.outcome, count(*)
FROM sprobe2 s
LEFT JOIN rb r ON r.ap_uid = s.ap_uid AND r.variant = s.variant
CROSS JOIN LATERAL (SELECT CASE
    WHEN r.ap_uid IS NULL OR coalesce(r.n_cand,0)=0 THEN 'NO_MATCH'
    WHEN r.large                                    THEN 'AMBIG_LARGE'
    WHEN r.n_cand=1 AND r.n_at=1                    THEN 'UNIQUE_CORRECT'
    WHEN r.n_cand=1                                 THEN 'UNIQUE_WRONG'
    WHEN r.n_at>0                                   THEN 'AMBIG_INCLUDES'
    ELSE 'AMBIG_EXCLUDES' END AS outcome) c
GROUP BY 1,2,3;
