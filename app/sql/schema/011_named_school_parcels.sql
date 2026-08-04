-- A fourth school source, and the reason it exists.
--
-- Spot-checking the first load found that St. Vincent-St. Mary High School --
-- one of Akron's largest chartered nonpublic schools -- is absent from the
-- federal Private School Universe Survey this release draws nonpublic schools
-- from. A survey nonresponse produced a missing school, which Constitution
-- Principle I classifies as the unrecoverable error. It is recorded in
-- coverage_gaps by name.
--
-- The response is a source that does not depend on anyone answering a survey:
-- tax-exempt parcels whose OWNER OF RECORD reads like a school. County
-- ownership data, surveyed geometry, no geocoding step. It recovers Western
-- Reserve Academy, Cuyahoga Valley Christian Academy, Lawrence School, and
-- others that the federal file did not carry.
--
-- It is a name heuristic, and this migration exists so the schema says so
-- where a reader of the table will find it rather than only in the ETL.

ALTER TABLE school_premises DROP CONSTRAINT IF EXISTS school_premises_school_type_check;

COMMENT ON COLUMN school_premises.school_type IS
    'public | nonpublic | unclassified. ''unclassified'' is honest rather '
    'than tidy: a parcel found by its owner''s name tells us a school is '
    'there, not whether it is a district, community, or nonpublic school.';

COMMENT ON COLUMN school_premises.match_basis IS
    'Quality of this row''s measurement geometry, rendered by the coverage '
    'manifest: board_of_education_parcel (county tax roll, use code 650) | '
    'named_exempt_parcel (exempt parcel whose owner reads like a school) | '
    'point_in_parcel | point_near_parcel (within 5 m, coordinate noise, NOT '
    'an assumed radius) | none. ''none'' means NULL geom and a matching '
    'coverage_gaps row -- never an assumed radius (DECISION §3).';
