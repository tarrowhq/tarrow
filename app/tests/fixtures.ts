// Fixtures, and where each one came from.
//
// Every address below was found by querying the loaded Summit County data, not
// invented. The query that produced each is recorded beside it so a reader can
// re-derive it rather than trust it -- and so that if a future county refresh
// moves one, the way to find its replacement is written down.
//
// These are real published addresses in a public county dataset. They are
// fixtures, not user data: nothing about a real person is implied by any of
// them, and nothing here is ever recorded at runtime (Principle III).

/**
 * A residence whose parcel is ~128 m from a school premises parcel -- well
 * inside the 304.8 m buffer, and far enough from zero to prove a real distance
 * was measured rather than an overlap detected.
 *
 *   SELECT ap.full_address, ST_Distance(p.geom, sp.geom)
 *     FROM school_premises sp
 *     JOIN parcels p ON NOT p.is_mineral_rights AND ST_DWithin(p.geom, sp.geom, 300)
 *     JOIN address_points ap ON ST_Contains(p.geom, ap.geom)
 *    WHERE sp.name ILIKE '%FIRESTONE%'
 *      AND ST_Distance(p.geom, sp.geom) BETWEEN 120 AND 250;
 */
export const NEAR_A_SCHOOL = {
  typed: "1464 Garman Rd, Akron, OH 44313",
  expectPremisesNameContains: "Firestone",
  expectDistanceBetween: [100, 200] as const,
};

/**
 * A residence with no school premises within 1,500 m -- comfortably outside
 * the buffer even after the widest uncertainty radius any premises carries.
 *
 *   SELECT ap.full_address FROM address_points ap
 *     JOIN parcels p ON NOT p.is_mineral_rights AND ST_Contains(p.geom, ap.geom)
 *    WHERE NOT EXISTS (SELECT 1 FROM school_premises sp
 *                       WHERE sp.geom IS NOT NULL AND ST_DWithin(p.geom, sp.geom, 1500));
 */
export const FAR_FROM_EVERY_SCHOOL = {
  typed: "1361 Milan Ave, Copley, OH",
};

/**
 * A published address point that sits on no parcel and within 5 m of none.
 * DECISION §3's decline case -- 5,579 of 258,859 normalized points (2.16%).
 *
 *   SELECT ap.full_address FROM address_points ap
 *    WHERE NOT EXISTS (SELECT 1 FROM parcels p
 *                       WHERE NOT p.is_mineral_rights AND ST_DWithin(p.geom, ap.geom, 5));
 */
export const RESOLVES_BUT_HAS_NO_PARCEL = {
  typed: "4311 Eastern Rd, Norton, OH",
};

/**
 * THE SIGN FIXTURE, and the most important one in this file.
 *
 * "SUPER LEARNING CENTER S FAITH CHRISTIAN ACADEMY" (premises 166) is
 * `point_in_parcel` / `uncorroborated`: its geocoded point landed on a parcel
 * the county does not record as tax-exempt, so the boundary tarrow holds may be
 * a neighbour's and may UNDERSTATE the real premises. It therefore carries
 * r_b = 126 m (sql/schema/013_measurement_uncertainty.sql).
 *
 * The exact parcel-to-parcel distance from this residence is ~310 m -- OUTSIDE
 * the 304.8 m buffer. The pessimistic bound d_min = d - r_a - r_b is ~184 m,
 * which is INSIDE it, so the premises is flagged.
 *
 * That is the whole of DECISION §3 in one row: subtracting the radii makes the
 * flag MORE likely. If the sign were ever inverted, this fixture stops flagging
 * and the test fails -- which is why it is a fixture and not a comment.
 *
 *   SELECT ap.full_address, sp.name, ST_Distance(p.geom, sp.geom)
 *     FROM school_premises sp
 *     JOIN parcels p ON NOT p.is_mineral_rights AND ST_DWithin(p.geom, sp.geom, 430.8)
 *     JOIN address_points ap ON ST_Contains(p.geom, ap.geom)
 *    WHERE sp.match_corroboration = 'uncorroborated'
 *      AND ST_Distance(p.geom, sp.geom) BETWEEN 310 AND 430;
 */
export const FLAGGED_ONLY_BY_UNCERTAINTY = {
  typed: "1563 Akers Ave, Lakemore, OH",
  expectPremisesNameContains: "FAITH CHRISTIAN ACADEMY",
  expectPremisesUncertaintyMeters: 126,
};

/** Nothing in the county address layer normalizes to this. */
export const NO_SUCH_ADDRESS = {
  typed: "99999 Nonexistent Boulevard, Akron, OH 44301",
};

/** Reduces to nothing at all. */
export const NORMALIZES_TO_NOTHING = {
  typed: "   ,,, --- ",
};

/** The buffer every flag is compared against, per ORC 2950.034's 1,000 feet. */
export const BUFFER_METERS = 304.8;
