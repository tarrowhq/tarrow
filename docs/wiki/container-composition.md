---
name: container-composition
description: The compose file that is the entire environment — db, migrate, app as the production set, plus etl, test, browser-test and spike behind profiles, with nothing installed on a host.
kind: component
sources:
  - docker-compose.yml
  - docker/app/Dockerfile
  - docker/db/Dockerfile
  - docker/tools/Dockerfile
verified_against: b5b247a6cb390ba505c674f0c77af551dd547949
---

# Container composition

`docker-compose.yml` is the whole environment. Principle VII makes the container the
environment for everyone including maintainers: a contributor needs a container runtime and
this repository and needs nothing else, because there *is* nothing else. That is the
enforcement mechanism for the self-hostability claim, not a tooling preference — a packaged
path maintainers never exercise decays without anyone noticing.

## How it works

The production composition is **db + migrate + app**. `migrate` is a one-shot service, so
`up` reaching a healthy `app` implies migrations already applied rather than a race. `app`
depends on `service_completed_successfully`; the test services depend additionally on `app`
being healthy.

Four services sit behind profiles because they are jobs, not services: `etl` (fetch and
load), `test` (the suite), `browser-test` (Chromium), and `tools` (the TASK-0001 spike
container, frozen byte-identical so its published results keep reproducing). `docker compose
up` starts none of them.

`db` is **built, not pulled**: `postgis/postgis` is amd64-only, which would exclude every
self-hoster on ARM, and the component computing safety-critical distances should not come
from an account that cannot be audited. Images are pinned rather than floating, so two
contributors cannot silently run different versions of the thing computing distances.

Credentials differ by role, deliberately. `app` connects as `tarrow_app` (read-only);
`migrate` and `etl` connect as the owner, because the ETL's writes are exactly what the
runtime role has revoked. `test` connects as `tarrow_app` so the suite exercises queries
under the privileges they actually have.

Two volumes: `pgdata`, and `etldata` holding the fetched NDJSON — written by `etl`, mounted
**read-only** into `db`, which reads it with a server-side COPY. A named volume rather than a
bind mount, because "nothing is installed on a host" extends to not scattering 200 MB of
working data across one.

The file records a control that was attempted and could not be had. The strongest form of
"no outbound call from the query path" would be a network declared `internal: true`, and it
does not work for a service that must also be reachable: the engine accepts the port binding
and publishes nothing. What stands instead is three checkable things — no module in the
request path names a network client API, no built asset references an external origin, and
`connect-src 'self'` stops the client half.

`browser-test` uses `network_mode: "service:app"` so the app is reachable at
`http://localhost:3000`. That hostname is the point: Chromium silently upgrades http to https
for any host it does not consider trustworthy, and `app:3000` is not one — the suite failed
with `ERR_SSL_PROTOCOL_ERROR` and said nothing about tarrow. `localhost` is exempt by
definition.

## Connections

- [[database-logging-posture]] is the `db` service's command block.
- [[test-suite]] explains the two test services and the Docker socket mount.
- [[ingest-pipeline]] runs as `etl`; [[database-schema]] as `migrate`.
- [[self-hosting]] is the separate published-image composition for a real deployment.

## Operational notes

Both `db` and `browser-test` set `shm_size: 1gb` — PostgreSQL's parallel workers and
Chromium's renderers both exchange data through shared memory, and Docker's 64 MB default
kills large parallel joins with "could not resize shared memory segment". Ports are bound to
loopback only (`127.0.0.1:3000`, `127.0.0.1:55432`). `LANG: C` and `--locale=C` keep address
string comparison deterministic across hosts.
