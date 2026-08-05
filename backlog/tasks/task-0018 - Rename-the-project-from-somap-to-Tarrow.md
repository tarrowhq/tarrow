---
id: TASK-0018
title: Rename the project from somap to Tarrow
status: In Progress
assignee:
  - '@claude'
created_date: '2026-08-05 20:14'
updated_date: '2026-08-05 20:15'
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
- [ ] #1 No tracked file contains somap or soma in any casing
- [ ] #2 Docker image, service, container, volume, and network names use tarrow
- [ ] #3 Environment variable prefix is TARROW_ throughout compose files, docs, and code defaults
- [ ] #4 Database name, application role, and SQL function identifiers use tarrow
- [ ] #5 An existing database created under the somap identifiers upgrades via the migration runner without manual SQL
- [ ] #6 Backlog project_name and all board and spec references read tarrow
- [ ] #7 README and docs under docs/ present the project as Tarrow
- [ ] #8 The full test suite passes
- [ ] #9 The change in published image names is documented for anyone already pulling them
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Textual rename somap->tarrow, SOMAP->TARROW, Somap->Tarrow across code, tests, docs, specs, CI, compose, and Dockerfiles. 2. Rename DB objects in the schema files in place so a fresh database is created with tarrow identifiers: role tarrow_app in 010_grants.sql, and functions tarrow_normalize_address, tarrow_unverified_state_buffer_m, tarrow_residence_uncertainty_m, tarrow_premises_uncertainty_m in 012 and 013. 3. Add 014_rename_to_tarrow.sql: idempotent guarded ALTER ROLE and ALTER FUNCTION RENAME statements so a database already created under the somap identifiers upgrades through the tracked migration runner. Guards make it a no-op on a fresh database that 010-013 already created correctly. 4. POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, PGUSER, PGPASSWORD, PGDATABASE and the SOMAP_APP_ORIGIN env var move to tarrow across docker-compose.yml, docker-compose.deploy.yml, and .env.deploy.example. Note that POSTGRES_DB and POSTGRES_USER only take effect on first container init, so an existing volume keeps the old database name unless recreated; document that. 5. Set backlog config project_name to tarrow. 6. Run the full test suite. 7. Decide with the operator whether completed board task files are rewritten, since CLAUDE.md forbids hand-editing files under backlog/.
<!-- SECTION:PLAN:END -->
