---
id: TASK-0027
title: >-
  Migrations are tracked by filename only, so an edited-in-place file never
  reaches an existing database
status: In Progress
assignee: []
created_date: '2026-08-11 17:56'
updated_date: '2026-08-11 18:14'
labels:
  - 'area:data'
  - 'kind:bug'
  - 'x:safety'
dependencies: []
priority: high
ordinal: 43000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
demo.tarrow.org answers 'tarrow broke before it could check anything' with HTTP 200 for EVERY address, including the runbook's positive case (1464 Garman Rd). Found by the infra agent during the sha-6ffcadd deploy verification, and filed there as TASK-50; the cause is here, not in infinitynode.media.

MECHANISM, confirmed against this repo:
- app/sql/schema/005_coverage_gaps.sql was created in ec12cea (TASK-0002.01) WITHOUT a label column, and EDITED IN PLACE in c787526 (TASK-0022) to add 'label text NOT NULL'.
- app/server/migrate.ts tracks applied migrations by FILENAME ONLY (schema_migrations.filename is the primary key; there is no checksum). Any database that applied 005 before the edit has the row, so the runner prints 'skip 005_coverage_gaps.sql (already applied)' forever and the new column is never added.
- app/sql/query/manifest.sql:51 selects g.label. On the live database that column does not exist, so the manifest query errors.
- app/server/manifest.ts holds a deliberate gate that fails the whole search rather than answering without disclosing coverage. It did exactly what it was built to do: it refused to answer rather than answer silently incomplete. The gate is not the bug and must not be loosened.

Everything else on the instance is healthy: 266,518 parcels, 7 of 7 layers, migrate exits 0, and coverage_gaps.label is the only column differing across all six core tables.

TWO DEFECTS, and the second is the one that matters:

1. The immediate one: the live database is missing coverage_gaps.label. A forward migration adds it.

2. The systemic one: EDITING AN APPLIED MIGRATION IN PLACE IS SILENTLY A NO-OP ON EVERY EXISTING DATABASE. It works perfectly in CI and on any fresh volume -- which is every test this repository runs -- and fails only on long-lived deployments, i.e. exactly the ones where it matters. TASK-0016's notes already recorded this hazard for 010_grants.sql ('schema_migrations makes a changed file a no-op on every existing database') and solved it for that one case by having migrate.ts re-apply the password on every run. The general problem was left standing and has now bitten a second time. A test that only ever runs against a fresh database cannot catch this class of defect by construction.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A forward migration adds coverage_gaps.label to an existing database, and is idempotent (safe to re-run, safe on a fresh database that already has the column)
- [x] #2 005_coverage_gaps.sql is restored to a state that matches what a database which applied it would actually have, so the file stops lying about the schema it produces
- [x] #3 The migration runner detects that an already-applied file has changed since it was applied, and fails loudly rather than skipping silently
- [x] #4 A test proves the drift case: a database migrated at an older revision, then brought forward, ends with the same schema as one built fresh -- this must fail before the fix and pass after
- [x] #5 The manifest gate in app/server/manifest.ts is unchanged, and its behaviour of refusing to answer is explicitly affirmed rather than loosened
- [ ] #6 demo.tarrow.org answers all three runbook verification addresses correctly, positive case first
<!-- AC:END -->
