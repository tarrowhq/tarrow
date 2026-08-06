---
name: database-access
description: The application's single read-only connection pool and the startup loader that reads every spatial query from a file, so query text is never assembled in TypeScript.
kind: component
sources:
  - app/server/db.ts
  - app/sql/schema/010_grants.sql
verified_against: b5b247a6cb390ba505c674f0c77af551dd547949
---

# Database access

`app/server/db.ts` is the whole database surface of the request path. Two things live there
on purpose: a `pg` pool connecting as the read-only role, and a loader that reads every file
in `sql/query/`.

## How it works

**The pool** connects as `tarrow_app`, the role `sql/schema/010_grants.sql` grants SELECT to
and explicitly revokes INSERT, UPDATE, DELETE, and TRUNCATE from — including via
`ALTER DEFAULT PRIVILEGES`, so a table a later migration creates is covered too. Principle IV
is enforced by that grant, not by this file's care. There is no second, more-privileged pool
anywhere in `server/`; writes belong to the ETL, which connects as the database owner.

**The query loader** reads `sql/query/*.sql` at startup into a `Map` keyed by basename.
`query(name)` looks one up and throws at call time — naming the known queries — if the file
is missing. Query text is never assembled as a template literal: the safety-critical spatial
queries live as files so a reviewer reads a diff, the same posture Principle IV takes toward
rule content.

`findQueryDir()` walks up from the module's own location looking for a `sql/query` directory.
This replaced a fixed `../sql/query` relative to `import.meta.url`, which was correct for
exactly one location — `server/db.ts` run directly. Once a route imported `server/search.ts`,
Vite's SSR build also bundled this module into `build/server/index.js`, two directories
deeper, where the fixed path did not exist and the process would have failed at startup. The
walk is deliberately not a fallback to a *different* directory: there is one `sql/query` in
the image and this finds it or throws, because a missing query directory is a broken image
and must fail loudly rather than become a search that cannot run.

## Connections

- [[search-orchestration]] is the only consumer of `pool` and `query`.
- [[address-resolution]] and [[proximity-measurement]] are the files this loads, along with
  the manifest query behind [[coverage-manifest]].
- [[database-schema]] defines the role and the tables.
- [[ingest-pipeline]] is the write path, with its own owner credentials.

## Operational notes

Environment: `PGHOST` (default `db`), `PGPORT` (5432), `PGUSER` (`tarrow_app`), `PGPASSWORD`,
`PGDATABASE` (`tarrow`), `PGPOOL_MAX` (10). The compose file supplies the fixed development
credential `tarrow_app`/`tarrow_app`; a real deployment refuses to start on a defaulted
credential — see [[self-hosting]]. The test service connects as the same read-only role so
the suite exercises queries under the privileges they actually have.
