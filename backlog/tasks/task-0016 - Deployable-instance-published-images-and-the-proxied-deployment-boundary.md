---
id: TASK-0016
title: 'Deployable instance: published images and the proxied-deployment boundary'
status: Done
assignee: []
created_date: '2026-08-05 17:05'
updated_date: '2026-08-06 15:18'
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
- [x] #1 Pinned, multi-architecture (linux/amd64 and linux/arm64) images are published for both the application and the database
- [x] #2 A deploy composition stands somap up from published images alone, with no source checkout and no build toolchain on the host
- [x] #3 The deploy path requires a database credential to be supplied and does not fall back to the development default
- [x] #4 Deployment documentation states what a TLS-terminating proxy in front of somap can see, naming that the address travels in the request body
- [x] #5 Deployment documentation states that somap must have its own origin and why
- [x] #6 The published images are pulled and stood up from the deploy composition, and the result answers a real address
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

Closed out 2026-08-06 after verifying the three criteria that could only be proven after merge.

AC #1 -- pinned, multi-arch, published. ghcr.io/evanstern/tarrow-app and ghcr.io/evanstern/tarrow-db carry sha-785b71f and sha-13d962b and no moving tag. Both are OCI image indexes with linux/amd64 and linux/arm64 entries, i.e. QEMU emulation produced real arm64 artifacts rather than a single-arch manifest. Checked with an anonymous ghcr.io pull token carrying no account: the manifests resolve without a credential, so the packages really are public and a stranger can pull them, which was the decision the card recorded.

AC #2 -- the deploy composition stands up from images alone. The workflow's smoke job is the proof and it is running on every merge (last: run 31050785981, all five jobs green). It writes a .env with generated passwords, brings up docker-compose.deploy.yml on a runner with no source build, polls the application's own healthcheck, reads all ten logging flags back out of docker inspect, and runs both directions of the credential check -- the published tarrow_app password refused from a separate container, the configured one accepted.

AC #6 -- published images answer a real address. demo.tarrow.org is live behind Cloudflare Tunnel. Two queries, distinct outcomes, against loaded data:
  1464 Garman Rd, Akron, OH 44313 -> "3 school premises are within 304.8 m (1,000 feet) of this address."
  1361 Milan Ave, Copley, OH      -> "Outside every buffer we checked."
Distinguishing results means geocode, buffer, and ETL all ran; a health stub cannot produce them. Response headers carry the zero-JS CSP the runbook specifies.

Handoffs the card promised are in place: TASK-0010's implementation notes carry both the proxy-interception item raised here and TASK-0014's shared-origin cookie item, so the threat-model work is not orphaned.

One thing left for a later card, not blocking this one: docs/deploy/self-hosting.md still names SOMAP_REGISTRY in the migration section (line ~236) where it means to name the old variable, and app/sql/schema/014_rename_to_tarrow.sql references somap by design. The doc reference is intentional history, not drift.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
tarrow is deployable by someone who has never spoken to us.

Before this task the project had a README describing how an instance might be stood up and no artifact that proved it -- the exact gap Principle VII names. It now publishes two pinned, multi-architecture images to GHCR as public packages, ships a deploy composition that stands up from those images with no source checkout and no build toolchain, refuses to start without an explicitly named immutable tag, and refuses to run on the database credential this repository publishes in its own migration.

Shipped:
- .github/workflows/publish-images.yml -- builds tarrow-app and tarrow-db for linux/amd64 and linux/arm64, publishes immutable sha-<short> tags only, and smoke-tests the result by standing up the deploy composition from what it just pushed.
- A parity job that resolves docker-compose.yml and docker-compose.deploy.yml through Compose itself and fails if the database's command block differs. The deploy file stands alone rather than overriding, so the logging flags are written twice; those flags are what makes privacy claim 1 true, and no test in the repository would have caught the drift because they all run against the development composition.
- docker-compose.deploy.yml -- no build: key, so no host is asked for a source tree; requires POSTGRES_PASSWORD and PGAPPPASSWORD with no defaults.
- Credential rotation in migrate.ts via ALTER ROLE on every run, rather than an edit to 010_grants.sql. Editing the migration would have fixed nothing: schema_migrations makes a changed file a no-op on every existing database, which is precisely the long-lived deployments where it matters.
- docs/deploy/self-hosting.md -- states plainly that a TLS-terminating proxy holds the searched address in plaintext. Putting the address in the request body defeats logging; it was never able to defeat interception. Ranks the arrangements honestly and records the one the maintainers actually run rather than describing a better one.
- A scope statement on docs/privacy/verification.md: its six claims are claims about the composition, proven by tests that read this compose project's containers, and say nothing about anything in front of it.

Two things the work found that were not visible from the plan:

The first version of the credential check connected from inside the database container and passed while measuring nothing. initdb writes `host all all 127.0.0.1/32 trust` into pg_hba, so a loopback psql is authenticated by address and never sees a password at all. The check now runs from a separate container, which falls through to the scram-sha-256 rule a real client meets, and a positive control runs alongside the negative one -- a negative test alone passes for any reason a connection might fail.

POSTGRES_PASSWORD does not rotate and fails in a way that looks like a typo. The postgres image reads it only when initialising an empty data directory; on an existing volume it is ignored entirely, so the database keeps the old password while everything connecting uses the new one. PGAPPPASSWORD rotates cleanly, POSTGRES_PASSWORD does not rotate at all, and the asymmetry is now documented with the ALTER ROLE to do it properly.

Verified end to end (2026-08-06): both images resolve anonymously from ghcr.io as multi-arch indexes; the smoke job is green on every merge since; demo.tarrow.org answers real Summit County addresses with distinguishing results -- 1464 Garman Rd returns three school premises within 1,000 feet, 1361 Milan Ave returns outside every buffer.

Deliberately not absorbed: the on-page notice about the proxy path, and the threat model naming the hosted-instance operator and its intermediaries as parties in the trust model. Both are appended to TASK-0010, which owns that surface.
<!-- SECTION:FINAL_SUMMARY:END -->
