-- Correction to 006, found by running it: a jurisdiction NAME is not unique
-- in Summit County. TWINSBURG is both a city and a township, and Ohio's
-- township/municipality structure makes that the normal case rather than a
-- quirk -- a township keeps its name after part of it incorporates.
--
-- 006 has already been applied, so it is not edited (a migration that has run
-- somewhere is history, not source). This file supersedes its constraint.
--
-- Two consequences, both handled here rather than left for TASK-0007 to
-- rediscover:
--
--   1. Identity is (name, kind), not name.
--   2. parcels.municipality -- a bare name -- therefore cannot identify a
--      jurisdiction on its own. A parcel now carries the municipality's id as
--      well, so the municipal ordinance layer joins on identity instead of on
--      a string that two jurisdictions share. The name column stays, because
--      it is what a result renders.

DROP INDEX municipalities_name_idx;

CREATE UNIQUE INDEX municipalities_name_kind_idx ON municipalities (name, kind);

ALTER TABLE parcels ADD COLUMN municipality_id bigint REFERENCES municipalities (id);

CREATE INDEX parcels_municipality_id_idx ON parcels (municipality_id);

COMMENT ON COLUMN parcels.municipality IS
    'Jurisdiction name for display. NOT an identifier -- a city and a '
    'township can share a name (TWINSBURG). Join on municipality_id.';
