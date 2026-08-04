-- The declared-gap ledger Principle II requires: every known absence
-- recorded as data, in the shape the coverage manifest renders, rather
-- than left for a user to discover as silence. A school with no parcel
-- geometry (004_school_premises.sql), a facility class not yet ingested, a
-- municipality with sparse address-point coverage -- all land here.

CREATE TABLE coverage_gaps (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layer_id       text REFERENCES layers (id),
    subject_type   text NOT NULL,  -- e.g. 'school_premises', 'facility_class', 'municipality'
    subject_ref    text,           -- free-form identifier of the specific gap
    description    text NOT NULL,  -- manifest-ready: what's missing, and why
    discovered_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE coverage_gaps IS
    'Every known absence, recorded as data. The coverage manifest (Phase '
    '3) renders this table directly -- Constitution Principle II forbids '
    'coverage being inferred from silence.';
