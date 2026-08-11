-- Adds coverage_gaps.label to a database that applied 005 before the column
-- existed.
--
-- WHY THIS FILE EXISTS INSTEAD OF THE EDIT THAT WAS MADE TO 005
--
-- 005_coverage_gaps.sql was written without `label` (ec12cea), and TASK-0022
-- added the column by EDITING THAT FILE IN PLACE (c787526). server/migrate.ts
-- records applied migrations by FILENAME, so every database that had already
-- applied 005 -- which is every long-lived deployment -- printed
-- `skip 005_coverage_gaps.sql (already applied)` on every run afterwards and
-- never got the column.
--
-- The result was invisible everywhere it was tested and total where it was
-- not. CI builds a fresh database on every run, so 005 applied whole and the
-- column was there; the suite passed. On demo.tarrow.org, `manifest.sql`
-- selected a column that did not exist, the coverage manifest could not be
-- built, and the gate in server/manifest.ts refused EVERY search rather than
-- answer without disclosing coverage. Every address returned "tarrow broke
-- before it could check anything" -- with HTTP 200, so no health check noticed.
--
-- The gate behaved correctly and is not touched here. Refusing to answer was
-- the right response to not being able to state what had been checked; that is
-- Principle II working, and it is the reason this was a loud failure rather
-- than a quiet one that answered from an incomplete manifest.
--
-- IDEMPOTENT ON PURPOSE. It runs against three kinds of database:
--   * a drifted one   -- applied 005 pre-edit, has no label. Gets the column.
--   * a fresh one     -- applied the current 005, already has label. No-op.
--   * one that already ran this file. No-op.
-- `IF NOT EXISTS` covers all three without branching on which it is.

ALTER TABLE coverage_gaps ADD COLUMN IF NOT EXISTS label text;

-- Backfilled from `description` rather than left NULL, and the choice is
-- deliberate. A NULL label renders as an empty phrase on the answer surface --
-- a gap that announces itself as blank, which is worse than one stated badly:
-- the reader cannot tell whether something was not checked or whether the page
-- is broken. `description` is the same fact written for the wrong audience,
-- which is a bad label but a true one, and it is what the column held before
-- the two were split.
--
-- Only where NULL, so a database that already carries authored labels keeps
-- them.
UPDATE coverage_gaps SET label = description WHERE label IS NULL;

-- NOT NULL only after the backfill, so the constraint can never fail on a
-- table with existing rows. This matches the shape 005 declares for a fresh
-- database, which is the point: after this file, a drifted database and a
-- fresh one have the same schema.
ALTER TABLE coverage_gaps ALTER COLUMN label SET NOT NULL;

COMMENT ON COLUMN coverage_gaps.label IS
    'Two or three words, for the person looking up an address. Rendered on '
    'the answer surface, where the reader is frightened and under time '
    'pressure and will read a phrase but not a paragraph. Not a summary of '
    'description -- the same fact, stated for somebody who has to act on it.';
