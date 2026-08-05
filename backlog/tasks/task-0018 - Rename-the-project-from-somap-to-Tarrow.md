---
id: TASK-0018
title: Rename the project from somap to Tarrow
status: In Progress
assignee:
  - '@claude'
created_date: '2026-08-05 20:14'
updated_date: '2026-08-05 20:39'
labels:
  - 'kind:debt'
dependencies: []
priority: high
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
somap was always a placeholder. The name reads as SO (sex offender) + map, which stigmatizes the exact people the tool serves and is the last thing a housing-search tool for registrants should broadcast in a URL, a container name, or a browser tab. Adopt Tarrow: a neutral, meaningless-by-design name with tarrow.ai and tarrow.org both available and no software-sector trademark collision. This is a full rename covering user-facing copy, code symbols, infrastructure identifiers, and database objects, landing as one PR.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 No file outside backlog/ contains somap, except migration 014 and the upgrade documentation, which necessarily name the old identifiers
- [x] #2 Docker image, service, container, volume, and network names use tarrow
- [x] #3 The environment variable prefix is TARROW_ across compose files, docs, and code defaults
- [x] #4 The application role and the four authored SQL function identifiers use tarrow
- [x] #5 A database created under the somap identifiers has its role and functions renamed by the tracked migration runner with no manual SQL
- [x] #6 The database name and owner role, which Postgres reads only when initialising an empty data directory, are documented as operator-controlled and unchanged under an existing volume
- [x] #7 Backlog project_name and all spec references read tarrow; existing board cards are deliberately left as the historical record of work done under the old name
- [x] #8 README and the documents under docs/ present the project as tarrow
- [x] #9 The test suite shows no regression against the parent commit
- [x] #10 The change in published image names is documented for anyone already pulling them
- [x] #11 The maintainers' live hostname is left factually accurate pending a DNS change
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Textual rename somap->tarrow, SOMAP->TARROW, Somap->Tarrow across code, tests, docs, specs, CI, compose, and Dockerfiles. 2. Rename DB objects in the schema files in place so a fresh database is created with tarrow identifiers: role tarrow_app in 010_grants.sql, and functions tarrow_normalize_address, tarrow_unverified_state_buffer_m, tarrow_residence_uncertainty_m, tarrow_premises_uncertainty_m in 012 and 013. 3. Add 014_rename_to_tarrow.sql: idempotent guarded ALTER ROLE and ALTER FUNCTION RENAME statements so a database already created under the somap identifiers upgrades through the tracked migration runner. Guards make it a no-op on a fresh database that 010-013 already created correctly. 4. POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, PGUSER, PGPASSWORD, PGDATABASE and the SOMAP_APP_ORIGIN env var move to tarrow across docker-compose.yml, docker-compose.deploy.yml, and .env.deploy.example. Note that POSTGRES_DB and POSTGRES_USER only take effect on first container init, so an existing volume keeps the old database name unless recreated; document that. 5. Set backlog config project_name to tarrow. 6. Run the full test suite. 7. Decide with the operator whether completed board task files are rewritten, since CLAUDE.md forbids hand-editing files under backlog/.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rebased onto the new origin/main (909fb06, PR #12 / TASK-0017) rather than merged. The rename is a mechanical substitution, so it was replayed on the new text instead of conflict-resolved; the pre-rebase commit is kept at the local tag pre-rebase-task-0018. New main carried 615 somap + 37 SOMAP references, up from 589/33, mostly the new FAQ page. Final: 603 substitutions across 70 files.

Verification ran against a live database holding the full county load (266,518 parcels, 258,892 address points, 624 school premises). The suite cannot pass without it: tests/fixtures.ts uses real Summit County addresses derived from loaded data, so an unloaded database fails ~54 tests for environmental reasons alone. Baseline on the parent commit with data loaded: 216 collected, 216 passed, 0 failed.

The upgrade path was exercised rather than asserted. The ETL loaded into a database created under the old identifiers, then the renamed composition ran against that same volume with POSTGRES_DB and POSTGRES_USER pinned to somap, reproducing what an in-place upgrade actually looks like. Migration runner output: 001-013 skipped as already applied, 014 applied. Post-migration psql confirmed all four functions renamed to tarrow_*, the role renamed to tarrow_app, the somap owner role still present as documented, and 266,518 parcels intact. Suite then: 216 passed, 0 failed. Browser suite: 3 passed, 0 failed.

Two deliberate non-renames, both recorded in the commit message. The maintainers' live host soma.infinitynode.media is left as written because editing it before DNS moves would make the document assert something false, against Principle III. Board cards are left as the historical record of work done under the old name, per operator decision.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Renamed the project from the placeholder somap to tarrow: 603 substitutions across 70 files, plus a new migration 014_rename_to_tarrow.sql that renames the application role and the four authored SQL functions inside a database created under the old identifiers. Verified against the full 266,518-parcel county load, with the upgrade path exercised on a live pre-rename database rather than asserted: 216 passed / 0 failed both before and after, matching baseline exactly, plus the browser suite at 3 passed / 0 failed. The database name and owner role cannot be renamed from inside the database and are documented as operator-controlled instead. Two references to the old name are deliberately retained and recorded: the maintainers' live hostname, which would become a false claim if edited before DNS moves, and the board cards, which are the historical record. Delivered as PR #13.
<!-- SECTION:FINAL_SUMMARY:END -->
