---
name: self-hosting
description: The deployment composition — pinned published images, credentials that must be supplied rather than defaulted, no published database port, and a CI job that keeps its logging flags identical to the development file.
kind: component
sources:
  - docker-compose.deploy.yml
  - .env.deploy.example
  - docs/deploy/self-hosting.md
  - .github/workflows/publish-images.yml
verified_against: 21fbc2c7ac7640712803c955ceff7b8ac6c9f888
---

# Self-hosting

`docker-compose.yml` is the development environment: it builds from source, publishes the
database on loopback for inspection, and carries fixed development credentials so a stranger
can run `docker compose up --build` with nothing to invent. That is right for the path
Principle VII says must stay easy, and wrong for a machine on the internet.
`docker-compose.deploy.yml` is the same composition for a deployment.

## How it works

Three differences: pinned published images instead of a build context (`ghcr.io/tarrowhq/tarrow-app`
and `tarrow-db`, both amd64 and arm64), credentials that must be supplied instead of defaulted,
and no database port published at all. The image tag has **no default** on purpose — a
`:latest` fallback would mean two instances silently running different versions of the
component computing safety-critical distances, so Compose refuses to start without
`TARROW_IMAGE_TAG`. The same `${VAR:?...}` pattern makes it refuse a defaulted credential.

It is a standalone file rather than a `-f base -f override` merge for one practical reason: the
base file's `build:` keys survive a merge, so a host with no source tree gets a build attempt
against a context that does not exist the moment an image is missing locally — and a deployment
target is defined by not having the source.

Standing alone costs drift, and the drift that would matter is the database's logging flags: if
they diverged, a deployed instance would log the addresses that verification claim 1 says are
recorded nowhere, and nothing in the development composition would notice. That is not left to
care. The `parity` job in `.github/workflows/publish-images.yml` resolves both files with
`docker compose config` and fails the build if `db`'s command differs between them.

Usage is `cp .env.deploy.example .env`, set the tag and both passwords, then
`docker compose -f docker-compose.deploy.yml up -d` and the `etl` profile run.

**Which tag to set.** Every build publishes an immutable `sha-<short>`; a build from a `v*`
tag also publishes the plain version (`v0.1.0` -> `0.1.0`). Either is a valid pin and neither
moves. There is no `latest` — with one live exception: the v0.1.0 release published one before
`latest=false` was added to the metadata step, and that tag still exists, frozen at 0.1.0.
`scripts/check-no-moving-tags.mjs` asks the registry on every publish and currently fails
because of it; `docs/deploy/removing-the-latest-tag.md` is the removal procedure and explains
why it is not a one-liner (`latest`, `0.1.0` and `sha-ff1094a` are three tags on one version
object, so deleting the version would delete the release images).

The rule and the enforcement are now separate claims on purpose: `latest=false` stops this
workflow from publishing a moving tag, and the check verifies none is *there* — including one
left by an earlier build or a hand push. Three documents said `latest` could not happen while
it already had.

Releases are cut by pushing a tag: `.github/workflows/release.yml` calls the publish workflow,
waits for the smoke test that stands this composition up from the images it just built, and
only then creates the GitHub Release. It enters `publish-images.yml` through `workflow_call`
rather than a `tags:` trigger because that workflow filters its push trigger by `paths`, and a
paths filter applies to a tag push too -- a release cut from a commit that happened not to
touch `app/` or `docker/` would otherwise publish nothing at all.

**How a release reaches a running instance.** Publishing is not deploying, and conflating the
two is how `demo.tarrow.org` served five-day-old code for five days while the repository, the
registry and the release were all current and green. A `v*` tag deploys; a merge to `main`
publishes an image and deploys nothing. The host runs `scripts/tarrow-deploy-agent.sh`, which
polls the registry for the newest full semver tag, pins `TARROW_IMAGE_TAG`, restarts, and
rolls back to the previous pin if the new version does not come up. Nothing pushes to the
host — GitHub holds no key to it and there is no inbound port, which is the same property the
request path was shortened to get. `release.yml`'s `verify-demo` job confirms the deploy by
polling the public origin's `/version`, the only vantage point it has and the one a stranger
shares. The reasoning and the credential inventory are in
`docs/decisions/task-0025-pull-based-cd.md`.

`docs/deploy/self-hosting.md` carries the full procedure, and its *What a reverse proxy can
see* section must be read before exposing anything: tarrow keeps the searched address out of
every log, but anything in front of it that terminates TLS holds that address in plaintext.
That is the operator's disclosure to make rather than tarrow's, and the document requires it be
made in public — recording what the maintainers' own instance does, so they are held to the
same standard.

## Connections

- [[container-composition]] is the development composition this mirrors.
- [[privacy-verification]] defers to this document for anything in front of the composition.
- [[database-logging-posture]] is the flag block the parity job protects.
- [[database-schema]] describes `PGAPPPASSWORD`, applied on every migrate.
- [[constitution-and-principles]] Principle VII is why packaging is a deliverable rather than
  documentation.

## Operational notes

A self-hosted instance must be able to say it is stale: it carries the build date of its data
and the verification dates of its rules and surfaces them on every answer, since maintainers
cannot update somebody else's deployment but can make it incapable of hiding its age. See
[[coverage-manifest]] for the fields that do this.
