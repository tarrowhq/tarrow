-- Resolve a typed address to the parcel or parcels distance may be measured
-- from. $1 is the raw string the user typed.
--
-- THE SHAPE, AND WHY IT IS THE ONLY SHAPE (DECISION §1, §4):
--
--     typed address -> normalize -> Address Points match -> that point's parcel
--
-- Measured over 151,904 probes: this path is 96.79% correct / 0.20% wrong.
-- Matching a typed address against parcels.site_address instead is 69.16%
-- correct / 3.34% WRONG -- a 17x higher rate of confidently measuring from
-- somebody else's house. site_address is a situs label on a tax record; an
-- address point is a unit of addressable location maintained by the office that
-- assigns addresses. This query asks each dataset only what it is authoritative
-- for, and NOTHING in this file reads parcels.site_address as a match key.
--
-- WHAT THIS QUERY CANNOT DO, STRUCTURALLY:
--
--   * It cannot fuzzy-match. There is no similarity(), no levenshtein(), no
--     soundex, no trigram operator, no LIKE against user input anywhere below.
--     DECISION §4 rejects fuzzy matching as a SAFETY decision, not a quality
--     one: 50.1% of text-matching failures are house-number disagreements
--     between county datasets (4921 vs 4932 FRIAR RD), and edit distance cannot
--     distinguish a typo from a different building. Fuzzy matching converts a
--     safe no-match into a confident wrong match on exactly those.
--
--   * It cannot return a coarse fallback. There is no ZIP centroid, no street
--     centroid, no city centroid, no "nearest parcel anyway". The parcel search
--     is bounded by ST_DWithin(..., 5) with no ORDER BY ... LIMIT 1 escape
--     outside that bound, so a point with no parcel within 5 m produces a NULL
--     parcel and the caller DECLINES. There is no code path to accidentally
--     take, which DECISION §4 requires to be structural rather than policy.
--
--   * It cannot silently pick between candidates. Every matching address point
--     is returned, one row each. Resolving several candidates to one answer is
--     the caller's job and it resolves to the MOST RESTRICTIVE candidate,
--     declaring the ambiguity (DECISION §4: one normalized address maps to as
--     many as 505 parcels; 2200 HIGH ST appears 218 times).
--
-- ALWAYS returns at least one row. When nothing matched, that row carries a
-- NULL address_point_id -- so "we looked and found nothing" is a value the
-- caller receives, never an empty result set it has to interpret. The caller
-- renders it as an explicit could-not-locate.

WITH input AS (
    -- The same function that produced address_points.normalized at ingest
    -- (sql/schema/012_address_normalization.sql). One normalizer, applied to
    -- both sides, so a match is a comparison of two canonical forms.
    SELECT tarrow_normalize_address($1::text) AS normalized
)
SELECT i.normalized                            AS normalized_input,
       pt.address_point_id,
       pt.full_address,
       pt.city,
       pt.zip,
       m.parcel_id,
       m.site_address,
       m.municipality,
       m.municipality_id,
       -- NULL match_basis is the decline signal, and it is the ONLY thing a
       -- point with no parcel within 5 m can produce.
       m.match_basis,
       m.gap_m,
       tarrow_residence_uncertainty_m(m.match_basis) AS residence_uncertainty_m
  FROM input i
  LEFT JOIN LATERAL (
        SELECT ap.id AS address_point_id,
               ap.full_address,
               ap.city,
               ap.zip,
               ap.geom
          FROM address_points ap
         WHERE i.normalized IS NOT NULL
           AND ap.normalized = i.normalized
  ) pt ON true
  LEFT JOIN LATERAL (
        SELECT p.id            AS parcel_id,
               p.site_address,
               p.municipality,
               p.municipality_id,
               CASE WHEN ST_Contains(p.geom, pt.geom) THEN 'point_in_parcel'
                    ELSE 'point_near_parcel' END AS match_basis,
               ST_Distance(p.geom, pt.geom) AS gap_m
          FROM parcels p
         -- Mineral-rights parcels are 200-series use codes: overlapping
         -- subsurface polygons, never measurement geometry (DECISION §6).
         -- Spelled as NOT is_mineral_rights so the partial GiST index
         -- parcels_measurable_geom_idx is the one the planner uses.
         WHERE NOT p.is_mineral_rights
           -- The hard bound. 5 m is the coordinate-noise tolerance between two
           -- independently digitised county layers, and it is NOT an assumed
           -- parcel radius: it decides WHICH surveyed polygon a point belongs
           -- to and never enlarges that polygon by a metre. Widening it would
           -- start attributing residences to parcels they are not on.
           AND ST_DWithin(p.geom, pt.geom, 5)
         -- Deterministic, and over-restrictive where it must choose:
         -- containment beats proximity, then the LARGER parcel (a bigger
         -- residence parcel reaches closer to any premises, so it flags more
         -- -- the recoverable direction), then the county's own identifier and
         -- the surrogate key so two reloads cannot disagree.
         ORDER BY ST_Contains(p.geom, pt.geom) DESC,
                  ST_Area(p.geom) DESC,
                  p.parcel_id NULLS LAST,
                  p.id
         LIMIT 1
  ) m ON true
 ORDER BY m.parcel_id NULLS FIRST, pt.address_point_id;
