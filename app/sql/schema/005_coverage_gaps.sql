-- The declared-gap ledger Principle II requires: every known absence
-- recorded as data, in the shape the coverage manifest renders, rather
-- than left for a user to discover as silence. A school with no parcel
-- geometry (004_school_premises.sql), a facility class not yet ingested, a
-- municipality with sparse address-point coverage -- all land here.
--
-- THE `label` COLUMN IS ADDED BY 015_coverage_gaps_label.sql, NOT HERE, and
-- this file has been restored to what it actually applied.
--
-- TASK-0022 added `label` by editing this file in place. Migrations are keyed
-- by filename, so every database that had already applied 005 skipped it
-- forever and never got the column, while every fresh database -- including
-- every CI run -- got it whole. The edit therefore looked correct in every
-- check this repository runs and was missing on the one deployment serving
-- the public, where it took down every search for three days (TASK-0027).
--
-- This file now describes the schema a database that ran it actually has. If
-- you need to change this table, add a migration; do not edit this.

CREATE TABLE coverage_gaps (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    layer_id       text REFERENCES layers (id),
    subject_type   text NOT NULL,  -- e.g. 'school_premises', 'facility_class', 'municipality'
    subject_ref    text,           -- free-form identifier of the specific gap
    -- TWO AUDIENCES, TWO COLUMNS.
    --
    -- `label` is what a person looking up an address reads: two or three
    -- words naming the thing that was not checked. "Preschools and day-care".
    -- "City and village rules". It goes on the answer surface, where the
    -- reader is frightened and under time pressure and will read a phrase but
    -- not a paragraph.
    --
    -- `description` is the full record: why the gap exists, what it means for
    -- an answer, what a self-hoster should know. It is read by /faq and by
    -- anyone auditing the instance.
    --
    -- They were one column, and the one column was written for the second
    -- audience. The result was a paragraph of internal reasoning rendered to
    -- somebody who wanted to know whether they could live somewhere. A short
    -- label is not a summary of the long text -- it is the same fact stated
    -- for the person who has to act on it.
    label          text NOT NULL,
    description    text NOT NULL,
    discovered_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE coverage_gaps IS
    'Every known absence, recorded as data. The coverage manifest (Phase '
    '3) renders this table directly -- Constitution Principle II forbids '
    'coverage being inferred from silence.';

COMMENT ON COLUMN coverage_gaps.label IS
    'Two or three words, for the person looking up an address. Rendered on '
    'the answer surface. Never a sentence.';

COMMENT ON COLUMN coverage_gaps.description IS
    'The full record, for /faq and for anyone auditing this instance. Never '
    'rendered on the answer surface.';
