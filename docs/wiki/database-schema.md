---
name: database-schema
description: The migration set applied in filename order by a one-shot runner — the derived spatial tables, the read-only runtime role, and the authored SQL functions compiled in as build output.
kind: component
sources:
  - app/server/migrate.ts
  - app/sql/schema/001_layers.sql
  - app/sql/schema/002_address_points.sql
  - app/sql/schema/003_parcels.sql
  - app/sql/schema/004_school_premises.sql
  - app/sql/schema/005_coverage_gaps.sql
  - app/sql/schema/010_grants.sql
  - app/sql/schema/015_coverage_gaps_label.sql
  - app/tests/migration-drift.test.ts
  - docker/db/init/00-extensions.sql
verified_against: ad1085047fbf413d249818b651dcb224725409e3
---

# Database schema

`app/sql/schema/*.sql` is applied in filename order — zero-padded, so lexical order is
application order — by `app/server/migrate.ts`, a one-shot compose service. Each file runs
once inside a transaction, recorded in `schema_migrations`. Running it as its own service is
why `docker compose up` reaching a healthy `app` implies migrations are already applied,
rather than racing them.

## How it works

The runner connects as the database **owner**, never as `tarrow_app`: `010_grants.sql` creates
that role and revokes its writes, so migrating as it would be a chicken-and-egg failure at
best.

The tables are all derived projections of the sources. `layers` is the registry every other
table references and the anchor for `TRUNCATE ... CASCADE`. `address_points`, `parcels`,
`school_premises`, `municipalities`, and `coverage_gaps` carry the loaded data;
`007_ingest_provenance.sql` records where each came from.

`coverage_gaps` carries `label` and `description` as separate `NOT NULL` columns, each with a
`COMMENT ON COLUMN` naming its audience: `label` is two or three words for the answer surface,
`description` is the full record for `/faq`. The comments exist because the split is the whole
point — one column served both audiences and was written for the auditor, not the reader.

`school_premises.geom` is nullable, with a `COMMENT ON COLUMN` stating what NULL means: no
defensible radius exists for this school, so it is a declared coverage gap rather than a value
to estimate. Geometry columns are `geometry(MultiPolygon, 6549)` with GiST indexes; parcels
carry a *partial* index over non-mineral-rights rows, which is why queries spell the predicate
`NOT is_mineral_rights`.

Later migrations are corrections and additions made as new files rather than edits, because
`schema_migrations` makes an edited migration a no-op on every existing database — a rule this
note stated correctly for months while the code broke it twice. TASK-0022 added
`coverage_gaps.label` by editing `005` in place; every long-lived database skipped it,
`manifest.sql` selected a column that was not there, and the manifest gate refused **every
search** on demo.tarrow.org for three days while returning HTTP 200. `015_coverage_gaps_label.sql`
adds the column, and `005` has been restored to what it actually applied.

The rule is now enforced rather than remembered: `schema_migrations.checksum` records the hash
of each file as applied, and the runner **fails** if an applied file has since changed
(TASK-0027). `tests/migration-drift.test.ts` is the proof — it builds a database at an older
revision, brings it forward, and compares it column-for-column against a fresh one. It is the
only test here that does not run against a freshly-built database, which is precisely why it
catches a class of defect every other test is blind to by construction.

The list of new-file corrections:
`008_municipality_identity.sql` (TWINSBURG is both a city and a township, so identity is
`(name, kind)`), `009_parcel_id_optional.sql` (one published parcel carries no identifier at
all — keeping the polygon matters more than tidying the label),
`011_named_school_parcels.sql`, `012_address_normalization.sql`,
`013_measurement_uncertainty.sql`, and `014_rename_to_tarrow.sql`.

Two migrations hold **authored content compiled into the database**, which is the shape
Principle IV sets: the normalizer and its four lookup tables, and the buffer and uncertainty
functions. They live in migrations rather than `sql/query/` because the runtime role cannot
CREATE anything.

`010_grants.sql` is the enforcement point: `GRANT SELECT ON ALL TABLES` plus
`ALTER DEFAULT PRIVILEGES` for future tables, then an explicit
`REVOKE INSERT, UPDATE, DELETE, TRUNCATE`. The revoke is the gate rather than documentation of
intent — GRANT SELECT does not imply write access, but stating the revoke makes its absence
verifiable by reading one file, and it was proved by connecting as the role and watching an
INSERT get rejected.

## Connections

- [[database-access]] is the runtime consumer; [[ingest-pipeline]] is the writer.
- [[measurement-uncertainty]] and [[address-resolution]] describe the two authored-function
  migrations.
- [[coverage-gap-ledger]] and [[coverage-manifest]] read `coverage_gaps` and `layers`.
- [[container-composition]] runs the migrate service before `app` starts.

## Operational notes

`docker/db/init/00-extensions.sql` installs PostGIS on a fresh data directory. The runner
re-applies `tarrow_app`'s password from `PGAPPPASSWORD` on every migrate — unset means
unchanged, so the development composition keeps the credential `010_grants.sql` wrote. That
runs here rather than as an edit to the migration precisely because editing an applied
migration would silently fix nothing for the long-lived deployments where a published
credential matters most. The value is escaped with `client.escapeLiteral` (ALTER ROLE takes no
bind parameters) and never logged.
