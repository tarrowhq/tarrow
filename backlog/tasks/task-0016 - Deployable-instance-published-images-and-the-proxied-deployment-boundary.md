---
id: TASK-0016
title: 'Deployable instance: published images and the proxied-deployment boundary'
status: In Progress
assignee: []
created_date: '2026-08-05 17:05'
updated_date: '2026-08-05 17:18'
labels:
  - 'area:infra'
  - 'kind:feature'
  - 'x:privacy'
dependencies: []
priority: high
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Principle VII says packaging is a deliverable, not documentation: "an instance someone else can actually stand up is the artifact that proves this principle; a README describing how one might is not." somap does not have that artifact. It builds from source with `docker compose up --build`, publishes no image, and has no CI at all. The 1.2.0 amendment added two requirements the repo has never met — images must be **pinned**, so two contributors cannot silently run different versions of the thing computing distances, and images must be **multi-architecture**, because an amd64-only image narrows "anyone" to "anyone with the right laptop."

The occasion is a real deployment: an instance on the operator's homelab, publicly reachable at `soma.infinitynode.media`. That homelab deploys stacks by pushing a compose directory to a VM and running `docker compose up -d` with `pull: always`. It deploys images. somap has none, so it cannot be deployed there at all without first becoming the thing Principle VII already said it should be.

**The privacy boundary this exposes, which is the part that matters.**

`docs/privacy/verification.md` makes six claims, and a reader could reasonably take claims 1 and 2 — the searched address and the client IP appear in no log stream — as properties of somap. They are not. They are properties of **the composition**, proven by a test (`tests/no-logging.test.ts`) that enumerates the containers in this compose project and reads their streams. That test cannot see, and does not claim anything about, a reverse proxy in front of the composition.

A deployed instance almost always has one. The homelab instance has three things in the path: Cloudflare (the hostname resolves to its proxy IPs), a Pangolin tunnel server on a rented VPS, and the VM's own Traefik, which runs `--accesslog=true` and whose logs feed a fail2ban stack, so they cannot simply be switched off. Each terminates or forwards TLS.

The sharp edge is somap's own design decision. The address travels in the **request body** rather than the URL, deliberately, so it never reaches browser history, the address bar, a `Referer`, or a proxy's access log (`app/app/root.tsx`). That defeats *logging*, which is what it was for. It does not defeat *interception*: a proxy that terminates TLS holds the decrypted body, so it sees the address itself, not merely the IP. A self-hoster who puts somap behind Cloudflare or any CDN has, without being told, moved the one datum this project exists to protect through a third party.

That is not an argument against deploying. It is an argument that the deployment artifact must say it, because Principle III's requirement is that privacy be **verifiable** — and a claim whose scope is unstated is not verifiable, it is just narrower than it reads.

**Decisions taken with operator sign-off (2026-08-05).**

- Images publish to GHCR as **public packages**, so a deployed instance needs no pull credential and any stranger can pull them. The repo is private today, which is its own Principle VII problem and is not this task's to solve; public packages are the part that can be true now.
- Multi-arch is built with QEMU emulation rather than native ARM runners. GitHub's free `ubuntu-24.04-arm` runners are public-repo-only and this repo is private. Emulation is slow, not wrong; the workflow is written so switching to native runners is a one-line change if that ever becomes available.
- The homelab instance **accepts** Cloudflare and Pangolin in its request path rather than minimizing them, and documents the consequence. Rejected alternative: setting the DNS record to DNS-only and pointing the tunnel straight at the container, which would have removed two of the three log surfaces. The operator chose the conventional path; this card records that it was a choice and not an oversight, so a later reader does not mistake it for one.

**Out of scope, deliberately.**

- No on-page notice about the proxy path. That is a disclosure surface and TASK-0008 owns it; adding copy to results from here would fork that work.
- No threat model. TASK-0010 owns it. This task appends the proxied-deployment item to that card rather than absorbing it, the same way TASK-0014 handed it the shared-origin cookie item.
- No change to `docker-compose.yml`. The development composition stays exactly as it is — it is the one every contributor and every privacy check runs against, and the deploy path is additive to it, not a replacement.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Pinned, multi-architecture (linux/amd64 and linux/arm64) images are published for both the application and the database
- [ ] #2 A deploy composition stands somap up from published images alone, with no source checkout and no build toolchain on the host
- [x] #3 The deploy path requires a database credential to be supplied and does not fall back to the development default
- [x] #4 Deployment documentation states what a TLS-terminating proxy in front of somap can see, naming that the address travels in the request body
- [x] #5 Deployment documentation states that somap must have its own origin and why
- [ ] #6 The published images are pulled and stood up from the deploy composition, and the result answers a real address
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Publish the images. A GitHub Actions workflow builds both, multi-arch, and pushes to GHCR on every change to main that touches app/, docker/, or either composition. Immutable `sha-<short>` tags; no `:latest` published, so nothing can drift onto one. arm64 under QEMU, because free native ARM runners are public-repository-only and this repository is private -- written so that swapping to native runners later is a matrix change and nothing else.

2. A deploy composition that needs no source. `docker-compose.deploy.yml`, standing alone rather than overriding `docker-compose.yml`, because a merged `build:` key sends a host with no source tree into a build against a context that does not exist. Standing alone duplicates the database's logging flags, which is the one duplication that could hurt somebody, so the workflow resolves both files with `docker compose config` and fails if `db`'s command differs. Duplication that is checked is a different thing from duplication that is trusted.

3. Close the credential deferral. app/sql/schema/010_grants.sql creates `somap_app` with the literal password `somap_app` and says in its own comment that deployment secrets were out of scope under plan.md R3. Public deployment brings that due. Editing the migration would fix nothing -- schema_migrations makes a changed file a no-op on every existing database, i.e. exactly the long-lived deployments where it matters. Instead migrate.ts re-sets the role password from PGAPPPASSWORD on every run: idempotent, reaches fresh and existing clusters alike, and checkable by being refused the old one. Compose requires PGAPPPASSWORD and POSTGRES_PASSWORD with no defaults.

4. Write down what a proxy can see. docs/deploy/self-hosting.md, with the section a reader meets before the exposure steps. The point is not that somap logs the address -- it does not -- but that putting the address in the request body defeats logging and was never able to defeat interception, so every TLS-terminating hop holds the plaintext address. Rank the arrangements honestly, require somap have its own origin (carried from TASK-0010 and TASK-0014's cookie finding), and record what the maintainers' own instance actually does rather than describing the good arrangement and running a different one.

5. Bound the existing claims. docs/privacy/verification.md gains a scope statement: its six claims are about the composition, proven by tests that read this compose project's containers, and say nothing about anything in front of it. Hand the threat-model half to TASK-0010 rather than absorbing it.

Verification: parity check and the required-variable refusals run locally; typecheck in the container; the deploy composition stood up from locally-built images to prove migrate rotates the credential and the old one is refused. The three criteria that name *published* images cannot be true until this merges and the workflow runs -- they are ticked from the workflow run, not from here.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Two things were found by running the deploy composition rather than by reading it, and both are recorded because both would have shipped silently.

**The credential check passed for the wrong reason.** The smoke job's negative control -- connect as `somap_app` with the password published in 010_grants.sql, expect refusal -- was first written as `docker compose exec db psql -h 127.0.0.1 -U somap_app`. It succeeded, i.e. the check reported the rotation broken. It was not: `initdb` writes `host all all 127.0.0.1/32 trust` into pg_hba, so a psql run inside the database container is authenticated by address and never sees a password at all. The check was measuring pg_hba, not the credential. Running it from a separate container gives the connection a container IP, which falls through to the image's `host all all all scram-sha-256` rule -- the rule a real client meets. A positive control was added alongside it, because a negative test on its own passes for any reason a connection might fail, including the database not being up.

Verified after the fix, against locally built images: the published `somap_app` credential is refused over the network, the configured one is accepted, migrate logs `somap_app password set from PGAPPPASSWORD`, the application answers 200, and all thirteen logging flags are readable from outside with `docker inspect`.

**POSTGRES_PASSWORD does not rotate, and fails silently when it appears to.** The first smoke run died with `FATAL: password authentication failed` on a fresh `.env`. Cause: the compose project name `somap` attached to a `somap_pgdata` volume that already existed on the machine, and the postgres image reads POSTGRES_PASSWORD only when initialising an EMPTY data directory. On an existing volume it is ignored entirely, so the database keeps its old password while everything connecting to it uses the new one. The failure reads like a typo in `.env`.

This is an asymmetry between the two credentials worth stating plainly: PGAPPPASSWORD rotates cleanly because migrate.ts issues ALTER ROLE on every run, and POSTGRES_PASSWORD does not rotate at all. docs/deploy/self-hosting.md gained a section on it, including the ALTER ROLE to do it properly and the `docker volume ls` check for a leftover volume, because an operator hitting this on a first deployment has no way to tell it from a mistake of their own.

(The pre-existing volume was not mine and was left intact -- the smoke test was re-run under an isolated project name.)

Not verified here, and deliberately: acceptance criteria #1, #2 and #6 name *published* images, and nothing publishes until this merges and the workflow runs. What was proven locally is that the composition, the migration, the credential rotation and the parity gate all work; what remains is that GHCR receives the artifacts and that a pull-only host can stand them up. AC #6 additionally needs the ETL to have run, which is a several-minute fetch of county and federal sources and belongs to the deployment, not to CI.
<!-- SECTION:NOTES:END -->
