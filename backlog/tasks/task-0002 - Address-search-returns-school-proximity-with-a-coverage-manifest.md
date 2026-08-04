---
id: TASK-0002
title: Address search returns school proximity with a coverage manifest
status: In Progress
assignee: []
created_date: '2026-08-04 15:58'
updated_date: '2026-08-04 22:46'
labels:
  - 'area:web'
  - 'kind:feature'
  - 'x:safety'
milestone: m-0
dependencies:
  - TASK-0001
priority: high
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The walking skeleton, shipped end to end: a user enters an address and sees which school premises fall within the state buffer, alongside an explicit statement of what was and was not checked.

Deliberately narrow on coverage and complete on honesty. Only school premises are loaded, which is safe to ship precisely because the coverage manifest says so (Principle II). Not promoted to real users at this stage.

Privacy architecture is inside this slice rather than after it. This is the first build that could leak anything, and shipping a version that logs addresses and fixing it later is exactly the retrofit Principle III forbids.

The hardest part is not the map, it is the language. The strongest thing this interface may say is that the address is outside every buffer we checked, stated together with what we did not check.

Spec: specs/001-address-search-school-proximity
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A user can enter an address and receive school proximity results for Summit County
- [ ] #2 Every result carries a coverage manifest naming layers queried, layers absent, and verification dates
- [ ] #3 No rendered copy states or implies permission, verified by a test over result strings
- [ ] #4 A could-not-locate address is distinguishable from a located address with no nearby facilities
- [ ] #5 No IP address or searched address is recorded anywhere in the stack, including access and error logs
- [ ] #6 No third-party origin loads in the client, enforced by a build check
- [ ] #7 Guidance to confirm with the registering sheriff office appears on every result
- [ ] #8 Deployed and working end to end
- [x] #9 Spec phase: PostGIS baseline and deploy pipeline
- [x] #10 Spec phase: Summit County school premises ingest
- [ ] #11 Spec phase: Proximity query and coverage manifest
- [ ] #12 Spec phase: No-log privacy architecture, CSP, and verification
- [ ] #13 Spec phase: Web surface and end to end
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
P1 (PostGIS baseline and deploy pipeline, subtask .01) dispatched 2026-08-04 at the mechanical tier: model claude-sonnet-5, fallback claude-opus-4-8. Rubric justification: work to the container pattern already established in docker/db and docker-compose.yml, with its constraints (full truncate-and-reload, no runtime writes to derived tables, pinned multi-arch images) stated by Principle IV and runbook ruling R2 rather than discovered. No safety surface of its own. Model that actually served: recorded on completion.

Dispatch deviation, P1 2026-08-04: subagent_type 'mechanical-implementer' was not resolvable. The agent definitions planted by the runbook PR (.claude/agents/) landed on main mid-session, and this harness registers agent definitions at session start, so the pin exists on disk but not in this session's registry. Mitigation applied: dispatched to the generic agent type with model=sonnet passed on the call, and the mechanical-implementer definition's instructions carried inline in the dispatch prompt so the tier's behavioural contract still binds. The frontmatter pin will resolve normally for any session started after this one. Consequence to watch: CLAUDE.md records that the dispatch-call model parameter was observed silently ignored on 2026-07-31, so the tier is not mechanically guaranteed for this phase; which model actually served is recorded on completion.

Phase 1 (TASK-0002.01, PostGIS baseline + deploy pipeline) complete. Model that actually served this dispatch: claude-sonnet-5 (mechanical-implementer definition existed on main at session start this time, so the pin resolved normally -- no repeat of the prior session's dispatch workaround).

Landed: docker/app/Dockerfile (multi-stage, pinned node:22-bookworm-slim), docker-compose.yml restructured to db+migrate+app production composition with tools moved behind the spike profile (docker/tools/ confirmed byte-identical via git diff), app/ scaffolded (RR7 7.18.2 SSR, server/entry.ts owning HTTP via @react-router/node's createRequestListener -- no Fastify/Express/adapter), app/sql/schema/001-010 migrations + server/migrate.ts runner (idempotent, tracked in schema_migrations), app/sql/query/ loader in server/db.ts (empty, Phase 3 fills it), app/etl/reload.ts truncate-and-reload primitive.

Verified in-container: docker compose up --build -d reaches db+app healthy and migrate applies all 6 migrations from an empty volume (also verified idempotent re-run: all skip). somap_app role proven unable to INSERT/UPDATE/DELETE/TRUNCATE (permission denied on all four, connected directly as that role). Both linux/amd64 and linux/arm64 build clean via docker buildx for both docker/app and docker/db. spikes/task-0001-geocoding: docker/tools byte-identical and the tools service starts under --profile spike; the underlying pipeline still reproduces RESULTS.md's Approach B number (96.79% correct, verified fresh) -- but found and recorded (tasks.md Notes) that the README's documented command list is missing two pre-existing steps (03_measure.sql, 04_measure_v2.sql) that 07_measure_final.sql actually depends on. Not introduced by this phase; spikes/ was not modified; flagged as a follow-up.

Also found: an orphaned TASK-0001 db container (from an already-removed worktree) still occupying host port 55432. Did not remove it -- outside this phase's scope/authority. Verification used a temporary, never-committed compose override to route around it; docker-compose.yml's committed port mapping is unchanged.

Full detail in specs/001-address-search-school-proximity/tasks.md Notes section.

P1 complete and independently verified by the orchestrator (2026-08-04). Model that actually served: claude-sonnet-5, as pinned -- the call-level model parameter was honoured this time, contrary to the 2026-07-31 observation CLAUDE.md records. Orchestrator re-verification, because P1's own run used a throwaway compose override to dodge a port collision and therefore had not exercised the committed docker-compose.yml: clean bring-up from an empty volume, all six migrations applied in order, app healthy serving HTTP 200, both linux/amd64 and linux/arm64 build for docker/app and docker/db, docker/tools byte-identical to origin/main. Principle IV proven from the grant table rather than from an error message -- somap_app holds SELECT and nothing else on all nine visible tables. Janitor: two containers from the merged TASK-0001 worktree were still up holding port 55432; stopped (not removed, pgdata untouched).

P2 (Summit County school premises ingest, subtask .02) dispatched 2026-08-04 at the default tier: model claude-opus-5, fallback claude-opus-4-8. Rubric justification: x:safety. A missing school is an under-restriction defect, which Principle I classifies as unacceptable rather than recoverable, and the phase requires judgment about which sources enumerate public, nonpublic, and chartered nonpublic schools and about what becomes a declared coverage gap rather than an estimate. Model that actually served: recorded on completion.

P2 (TASK-0002.02) complete 2026-08-04. Model that actually served: claude-opus-5 (exact id claude-opus-5[1m], the 1M-context variant) -- the pinned default tier. All twelve Phase 2 boxes ticked; full detail in specs/001-address-search-school-proximity/tasks.md Notes. Ingest lands 261,154 parcels (1,128 mineral-rights flagged out of measurement), 258,862 address points, 31 jurisdictions, 619 school premises, 29 coverage-gap rows, all through docker compose run --rm etl. Every school premises row carries real parcel geometry; the no-geometry path exists, is asserted, and was exercised with an injected fixture rather than left untested. OPERATOR DECISION PENDING, per the runbook's P2 checkpoint: St. Vincent-St. Mary High School (15 N Maple St, Akron), a large chartered nonpublic school, is absent from the federal Private School Universe Survey entirely and from every other source somap can fetch; it is recorded in the coverage-gap ledger BY NAME and is NOT checked. One confirmed miss is proof the nonpublic enumeration is incomplete. The honest close is Ohio DEW's chartered nonpublic school directory as a file-authored source (published only as spreadsheets -- real work, recommend carding it). Rejected here: blanket-ingesting all 580 usecd=670 charitable/educational parcels would catch it but also flags every hospital, YMCA and charity in the county.

P2 complete and independently verified by the orchestrator (2026-08-04). Model that actually served: claude-opus-5[1m] -- note this equals the orchestrator's own session model, so unlike P1 it cannot distinguish a honoured model parameter from silent inheritance. Intended tier was claude-opus-5 either way, so nothing was mis-tiered. Verification: 619 school premises across four sources, ZERO with null geometry; 1,128 mineral-rights parcels flagged out of 261,154; 258,862 address points; 29 coverage-gap rows written in prose a user can read rather than developer shorthand; docker/tools and spikes/ byte-identical to origin/main. P2 raised the runbook's named P2 checkpoint: St. Vincent-St. Mary High School is confirmed absent, because the nonpublic source is a voluntary biennial federal survey rather than an authoritative register. P2 correctly declined to widen its owner-name heuristic to catch the one miss it already knew about.
<!-- SECTION:NOTES:END -->
