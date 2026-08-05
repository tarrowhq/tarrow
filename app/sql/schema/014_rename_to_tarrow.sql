-- Renames the database objects that carried the old placeholder project name.
--
-- The project was called `somap` while it was unnamed. That string reads as
-- "SO" + "map" -- sex offender map -- which is the single worst thing for a
-- housing tool to broadcast about the people using it, in a container name, a
-- connection string, or anything else an onlooker can read. TASK-0018 removes
-- it everywhere; this file is that removal for objects that live inside an
-- already-created database, where editing 010-013 in place cannot reach.
--
-- Migrations are applied exactly once and tracked (server/migrate.ts), so
-- 010_grants.sql, 012_address_normalization.sql and 013_measurement_uncertainty.sql
-- were edited in place to name their objects `tarrow_*` for databases created
-- from now on. A database created BEFORE this rename already ran those files
-- under the old names and will never re-run them. This migration is the bridge:
--
--   * on a pre-rename database, the old objects exist and are renamed here;
--   * on a fresh database, 010-013 already created the new names, every guard
--     below is false, and this file does nothing.
--
-- Every statement is therefore guarded on the OLD name existing, not on the new
-- name being absent -- the same migration has to be correct in both directions,
-- and "the old name is here" is the condition that actually distinguishes them.
--
-- NOT handled here, because it cannot be: the database name itself and the
-- superuser role come from POSTGRES_DB and POSTGRES_USER, which Postgres reads
-- only when it initialises an empty data directory. An existing volume keeps
-- the old database name until it is recreated. That is a documented operator
-- step (docs/deploy/self-hosting.md), not something a migration can do from
-- inside the database it is connected to.

-- The runtime application role. Renaming a role can clear an MD5-hashed
-- password, so the password is set explicitly afterwards rather than assumed to
-- survive -- compose supplies `tarrow_app`, and a silently cleared password
-- would fail at connect time, far from this file.
--
-- PGAPPPASSWORD is what the deploy composition rotates this role to on every
-- migration run; it is absent in development, where the fixed local value is
-- the convention 010_grants.sql already documents.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'somap_app') THEN
        ALTER ROLE somap_app RENAME TO tarrow_app;
        ALTER ROLE tarrow_app PASSWORD 'tarrow_app';
    END IF;
END
$$;

-- The authored functions. to_regprocedure() resolves a signature to an OID or
-- NULL, which is the existence test that matches how these are actually called;
-- checking pg_proc.proname alone would not distinguish the overloads.
DO $$
BEGIN
    IF to_regprocedure('somap_normalize_address(text)') IS NOT NULL THEN
        ALTER FUNCTION somap_normalize_address(text)
            RENAME TO tarrow_normalize_address;
    END IF;

    IF to_regprocedure('somap_unverified_state_buffer_m()') IS NOT NULL THEN
        ALTER FUNCTION somap_unverified_state_buffer_m()
            RENAME TO tarrow_unverified_state_buffer_m;
    END IF;

    IF to_regprocedure('somap_residence_uncertainty_m(text)') IS NOT NULL THEN
        ALTER FUNCTION somap_residence_uncertainty_m(text)
            RENAME TO tarrow_residence_uncertainty_m;
    END IF;

    IF to_regprocedure('somap_premises_uncertainty_m(text, text)') IS NOT NULL THEN
        ALTER FUNCTION somap_premises_uncertainty_m(text, text)
            RENAME TO tarrow_premises_uncertainty_m;
    END IF;
END
$$;
