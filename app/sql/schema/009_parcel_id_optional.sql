-- Also found by running the ingest: exactly one of Summit County's 261,160
-- published parcels carries no parcelid at all -- no use code, no owner, a
-- blank site address -- but a real polygon.
--
-- 003 declared parcel_id NOT NULL, which would force that row to be dropped.
-- Dropping it is the wrong direction. parcel_id is a label; the polygon is
-- measurement geometry, and a parcel missing from the geometry layer is a
-- parcel an address cannot resolve against and a premises cannot be measured
-- to. Constitution Principle I puts completeness of the geometry above
-- tidiness of the identifier.
--
-- The identifier stays non-unique as well (condominium and split records
-- repeat a parcelid), which is why the primary key is a surrogate. Nothing in
-- tarrow keys on parcel_id.

ALTER TABLE parcels ALTER COLUMN parcel_id DROP NOT NULL;

COMMENT ON COLUMN parcels.parcel_id IS
    'County parcelid. A label, not a key: repeated across condominium and '
    'split records, and absent on one published parcel. Keyed on nowhere.';
