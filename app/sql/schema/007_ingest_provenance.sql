-- Phase 2 (TASK-0002.02) additions to the Phase 1 baseline. Additive only --
-- 001-005 and 010 have already been applied and are never edited.
--
-- Two things this ingest needs that the baseline did not anticipate:
--
--   1. parcels.owner_name. Summit County's tax use code 650 identifies
--      parcels owned by a board of education. That is a *county-authoritative
--      enumeration of public school premises with real parcel geometry* --
--      strictly better evidence than a geocoded point -- and it is also the
--      only source that reaches ORC 2925.01(S)(b), which extends "school
--      premises" beyond the school building to any other parcel owned or
--      leased by the board on which school functions occur. Naming those
--      premises requires the owner string.
--
--   2. Per-row provenance and match basis on school_premises. Constitution
--      Principle V wants every record to say where it came from; Principle I
--      wants a reader to be able to tell a premises whose extent is a real
--      surveyed parcel from one attached to a mailing-address geocode.

ALTER TABLE parcels ADD COLUMN owner_name text;

COMMENT ON COLUMN parcels.owner_name IS
    'Source ownernme1. Carried because tax use code 650 (board of '
    'education) plus this string is how public school premises are '
    'enumerated -- see 007_ingest_provenance.sql and etl/sources.ts.';

-- Stable identifier of the record in ITS source (NCESSCH, PPIN, or the
-- county parcelid), so a premises row can be traced back to the row that
-- produced it.
ALTER TABLE school_premises ADD COLUMN source_ref text NOT NULL;

ALTER TABLE school_premises ADD COLUMN street text;
ALTER TABLE school_premises ADD COLUMN city text;
ALTER TABLE school_premises ADD COLUMN zip text;

-- How this row's measurement geometry was established. This is rendered by
-- the coverage manifest (Phase 3) as the per-geometry measurement basis
-- DECISION §3 requires, and it is deliberately NOT a boolean: "we found a
-- parcel" and "we found the parcel the county says the school board owns"
-- are different qualities of evidence and the user is entitled to both.
--
--   'board_of_education_parcel'  county tax parcel, use code 650. Surveyed
--                                geometry, county-authoritative ownership.
--   'point_in_parcel'            source point falls inside this parcel.
--   'point_near_parcel'          source point within 5 m of exactly one
--                                parcel (the same coordinate-noise tolerance
--                                DECISION §3/§4 validated for address
--                                points). Not an assumed radius.
--   'none'                       no parcel geometry. geom IS NULL, and a
--                                coverage_gaps row explains it. NEVER an
--                                assumed radius -- DECISION §3 forbids one
--                                for a school at any value.
ALTER TABLE school_premises ADD COLUMN match_basis text NOT NULL DEFAULT 'none';

-- Whether the matched parcel corroborates being a school premises at all.
-- Schools are tax-exempt, so a school point that lands on a non-exempt
-- parcel (a house, a strip mall) is probably a geocoding error, and the
-- attached geometry probably UNDERSTATES the real campus -- the
-- under-restricting direction. Recorded per row and declared in the gap
-- ledger rather than silently trusted.
--
--   'tax_exempt_parcel' | 'uncorroborated' | NULL (no parcel at all)
ALTER TABLE school_premises ADD COLUMN match_corroboration text;

-- A source row produces exactly one premises row. Enforced, not assumed:
-- collapsing two schools into one row is precisely the silent data loss
-- Principle I classifies as unrecoverable.
CREATE UNIQUE INDEX school_premises_source_idx
    ON school_premises (layer_id, source_ref);

COMMENT ON COLUMN school_premises.match_basis IS
    'Quality of this row''s measurement geometry, rendered by the coverage '
    'manifest. ''none'' means NULL geom and a matching coverage_gaps row -- '
    'never an assumed radius (DECISION §3).';
