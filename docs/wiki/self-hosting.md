---
name: self-hosting
description: The deployment composition — pinned published images, credentials that must be supplied rather than defaulted, no published database port, and a CI job that keeps its logging flags identical to the development file.
kind: component
sources:
  - docker-compose.deploy.yml
  - .env.deploy.example
  - docs/deploy/self-hosting.md
  - .github/workflows/publish-images.yml
verified_against: 1a89f6a6b8d3710c3c6e9bc142b1f0485163d676
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
moves. There is no `latest`.

Releases are cut by pushing a tag: `.github/workflows/release.yml` calls the publish workflow,
waits for the smoke test that stands this composition up from the images it just built, and
only then creates the GitHub Release. It enters `publish-images.yml` through `workflow_call`
rather than a `tags:` trigger because that workflow filters its push trigger by `paths`, and a
paths filter applies to a tag push too -- a release cut from a commit that happened not to
touch `app/` or `docker/` would otherwise publish nothing at all.

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
