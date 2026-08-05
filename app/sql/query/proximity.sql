-- School premises within the state buffer of a residence parcel.
--
--   $1  bigint[]           candidate residence parcel ids (from resolve_address.sql)
--   $2  double precision[] each candidate's residence uncertainty r_a, same order
--
-- THE MEASUREMENT (DECISION §2). Distance is from the NEAREST POINT OF THE
-- RESIDENCE PARCEL to the NEAREST POINT OF THE PREMISES PARCEL. Never centroid
-- to centroid, never point to point. ST_Distance between two polygons in a
-- projected metre CRS is exactly that.
--
-- ORC 2950.034 defines protected premises as "the parcel of real property on
-- which [the facility] is situated" and does not say how the 1,000 feet is
-- measured. Nearest-boundary distance is always <= centroid distance, so this
-- reading flags a STRICT SUPERSET of addresses: if the property-line reading is
-- legally correct we are right, and if a laxer one is permitted we were
-- over-restrictive, which Principle I classifies as recoverable. The magnitude
-- is not academic -- a 10+ acre school campus has a median extent of 578 m and
-- a p95 of 1,575 m, against a 304.8 m buffer. Point-based measurement against a
-- school is not an approximation of the legal standard; it is a different
-- calculation, wrong by more than the thing being measured.
--
-- THE PROJECTION (DECISION §2). Every geometry here is EPSG:6549, NAD83(2011)
-- Ohio North, in metres. There is NO geography cast in this file and there must
-- never be one: a ::geography cast defeats the spatial index and silently turns
-- an index scan into a sequential scan over a quarter of a million parcels.
-- tests/explain.test.ts asserts the plan contains no cast and does use the
-- index.
--
-- THE ARITHMETIC (DECISION §3). Every geometry carries an uncertainty radius
-- and the comparison is on the pessimistic bound:
--
--     d_min = d(a, b) - r_a - r_b        flag when d_min < buffer
--
-- Both radii are SUBTRACTED. Subtracting shrinks the distance, which makes the
-- flag MORE likely -- Principle I as a formula rather than a judgement call. If
-- a future edit finds itself adding a radius here, that edit is the
-- unrecoverable defect and must stop. The radii themselves are defined once, in
-- sql/schema/013_measurement_uncertainty.sql, and are never restated in this
-- file.
--
-- WHAT IS NOT MEASURED, AND IS NOT ESTIMATED EITHER. A school premises with no
-- parcel geometry is excluded here and reported by the coverage manifest as NOT
-- CHECKED. DECISION §3 forbids giving a school an assumed radius at any value:
-- at a p95 campus extent of 1,575 m no defensible number exists -- an honest
-- one flags most of a city and a convenient one under-restricts. The exclusion
-- is doubly enforced: geom IS NOT NULL below, and
-- somap_premises_uncertainty_m() returning NULL for such a row so the
-- subtraction could not produce a distance even if this WHERE clause were lost.
--
-- Returns zero rows when nothing is within the buffer. The caller renders that
-- as "outside every buffer we checked" -- never as approved, legal, permitted,
-- or clear, and never without the manifest saying what "we checked" covered.

WITH residence AS (
    SELECT c.parcel_id,
           c.r_a,
           p.geom
      FROM unnest($1::bigint[], $2::double precision[]) AS c(parcel_id, r_a)
      JOIN parcels p
        ON p.id = c.parcel_id
       -- Mineral-rights parcels are never measurement geometry (DECISION §6).
       AND NOT p.is_mineral_rights
),
-- The widest premises uncertainty any loaded row carries, read FROM THE DATA
-- rather than written down here. It is only a prefilter bound: the index search
-- must be wide enough that no row which the exact test below would flag is
-- discarded before reaching it. Deriving it means adding a premises class with
-- a larger radius automatically widens the search instead of silently dropping
-- flags -- the failure this bound exists to make impossible.
search_bound AS (
    SELECT coalesce(
               max(somap_premises_uncertainty_m(match_basis, match_corroboration)),
               0.0
           ) AS max_r_b
      FROM school_premises
     WHERE geom IS NOT NULL
)
SELECT res.parcel_id,
       sp.id                        AS premises_id,
       sp.name,
       sp.school_type,
       sp.layer_id,
       sp.match_basis,
       sp.match_corroboration,
       sp.street,
       sp.city,
       d.d_m,
       res.r_a                      AS residence_uncertainty_m,
       u.r_b                        AS premises_uncertainty_m,
       d.d_m - res.r_a - u.r_b      AS d_min_m,
       somap_unverified_state_buffer_m() AS buffer_m
  FROM residence res
  CROSS JOIN search_bound sb
  JOIN school_premises sp
    ON sp.geom IS NOT NULL
   AND ST_DWithin(
           res.geom,
           sp.geom,
           somap_unverified_state_buffer_m() + res.r_a + sb.max_r_b
       )
  CROSS JOIN LATERAL (
        SELECT somap_premises_uncertainty_m(sp.match_basis, sp.match_corroboration) AS r_b
  ) u
  CROSS JOIN LATERAL (
        SELECT ST_Distance(res.geom, sp.geom) AS d_m
  ) d
 -- The pessimistic bound. Strictly less than the buffer, matching DECISION §3.
 WHERE d.d_m - res.r_a - u.r_b < somap_unverified_state_buffer_m()
 ORDER BY res.parcel_id, d_min_m, sp.name, sp.id;
