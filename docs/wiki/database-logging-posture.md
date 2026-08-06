---
name: database-logging-posture
description: The PostgreSQL command-line flags that keep the searched address out of the database's own logs, chosen as argv flags rather than an init script so they apply unconditionally and are readable from outside.
kind: pattern
sources:
  - docker-compose.yml
  - docker-compose.deploy.yml
  - docker/db/Dockerfile
verified_against: b5b247a6cb390ba505c674f0c77af551dd547949
---

# Database logging posture

The searched address travels to PostgreSQL as a bind parameter, so a database that logs
statements or parameters defeats every other control in the composition. The `db` service's
`command:` block is where that is closed.

## How it works

The flags are **command-line arguments, not an init script**, on purpose: `ALTER SYSTEM` runs
once on a fresh data directory and is silently absent on a volume that already exists, whereas
an argv flag applies unconditionally on every start, cannot be overridden by `ALTER SYSTEM`,
and is readable from outside the container with `docker inspect` or `ps` — which is what makes
it checkable rather than asserted.

Most of the settings are already the PostgreSQL default. They are written down anyway, because
"it happens to default to off in this image version" is not a control and a base-image bump
could change it without anyone noticing. Two are **not** defaults, and are why the block is
longer than the three settings the task named:

- `log_min_error_statement` defaults to `error`, which logs the full text of any statement that
  fails — every SQL error would put the query into the log. `panic` means effectively never.
  The error itself is still logged; its statement is not.
- `log_parameter_max_length` defaults to `-1`, meaning bind parameters are logged **in full**
  wherever a statement is logged at all. `0` means never, at any length.

The line prefix is `%m [%p]` — deliberately no `%h` or `%r`, since a client IP is personally
identifying data and the prefix is the one place it can reach a log line even with
`log_connections` off. `log_destination=stderr` with `logging_collector=off` means there is no
log *file* anywhere in the data volume: everything the database says goes to the container
stream, which is the stream the test captures. A collector would put logs somewhere the capture
does not look.

The same block appears byte-identically in `docker-compose.deploy.yml`, and the `parity` job in
`.github/workflows/publish-images.yml` fails the build if the two diverge.

## Connections

- [[process-output-seal]] is the same posture applied to the application process.
- [[privacy-verification]] step 4 shows how to check these from outside and how to prove they
  are load-bearing by turning them off.
- [[container-composition]] holds the service; [[self-hosting]] mirrors it and is kept in
  parity by CI.
- [[test-suite]]'s log-capture test reads the stream these flags govern.

## Operational notes

`db` is built rather than pulled: `postgis/postgis` is amd64-only and would exclude every ARM
self-hoster, and the component computing safety-critical distances should not come from an
unauditable account. `LANG: C` and `POSTGRES_INITDB_ARGS: --locale=C --encoding=UTF8` keep
address string comparison deterministic across hosts. `shm_size: 1gb` is required — Docker's
64 MB default kills large parallel joins with "could not resize shared memory segment", found
the hard way running the TASK-0001 match-rate classification.
