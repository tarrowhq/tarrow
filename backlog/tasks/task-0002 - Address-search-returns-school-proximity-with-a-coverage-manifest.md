---
id: TASK-0002
title: Address search returns school proximity with a coverage manifest
status: Done
assignee: []
created_date: '2026-08-04 15:58'
updated_date: '2026-08-05 13:39'
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
- [x] #2 Every result carries a coverage manifest naming layers queried, layers absent, and verification dates
- [x] #3 No rendered copy states or implies permission, verified by a test over result strings
- [x] #4 A could-not-locate address is distinguishable from a located address with no nearby facilities
- [x] #5 No IP address or searched address is recorded anywhere in the stack, including access and error logs
- [x] #6 No third-party origin loads in the client, enforced by a build check
- [x] #7 Guidance to confirm with the registering sheriff office appears on every result
- [x] #8 Deployed and working end to end
- [x] #9 Spec phase: PostGIS baseline and deploy pipeline
- [x] #10 Spec phase: Summit County school premises ingest
- [x] #11 Spec phase: Proximity query and coverage manifest
- [x] #12 Spec phase: No-log privacy architecture, CSP, and verification
- [x] #13 Spec phase: Web surface and end to end
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

Operator checkpoint resolved 2026-08-04: proceed to P3, with the ODEW chartered nonpublic school directory carded as TASK-0005.04 and wired as an explicit dependency of TASK-0011 (the advocacy-review launch gate). Rationale on record: m-0 states this release is not promoted to real users, TASK-0005 is explicitly the release that becomes promotable, and the gap is declared by name in the coverage ledger rather than left silent. Board card landed direct on main at 804bb18 per two-track landing. P3 (Proximity query and coverage manifest, subtask .03) dispatched at the default tier: model claude-opus-5, fallback claude-opus-4-8. Rubric justification: x:safety -- this phase is Principle I expressed as arithmetic, and a sign error in the uncertainty bound is the unrecoverable failure mode the whole project is organised against.

Phase 3 (TASK-0002.03) complete — commit 85f1d97, branch task-0002-walking-skeleton. All 17 boxes in tasks.md Phase 3 ticked. Full detail in specs/001-address-search-school-proximity/tasks.md Notes.

Delivered: sql/schema/012 (normalizer ported from the TASK-0001 spike, byte-faithful), sql/schema/013 (buffer + uncertainty radii, each constant defined exactly once anywhere in the repo), sql/query/{resolve_address,proximity,manifest}.sql, server/{result,manifest,search}.ts, and a docker-compose 'test' profile. 43 tests, 13 suites, 0 failures, run inside the composition as the read-only somap_app role.

Safety-critical decisions made here:
- d_min = d - r_a - r_b, both radii SUBTRACTED. Asserted three ways: a source-level check that proximity.sql adds neither radius, a runtime sign check that fails the search rather than answering, and a data fixture (1563 Akers Ave, Lakemore) whose exact distance to an uncorroborated premises is 310 m — outside the buffer — and which flags only because 126 m is subtracted. If the sign ever inverts, that fixture stops flagging and the test fails.
- +126 m uncertainty on the 15 'uncorroborated' premises (school point landed on a non-exempt parcel, so the boundary may be a neighbour's and may understate the premises). Value is DECISION §3's own measured p95 suburban-lot extent. This is the only radius Phase 3 chose rather than inherited, and it is recorded in tasks.md Notes with its reasoning.
- A premises with no geometry returns NULL from the radius function, so it cannot be measured even if a WHERE clause were lost. DECISION §3's prohibition on assumed school radii is enforced in arithmetic, not only in a filter.
- Decline when ANY candidate address point lacks a parcel, not just when all do. Measured cost: 61 of 232,728 distinct normalized addresses (0.026%). The alternative would state a result while leaving one possible location unchecked.

FR-010 (clearance structurally inexpressible): result.ts carries compile-time assertions rejecting any kind, reason, basis, or FIELD NAME in the result or manifest that reads as permission. Adding kind:'clear' or permitted:boolean breaks the build in result.ts, in code the author never opened. Proved by tests/types/clearance.compile-failure.ts (tsc must refuse it; 5 cases, 5 diagnostics, including one that widens the union) and by the same cases behind @ts-expect-error inside the ordinary npm run typecheck.

Principle V honesty is a gate, not a paragraph: the manifest will not build at all unless the coverage-gap ledger carries a 'rule_content' row stating the 304.8 m buffer and the nearest-boundary method are applied without a file-authored, human-verified rule record (TASK-0003). Deleting that row fails every search loudly.

EXPLAIN: resolve_address uses address_points_normalized_idx then parcels_measurable_geom_idx; proximity uses parcels_pkey then school_premises_geom_idx. No geography cast in either plan, no geography column in the schema at all, every geometry column SRID 6549.

Pre-existing defects fixed on the way (all outside Phase 3's surface, each recorded in tasks.md Notes): app/tsconfig.json had a deprecated baseUrl that made 'npm run typecheck' abort before checking anything (it had never been green), and lacked allowImportingTsExtensions which the .ts import specifiers Node 22 requires; app/package.json's test script ('node --test tests/') does not work on Node 22; one @ts-ignore added in server/entry.ts for the generated RR7 bundle.

Open, not carded: (1) the normalizer discards the municipality, so one street address in two municipalities becomes an ambiguity resolved to the most restrictive candidate — safe but imprecise, and address_points.city is loaded and unused; (2) an out-of-county address is indistinguishable from a misspelt one (both could-not-locate) — the gap ledger names it, but a dedicated variant would be a better answer.

P3 complete and independently verified by the orchestrator (2026-08-04). Model served: claude-opus-5[1m]. Verified rather than accepted: 43/43 tests pass via docker compose --profile test run --rm test; zero geography columns exist in the schema and all four geometry columns are SRID 6549; the clearance compile-failure fixture really does fail, exit 2, with the five reported diagnostics. The check that matters most is the sign fixture -- 1563 AKERS AVE measures 310.26 m raw from an uncorroborated premises, OUTSIDE the 304.8 m buffer, and flags only because the 126 m assumed radius is subtracted. Inverting the sign breaks a test against real county data rather than a mock. Orchestrator finding handed to P5 as a new box: docker compose run --rm app npm test exits 0 having collected ZERO tests, because the runtime image excludes tests/ by design and only the build stage carries them. A wrong invocation reads as everything-passes, which is dangerous the moment it reaches CI or the README.

P4 (No-log privacy architecture, CSP, and verification, subtask .04) dispatched 2026-08-04 at the default tier: model claude-opus-5, fallback claude-opus-4-8. Rubric justification: x:privacy. Principle III is non-negotiable and this phase is its entire enforcement surface, spanning the layers that are routinely forgotten -- PostgreSQL statement logging, error reporting that carries query context, font origins, and CSP. Model that actually served: recorded on completion.

P4 (No-log privacy architecture, CSP, and verification, subtask .04) complete 2026-08-04. Model that actually served: claude-opus-5[1m]. All ten Phase 4 boxes ticked; suite is now 107 tests / 0 failures via docker compose --profile test run --rm test. Headline: the end-to-end log-capture test found three real leaks of the searched address, all of them printed by DEPENDENCIES rather than by somap -- React Router's default handleError, its default root error boundary, and @mjackson/node-fetch-server's defaultErrorHandler (unreachable through @react-router/node's createRequestListener, which hides its onError option). Each closed at source; the request process additionally seals its own stdout/stderr after the startup line, so a fourth site arriving with a dependency bump cannot leak. PostgreSQL's two NON-default settings (log_min_error_statement, log_parameter_max_length) were the real hazard and are now command-line flags that ALTER SYSTEM cannot override. CSP forced somap to ship no client-side JavaScript at all -- softening the operator-signed policy was not an option and RR7's hydration bootstrap is three inline scripts; this binds Phase 5. Also fixed a Phase-1 defect: the client build was never served, so /assets/* had 404'd since P1. docs/privacy/verification.md published. Full detail in specs/001-address-search-school-proximity/tasks.md and on TASK-0002.04.

P4 complete and independently verified by the orchestrator (2026-08-04). Model served: claude-opus-5[1m]. P4 found three real leaks of the searched address, none in somap's own code -- all in dependencies on the error path: React Router's default handleError, its default root error boundary, and @mjackson/node-fetch-server's defaultErrorHandler reached through createRequestListener, which does not expose the onError option that would replace it. Each closed at source, then the process was made to seal its own stdout/stderr on the reasoning that three leak sites in one 7.x minor means a fourth arrives with the next bump. Also generalisable: the three PostgreSQL settings the box named were already image defaults, which is not a control; the real hazards were log_min_error_statement and log_parameter_max_length, which default to logging failing statement text and bind parameters in full, and the address travels as a bind parameter. Orchestrator verification: 107/107 tests, CSP byte-identical on 200 and 404, zero script tags and zero off-origin refs in the served document, stylesheet 200, and an independent canary address absent from all 3062 bytes of captured log with the capture proven non-empty.

Operator checkpoint resolved 2026-08-04: keep zero client-side JavaScript for this slice; do NOT amend the CSP. The nonce-vs-zero-JS question is carded as TASK-0008.01 (landed on main at 5e31b7c), to be decided when the disclosure UX gives it a concrete interaction to justify itself. Recorded honestly: zero-JS was not required by any principle -- it fell out of the script-src 'self' line this sweep's runbook specified, which is incompatible with RR7's inline hydration bootstrap. Hashes cannot resolve it because the context script embeds per-request loader data. P5 (Web surface and end to end, parent ACs #1/#4/#7/#8) dispatched at the default tier: model claude-opus-5, fallback claude-opus-4-8. Rubric justification: the task's own framing -- the hardest part is not the map, it is the language. Result copy that must never state or imply permission, and a could-not-locate that must read as unmistakably distinct from a clean answer.

P5 (Web surface and end to end, parent ACs #1/#4/#7/#8) complete 2026-08-04. Model that actually served: claude-opus-5[1m]. All thirteen Phase 5 boxes ticked; suite is now 146 tests / 33 suites / 0 failures via docker compose --profile test run --rm test (was 107). Full detail in specs/001-address-search-school-proximity/tasks.md Notes.

All eight parent acceptance criteria ticked against artifacts, each one a passing test, a running container, or a committed document:

#1 (enter an address, get results) -- app/app/routes/_index.tsx is a plain <Form method="post" action="/answer">; the clean-clone run below returned "3 school premises are within 304.8 m (1,000 feet) of this address" for 1464 Garman Rd. copy.test.ts asserts the flagged shapes really flagged, including the sign fixture whose premises is 310 m away and only lands inside the buffer because the uncertainty is SUBTRACTED.
#2 (manifest on every result) -- copy.test.ts reads the raw response body of ten served shapes and asserts the coverage-gap ledger's headline entries, the data-age sentence, and "never human-verified" exactly 7 times, one per layer. The two shapes with no readable manifest are asserted to WITHDRAW the coverage claim explicitly rather than render silence.
#3 (no permission vocabulary, tested over result strings) -- copy.test.ts, two lists: HARD_DENY against the untouched body (no allowlist can excuse it) and SC-005's vocabulary as word-boundary stems. One allowlisted phrase, "never as a legal conclusion", which is the negated last clause of somap's own unverified-rule disclosure read from the ledger; it carries a written reason and a test asserts it still occurs, so a dead exemption cannot widen the gate. "no results found" is forbidden outright.
#4 (could-not-locate distinguishable) -- distinct label above each headline (set proved mutually exclusive), dashed border rather than a colour change so it survives for a reader who cannot distinguish the accents, and structurally: no refusal renders a residence, a distance, or a premises list, with the converse asserted so the check is not vacuous.
#5 (no IP or address recorded) -- Phase 4's no-logging.test.ts, extended this phase to drive its canary through the REAL submit path (POST /answer), which did not exist when that test was written. Green in the 146-test run.
#6 (no third-party origin, enforced by a build check) -- scan-external-origins.mjs runs as a docker/app/Dockerfile step and FAILED THE BUILD on Tailwind's licence banner, which is how it was found; plus no off-origin src/href on any of the ten served shapes, and CSP on every response.
#7 (sheriff guidance on every result) -- asserted on all ten shapes on two independent tokens, including the 404 error boundary and the search-failed page.
#8 (deployed and working end to end, = the container composition per ruling R3) -- clean clone of origin at abf529d into a fresh directory, docker compose up --build -d, docker compose run --rm etl (261,154 parcels / 258,862 address points / 619 school premises / 31 coverage gaps, matching Phase 2 exactly), then the documented curl returning the flagged answer. 146/146 tests pass inside that clean clone. Command sequence recorded in README.md.

Headline decisions and findings:

- The zero-collection hazard the orchestrator handed to P5 is closed. app/scripts/run-tests.mjs replaces the glob as npm test and refuses to report a pass when the tests directory is absent, when fewer test files are present than the suite has, when node --test reports fewer tests than it should, or when no summary is printed. Proved: docker compose run --rm app npm test now prints "REFUSING TO REPORT A PASS" and exits 1. scripts/ is copied into the runtime image for that reason alone, so the wrong invocation reads as a sentence rather than MODULE_NOT_FOUND.
- Tailwind 4.3.3 wired (build-time only, system font stack, pinned exact). Radix/shadcn NOT used -- Phase 4's zero-JS decision forecloses them and this phase's own box says so. Progressive disclosure is <details>/<summary>.
- ONE entry added to the build scan's allowlist: https://tailwindcss.com, the MIT licence banner inside the built stylesheet's first CSS comment. Kept rather than stripped because the licence requires the attribution travel with the output; declared rather than waved past. The allowlist doc now names licence-attribution-inside-a-comment as an admissible category and says it does not extend to a URL outside a comment. NEVER is untouched.
- Node 22's type stripping does not handle JSX, so no .tsx can be imported by node --test. search-failed is therefore rendered by a SECOND somap server started inside the test container with its PGPORT pointed at a closed port -- same code, same renderer, same wire -- rather than by a component call. It was also seen for real: a search against a never-loaded database returns search-failed, because server/manifest.ts's rule-disclosure gate fires first. An empty database fails loudly instead of producing a confident-looking empty answer.
- Two routes on purpose. / is the form and reads no database, so it loads when the database is down. /answer is POST-only so the address never reaches a URL, browser history, a Referer header, or a proxy log; copy.test.ts asserts no served href/action/src/content or <title> on any result carries a searched address. Keeping the action off / also keeps POST / a 405, which http-headers.test.ts asserts still carries the full envelope.
- Pre-existing defect fixed: server/db.ts resolved sql/query by a fixed ../sql/query from import.meta.url. This phase's route pulls server/search.ts into the SSR bundle two directories deeper, where that path does not exist and the process would have died at startup. It now walks up to find the one sql/query in the image, or throws.

spec-bridge sync: PostGIS baseline and deploy pipeline: 11/11 · Summit County school premises ingest: 12/12 · Proximity query and coverage manifest: 17/17 · No-log privacy architecture, CSP, and verification: 10/10 · Web surface and end to end: 13/13 — status In Progress → Done

AC #1 un-ticked 2026-08-05. It was ticked against a curl, not against a user. TASK-0015 records the defect: Referrer-Policy: no-referrer makes Chromium send Origin: null on the form POST, and React Router 7's origin check rejects that with a bare 400 before any somap code runs. The landing page renders and the one interaction somap has does not work, in every Chromium browser. Nothing in the 146-test suite could catch it -- every test reaches the app through fetch()/undici, which does not implement referrer policy, so the test client always sends a proper Origin or none, which are the two cases that pass. The clean-clone end-to-end check used curl, and the orchestrator's independent verification also used curl and read the rendered HTML of all four result shapes by fetching them directly rather than by submitting the form. The bodies were verified exhaustively; the interaction never was. AC #1 re-ticks when TASK-0015 lands, against a browser.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (PostGIS baseline and deploy pipeline: 11/11 · Summit County school premises ingest: 12/12 · Proximity query and coverage manifest: 17/17 · No-log privacy architecture, CSP, and verification: 10/10 · Web surface and end to end: 13/13). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->
