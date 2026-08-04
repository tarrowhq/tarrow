-- Registry of every data layer the pipeline knows about: what it is, where
-- it comes from, and when it was last refreshed. Every ETL phase writes its
-- own row here so the coverage manifest (Constitution Principle II) can
-- state exactly which layers were queried and when each was last refreshed
-- -- absence of a row IS the disclosure, never something the user has to
-- infer from silence.

CREATE TABLE layers (
    id            text PRIMARY KEY,   -- stable slug, e.g. 'summit_county_address_points'
    description   text NOT NULL,
    source_url    text NOT NULL,      -- resolvable provenance (Principle V)
    jurisdiction  text NOT NULL,      -- e.g. 'Summit County, OH'
    fetched_at    timestamptz,        -- last successful ETL run
    verified_at   timestamptz,        -- last human verification, if any
    row_count     integer,
    notes         text
);

COMMENT ON TABLE layers IS
    'One row per data layer. The coverage manifest reads this table to '
    'state which layers were queried and when each was last refreshed, '
    'per Constitution Principle II.';
