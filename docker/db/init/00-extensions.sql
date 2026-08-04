-- Runs once, at cluster initialization, as the superuser.
--
-- Doing this here rather than from application code means the runtime role
-- never needs CREATE EXTENSION, and the database is fully formed the moment
-- the healthcheck passes.

CREATE EXTENSION IF NOT EXISTS postgis;

-- Levenshtein / soundex, for measuring how much of the address match rate a
-- fuzzy fallback would recover. Whether somap actually ships fuzzy matching is
-- an open question -- a near-miss match is a WRONG PARCEL, which under
-- Principle I is worse than no match at all. This extension is here so the
-- spike can measure the tradeoff rather than guess at it.
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
