-- Constitution Principle IV's enforcement point: the runtime application
-- role can read derived tables and nothing else. This is a GRANT/REVOKE
-- pair, verified by actually connecting as this role and watching an
-- INSERT get rejected (see tasks.md Phase 1's write-rejection proof) --
-- never a comment asserting the app just doesn't write here.
--
-- Credential is a fixed local-dev value, matching the existing convention
-- in docker-compose.yml (the 'tarrow' superuser is also plaintext 'tarrow'
-- there). Plan.md R3 rules out public deployment for this task, so secret
-- management for a real deployment is explicitly out of scope here.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tarrow_app') THEN
        CREATE ROLE tarrow_app LOGIN PASSWORD 'tarrow_app';
    END IF;
END
$$;

GRANT CONNECT ON DATABASE tarrow TO tarrow_app;
GRANT USAGE ON SCHEMA public TO tarrow_app;

-- Tables that already exist...
GRANT SELECT ON ALL TABLES IN SCHEMA public TO tarrow_app;
-- ...and any a later migration creates.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO tarrow_app;

-- The explicit REVOKE is the gate itself, not documentation of intent:
-- GRANT SELECT above does not imply write access, but stating the revoke
-- makes the absence of write privilege verifiable by reading this one
-- file, rather than by trusting that no GRANT for it exists anywhere else
-- in the schema.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM tarrow_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM tarrow_app;
