# tarrow grounding wiki

A code-grounded corpus for the tarrow repository. Every note is pinned to a commit and
lists the source files whose change invalidates it. Read this index first and load
individual notes just-in-time.

tarrow answers one question for one person — *"Am I allowed to live here?"* — for people
on a sex offender registry looking for housing in Summit County, Ohio. The architecture
is shaped end to end by the asymmetry between over-restricting (recoverable) and
under-restricting (not), and by a refusal to record what anybody searched.

## Start here

- [[overview]] — the system's shape: two planes (ingest job, query path), the container
  composition that is the only environment, and where each principle is enforced.
- [[constitution-and-principles]] — the seven principles the code is written against,
  and the specific mechanism in the repository that enforces each one.

## The query path

- [[http-envelope]] — the server process, its response headers, the CSP, and the error
  paths that carry no query context.
- [[process-output-seal]] — why the request process is made incapable of writing to
  stdout or stderr after startup, rather than audited for not doing so.
- [[search-orchestration]] — the control flow of answering one address: manifest first,
  refuse on empty layers, resolve, decline without a parcel, measure pessimistically.
- [[result-type-gate]] — the closed result union and the compile-time assertions that
  make an unqualified clearance structurally inexpressible.
- [[coverage-manifest]] — what was and was not checked, read from data on every answer,
  gated on a rule-content disclosure row.
- [[address-resolution]] — normalize, match against county address points, attribute a
  parcel; no fuzzy matching and no coarse fallback, by construction.
- [[proximity-measurement]] — nearest boundary to nearest boundary in a projected metre
  CRS, with uncertainty radii subtracted to make flagging more likely.
- [[measurement-uncertainty]] — where the radii come from, and why they are SQL functions
  rather than constants in application code.
- [[database-access]] — the read-only pool, the file-loaded query registry, and why query
  text is never assembled in TypeScript.

## The web surface

- [[web-surface]] — routes, the no-client-JavaScript stance, and how a POST keeps the
  address out of every URL.
- [[answer-rendering]] — how a result becomes a page without the renderer deciding
  anything, plus the wording rules.

## The ingest pipeline

- [[ingest-pipeline]] — the ETL job: fetch, stage, truncate-and-reload, assert, stamp.
- [[data-sources]] — the layers ingested, why each one, and what each is known not to
  cover.
- [[coverage-gap-ledger]] — how known absences become rows that every answer renders.
- [[ingest-assertions]] — the checks that abort a load rather than let it finish quietly.
- [[database-schema]] — the migration set, the derived tables, and the grant that makes
  the runtime role read-only.

## Environment and verification

- [[container-composition]] — services, profiles, volumes; the container as the only
  supported environment.
- [[database-logging-posture]] — the PostgreSQL flags that keep the searched address out
  of the database's own logs.
- [[test-suite]] — what the suite proves, why it runs only in a container, and why some
  tests need the Docker socket.
- [[privacy-verification]] — the published procedure for checking the privacy claims from
  outside, including how to make each check fail.
- [[self-hosting]] — the published-image composition, and what it refuses to start without.

## How work is planned

- [[work-planning]] — specs, the Backlog board, one-task-one-PR, and where decisions and
  spikes live.
