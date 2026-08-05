-- Measurement uncertainty as arithmetic, and the buffer it is compared against.
--
-- DECISION §3, "Uncertainty is arithmetic":
--
--     d_min = d(a, b) - r_a - r_b        flag when d_min < buffer
--
-- Principle I as a formula rather than a judgement call. Both radii are
-- SUBTRACTED, which shrinks the measured distance and therefore makes the flag
-- MORE likely. That is the safe direction and it is the whole point: an
-- addition here would be the unrecoverable failure this phase exists to avoid.
--
-- These three functions exist so that each safety-critical constant is written
-- down EXACTLY ONCE. sql/query/proximity.sql performs the arithmetic and
-- sql/query/manifest.sql renders it; neither restates a number. A radius that
-- appeared in two files could drift between them, and a buffer that appeared in
-- two files could disagree with itself -- the class of defect that produces a
-- confident wrong answer rather than a loud one.
--
-- Placed in a migration for the same reason as the normalizer (012): the
-- runtime role has no CREATE privilege (010_grants.sql), and authored content
-- compiled into the database by a build step is the shape Principle IV sets.

-- ---------------------------------------------------------------------------
-- The buffer
-- ---------------------------------------------------------------------------
--
-- ORC 2950.034 bars residence within 1,000 feet of school premises. 1,000 ft =
-- 304.8 m exactly, and all spatial work is in EPSG:6549 (metres) per
-- DECISION §2.
--
-- The name says `unverified` and it is not decoration. Constitution Principle V
-- requires every rule to carry, AS DATA, its citation, a resolvable source URL,
-- an effective date, the date a human last verified it, and who verified it.
-- No such record exists yet -- TASK-0003 builds the file-authored rule pipeline
-- that creates one. Until it does, this release applies the buffer WITHOUT the
-- receipts Principle V demands, and the coverage manifest says so on every
-- answer (see the `rule_content` row in the coverage-gap ledger).
--
-- Renaming this function to drop the word `unverified` is a change that must
-- not happen before TASK-0003 lands: the name is a load-bearing disclosure, not
-- a style choice.
CREATE FUNCTION somap_unverified_state_buffer_m()
RETURNS double precision
LANGUAGE sql
IMMUTABLE PARALLEL SAFE
AS $$ SELECT 304.8::double precision $$;

COMMENT ON FUNCTION somap_unverified_state_buffer_m() IS
    'ORC 2950.034''s 1,000-foot buffer as 304.8 m. NOT verified rule data: no '
    'file-authored, human-verified rule record backs it yet (TASK-0003). The '
    'coverage manifest discloses this on every result.';

-- ---------------------------------------------------------------------------
-- Residence-side uncertainty
-- ---------------------------------------------------------------------------
--
-- DECISION §3, residence side: a point lies inside its parcel, so measuring
-- from a bare point OVERSTATES the distance, which under-restricts -- the
-- unrecoverable error. somap therefore never measures a residence from a point
-- at all: if the resolved address point has no parcel within 5 m, it DECLINES
-- (sql/query/resolve_address.sql). What remains is only how the parcel was
-- attributed to the point.
--
--   'point_in_parcel'    the address point falls INSIDE the parcel polygon.
--                        The residence parcel is established by containment
--                        and the measurement is boundary-to-boundary, exact.
--                        r_a = 0.
--
--   'point_near_parcel'  the address point falls inside no parcel but within
--                        5 m of one. Attribution is inferred from proximity
--                        between two independently digitised county layers, so
--                        the true residence boundary may lie up to that
--                        tolerance nearer a premises than the polygon we
--                        measured from. r_a = 5.
--
-- Any other basis is a defect, not a case to interpolate: NULL propagates
-- through the subtraction and the row disappears from the result rather than
-- being measured on a guessed radius.
CREATE FUNCTION somap_residence_uncertainty_m(match_basis text)
RETURNS double precision
LANGUAGE sql
IMMUTABLE PARALLEL SAFE
AS $$
    SELECT CASE match_basis
               WHEN 'point_in_parcel'   THEN 0.0::double precision
               WHEN 'point_near_parcel' THEN 5.0::double precision
           END
$$;

COMMENT ON FUNCTION somap_residence_uncertainty_m(text) IS
    'r_a for d_min = d - r_a - r_b. 0 m when the address point is inside its '
    'parcel, 5 m when the parcel was attributed by proximity. Returns NULL for '
    'any unknown basis so the row cannot be measured at all.';

-- ---------------------------------------------------------------------------
-- Premises-side uncertainty
-- ---------------------------------------------------------------------------
--
-- DECISION §3, premises side: "a missing or undersized premises silently
-- shrinks a buffer and produces a false 'outside every buffer'. Here
-- over-restriction is the safe direction." Every value below is therefore the
-- larger of the readings available.
--
--   'board_of_education_parcel'  county tax roll, use code 650. Surveyed
--   'named_exempt_parcel'        county tax roll, exempt + school-named owner.
--   'point_in_parcel'            source point inside the parcel it took.
--                                All three establish the premises as a real
--                                surveyed county parcel, measured
--                                boundary-to-boundary. r_b = 0.
--
--   'point_near_parcel'          the school point fell inside no parcel but
--                                within 5 m of one. Same coordinate-noise
--                                tolerance, same reasoning, as the residence
--                                side. r_b = 5.
--
--   'none'                       NULL. A school with no parcel geometry is a
--                                DECLARED COVERAGE GAP and is never measured
--                                (DECISION §3: at a p95 campus extent of
--                                1,575 m against a 304.8 m buffer, an honest
--                                radius flags most of a city and a convenient
--                                one under-restricts). NULL here means the
--                                arithmetic cannot produce a distance for such
--                                a row even if a future query forgot to
--                                exclude it -- the manifest reports it as NOT
--                                CHECKED instead.
--
-- Corroboration adds to the radius; it never subtracts.
--
--   'uncorroborated'  the school's point matched a parcel that is NOT
--                     tax-exempt. A school premises essentially always is, so
--                     the match is probably a mailing-address geocode landing
--                     on a neighbouring property, and the boundary somap holds
--                     probably UNDERSTATES the real premises -- the
--                     under-restricting direction, which Principle I forbids
--                     leaving unhandled. 126 m is added: DECISION §3's own
--                     measured p95 extent for a typical suburban lot, and the
--                     same figure it adopts as the assumed premises radius for
--                     a residential-lot facility. It is the displacement one
--                     mis-geocoded parcel can account for.
--
--                     This is NOT an assumed radius for a school known only by
--                     a point -- DECISION §3 forbids those at any value, and
--                     the 'none' branch above is how that prohibition is
--                     enforced. It is an uncertainty term on a premises whose
--                     geometry we hold but whose ATTRIBUTION the county's own
--                     tax status contradicts.
CREATE FUNCTION somap_premises_uncertainty_m(
    match_basis text,
    match_corroboration text
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE PARALLEL SAFE
AS $$
    SELECT CASE match_basis
               WHEN 'board_of_education_parcel' THEN 0.0::double precision
               WHEN 'named_exempt_parcel'       THEN 0.0::double precision
               WHEN 'point_in_parcel'           THEN 0.0::double precision
               WHEN 'point_near_parcel'         THEN 5.0::double precision
               ELSE NULL::double precision
           END
         + CASE WHEN match_corroboration IS DISTINCT FROM 'uncorroborated'
                THEN 0.0::double precision
                ELSE 126.0::double precision
           END
$$;

COMMENT ON FUNCTION somap_premises_uncertainty_m(text, text) IS
    'r_b for d_min = d - r_a - r_b. 0 m for a surveyed county parcel, +5 m '
    'when the parcel was attributed by proximity, +126 m when the county''s '
    'tax status contradicts the match (probable geocoding error that would '
    'UNDERSTATE the premises). NULL for a premises with no geometry, which is '
    'a declared coverage gap and is never measured.';
