---
name: overview
description: tarrow's system shape — an ingest job and a query path over PostGIS, packaged as a container composition, built so under-restriction and address retention are structurally impossible rather than avoided by care; entry point for the two data planes and the three structural gates.
kind: concept
sources:
  - README.md
  - docker-compose.yml
  - app/package.json
  - app/app/routes.ts
  - .specify/memory/constitution.md
verified_against: 6d60a311a4e38c2e7520aa71dc141ac5bd014599
---

# Overview

tarrow answers one question — *"Am I allowed to live here?"* — for people on a sex offender
registry looking for housing in Summit County, Ohio. A user submits an address; tarrow
reports which school premises fall within the 1,000-foot buffer of ORC 2950.034, measured
parcel boundary to parcel boundary, alongside an explicit statement of what was and was not
checked. It is a helper, not an authority, and it never says an address is approved, legal,
or clear.

Two properties shape every part of the system. First, errors are asymmetric: flagging a
permitted address is recoverable, calling a barred address clear is not. Second, the
uniquely dangerous datum — where somebody is *trying* to move — exists nowhere else in the
world, so tarrow declines to create it as a record. Both are enforced by construction, not
by discipline. See [[constitution-and-principles]].

## How it works

There are two data planes and they never meet in a request.

**The ingest plane** is a job, not a service. `app/etl/ingest.ts` fetches county and federal
sources to NDJSON on a shared volume, stages each into PostgreSQL, and rebuilds every
derived table with a full truncate-and-reload — no incremental sync exists anywhere. It
connects as the database owner. See [[ingest-pipeline]], [[data-sources]].

**The query plane** is `app/server/`. `entry.ts` owns the HTTP port directly through React
Router 7's `createRequestListener`; there is no Express or Fastify adapter. A POST to
`/answer` calls `search()` in `server/search.ts`, which reads the coverage manifest, refuses
on an empty layer, resolves the address against county address points, declines when the
resolved point has no parcel, and measures on a pessimistic bound. It connects as
`tarrow_app`, a role with every write privilege revoked. See [[search-orchestration]],
[[http-envelope]].

The application ships **first-party JavaScript only**, admitted by a per-response CSP nonce
and never `'unsafe-inline'`. Nothing load-bearing waits for it: switch scripting off and the
answer, the coverage manifest, and the sheriff step are all still there, because the form is a
real `<form>` the browser submits itself. The address travels in a POST body, never a URL. See
[[web-surface]], `docs/decisions/task-0008-01-nonce.md`.

Three structural gates carry most of the safety argument:

- The result type is a closed union with compile-time assertions rejecting any variant,
  reason, or field name that reads as permission ([[result-type-gate]]).
- Every answer carries a coverage manifest read from data, and the manifest builder refuses
  to produce one unless the gap ledger discloses that the buffer is unverified
  ([[coverage-manifest]], [[coverage-gap-ledger]]).
- After startup the request process cannot write to stdout or stderr at all
  ([[process-output-seal]]).

## Connections

- [[container-composition]] is the only supported environment; nothing installs on a host.
- [[address-resolution]] and [[proximity-measurement]] are the two SQL files the query path
  runs; [[measurement-uncertainty]] holds the constants both use.
- [[database-schema]] is the migration set both planes read, and [[database-access]] is how
  the query path reaches it.
- [[test-suite]] and [[privacy-verification]] are how the claims above are checked.
- [[work-planning]] describes how changes get proposed and landed.

## Operational notes

From a clean clone: `docker compose up --build -d`, then `docker compose run --rm etl` to
load roughly 520,000 rows, then `http://127.0.0.1:3000/`. The `etl`, `test`, and `spike`
services sit behind compose profiles so `up` never starts them. The suite runs only as
`docker compose --profile test run --rm test`. Deployment uses published images and a
separate composition — see [[self-hosting]].

Cutting a release, and getting it onto `demo.tarrow.org`, is `docs/deploy/RELEASING.md`, which
the README points at from its deployment section. **Publishing an image is not deploying it**:
a `v*` tag publishes and stops, and the demo moves only when its pinned tag changes and the
deploy runs. That file is self-contained so the procedure does not live only in the private
infrastructure repository, which is what made it get rediscovered three times.
