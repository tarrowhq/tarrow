# Repoint project references to the tarrowhq org

**Board task:** TASK-0020
**Status:** claimed

## Problem

The repository moved from `evanstern/tarrowhq` to `tarrowhq/tarrow`. The git remote is
repointed and `main` is pushed, but a remote rename does not touch the places in the
codebase that name the old owner in text.

Those places fall into two groups, and only one of them is self-correcting:

**Self-correcting.** `.github/workflows/publish-images.yml` derives its registry from
`${{ github.repository_owner }}` in three places (the `metadata-action` image name, the
smoke job's `TARROW_REGISTRY`, and the login). A publish from the new repository will
therefore land under `ghcr.io/tarrowhq` with no edit at all.

**Not self-correcting.** Everything a human or a `docker compose` invocation reads:

| File | What it says |
|---|---|
| `docker-compose.deploy.yml` (4 lines) | `${TARROW_REGISTRY:-ghcr.io/evanstern}` — the default a self-hoster gets when they set no registry |
| `docs/deploy/self-hosting.md` | image table names `ghcr.io/evanstern/tarrow-{app,db}`; the somap→tarrow migration note names the old owner throughout |
| `README.md` | names `ghcr.io/evanstern/tarrow-app` and `-db` as the published images |
| `app/etl/fetch.ts` | `USER_AGENT` carries `+https://github.com/evanstern/tarrow` — a contact URL that 404s for the operator of a source we scrape |
| `docs/design/task-0002-walking-skeleton-runbook.md` | a `gh api repos/evanstern/tarrow/pulls/<n>` example |
| `.env.deploy.example` | the commented `#TARROW_REGISTRY=ghcr.io/evanstern` default — the file a self-hoster copies to `.env` |

## Why this matters beyond tidiness

Nothing is broken today: images already published under `ghcr.io/evanstern` remain
pullable, so a self-hoster following today's docs gets a working instance. The failure is
in the *next* publish. After the next merge that touches `app/**` or `docker/**`, new
images appear under `ghcr.io/tarrowhq` and the docs still point at a registry that
receives no further tags. A self-hoster reading `docs/deploy/self-hosting.md` would pull
an image that is silently frozen at the last pre-move commit — the same "two instances
running different code while both claim to be current" failure that Principle VII's
pinning rule exists to prevent, arriving through a stale document instead of a moving tag.

The self-hosting doc already contains a migration note for the somap→tarrow rename,
written for exactly this situation. This change adds its second such note.

`app/etl/fetch.ts`'s User-Agent is a distinct concern from the registry. A `+URL` in a
User-Agent is a contact channel: the operator of a scraped source who wants to complain,
rate-limit, or ask us to stop follows it. Pointing it at a repository path that no longer
resolves removes that channel, which matters more than the registry does — a broken
registry reference produces a confused self-hoster, a broken contact URL produces a
blocked scrape with no way to find out why.

## Requirements

Mapped to the board card's acceptance criteria.

### R1 — `docker-compose.deploy.yml` defaults to the tarrowhq registry (AC #1)

All four `image:` lines default to `ghcr.io/tarrowhq` when `TARROW_REGISTRY` is unset.
The `TARROW_IMAGE_TAG` requirement is untouched: the composition must still refuse to
start without an explicit tag. Substituting one owner for another must not become an
occasion to introduce a floating tag.

### R2 — Self-hosting docs name the tarrowhq images and carry a migration note (AC #2)

`docs/deploy/self-hosting.md` names `ghcr.io/tarrowhq/tarrow-app` and
`ghcr.io/tarrowhq/tarrow-db` wherever it currently names the `evanstern` equivalents, and
carries a note — in the same shape as the existing somap→tarrow note — stating that:

- images under `ghcr.io/evanstern/tarrow-*` receive no further tags,
- an existing instance pinned to an `evanstern` tag keeps working and is not urgent,
- the upgrade path is to change `TARROW_REGISTRY` (or accept the new default) and pick a
  tag published under the new owner.

The existing somap→tarrow note is not deleted or rewritten to pretend the somap images
were always under tarrowhq. Both moves happened; a reader arriving from either one needs
their own paragraph.

### R3 — README, the ETL User-Agent, and the deploy env template name the new org (AC #3)

`README.md`'s image names and `app/etl/fetch.ts`'s `USER_AGENT` URL resolve to
`tarrowhq/tarrow`. The runbook's `gh api` example is corrected in the same pass — it is a
copy-pasteable command in a document that describes how to verify a merge, and a wrong
repo path there produces a confusing 404 at exactly the moment someone is trying to
confirm something landed.

`.env.deploy.example`'s commented `#TARROW_REGISTRY=ghcr.io/evanstern` is corrected here
too. This was missed when this spec was first written and added during implementation
after Phase 3 surfaced it; it is recorded as an amendment rather than quietly folded in.
It matters more than its size suggests: `.env.deploy.example` is the file
`docs/deploy/self-hosting.md` instructs a self-hoster to copy to `.env`, so an operator
who uncomments that line — exactly what the surrounding comment invites, since it is
offered as the knob for pointing at your own registry — pins their deployment to the
frozen registry *explicitly*, which is worse than inheriting a stale default, because an
explicit setting looks deliberate to the next person who reads it.

### R4 — A publish from the new repo produces images under `ghcr.io/tarrowhq` and the smoke job passes (AC #4)

This is the criterion that cannot be satisfied by reading the diff, and it is the reason
this task is not a find-and-replace.

The workflow's `push` trigger is path-filtered to `app/**`, `docker/**`,
`docker-compose.yml`, `docker-compose.deploy.yml`, and the workflow file itself. This
change touches `docker-compose.deploy.yml` and `app/etl/fetch.ts`, so the merge fires a
publish on its own — no dispatch needed, and no need to make a cosmetic edit to trigger
one.

Satisfied means, after merge to `main`:

- the `publish` job's two images resolve to `ghcr.io/tarrowhq/tarrow-app` and
  `ghcr.io/tarrowhq/tarrow-db`,
- both are multi-arch (`linux/amd64` and `linux/arm64`), matching what TASK-0016
  established and verified — an org move must not silently drop an architecture,
- both carry an immutable `sha-<short>` tag and no moving tag,
- the `smoke` job passes, which transitively proves that the new compose default and the
  workflow's `TARROW_REGISTRY` agree: the smoke job writes `TARROW_REGISTRY` explicitly,
  so a disagreement between it and the compose default would not surface there. See the
  note under "What this does not prove" below.

### R5 — Package visibility is stated, not assumed

Packages published to a new owner inherit the *new* repository's visibility, and
`tarrowhq/tarrow` is private. TASK-0016 recorded that the `evanstern` packages were made
public deliberately — verified with an anonymous pull token — because a self-hoster who
has never spoken to us must be able to pull them. That property does **not** travel with
the org move: `ghcr.io/tarrowhq/tarrow-*` are new packages and start private.

This spec does not require flipping them public in this task, because package visibility
is set through the GitHub UI or an API call against the org, not through a file in this
repository, and it cannot be done before the packages exist. It requires that the
situation be *recorded* — in the self-hosting doc and as a board follow-up — rather than
discovered by the first stranger who tries to pull and gets a 401. A published image a
stranger cannot pull does not satisfy Principle VII, and pretending otherwise by leaving
it unstated is the failure mode this project's constitution is most explicit about.

## What this does not prove

Stated so a later reader does not over-read the green check:

- **The smoke job passing does not prove the compose default is right.** The smoke job
  writes `TARROW_REGISTRY=ghcr.io/${{ github.repository_owner }}` into `.env` before
  standing the composition up, so it exercises the *explicit* path, not the default. The
  default is verified by reading it, and by the fact that both now derive from the same
  owner string. A test that would catch a wrong default would have to stand the
  composition up with no `TARROW_REGISTRY` set, which the smoke job deliberately does not
  do (it needs a deterministic registry).
- **This does not prove a stranger can pull.** See R5 — that is package visibility, and
  it is not set from this repository.

## Out of scope

- Making the new packages public (needs the packages to exist first; carded as a
  follow-up).
- Deleting, retagging, or migrating the images already published under
  `ghcr.io/evanstern`. They stay pullable, which is what the migration note promises.
- Any change to the workflow's owner derivation. It is already correct; editing it to
  hardcode `tarrowhq` would be a regression.
