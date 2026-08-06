# Tasks — repoint project references to the tarrowhq org

**Spec:** `specs/002-repoint-tarrowhq-org/spec.md` · **Plan:** `plan.md` · **Board:** TASK-0020

Phases 1–3 land on `task-0020-tarrowhq-org` as one PR. Phase 4 runs after that PR merges
and is the orchestrator's, not an implementer's.

## Phase 1: Deploy composition default

- [x] Change the four `image:` lines in `docker-compose.deploy.yml` from
      `${TARROW_REGISTRY:-ghcr.io/evanstern}` to `${TARROW_REGISTRY:-ghcr.io/tarrowhq}`
      (one `tarrow-db`, three `tarrow-app`)
- [x] Confirm the `${TARROW_IMAGE_TAG:?...}` guard and its message are byte-identical on
      all four lines — no floating tag introduced (constitution VII, pinning)
- [x] `docker compose -f docker-compose.deploy.yml config` parses with
      `TARROW_IMAGE_TAG` set, and still refuses with it unset

## Phase 2: Self-hosting documentation

- [x] Update the image table in `docs/deploy/self-hosting.md` to name
      `ghcr.io/tarrowhq/tarrow-app` and `ghcr.io/tarrowhq/tarrow-db`
- [x] Update every other current-state `ghcr.io/evanstern/tarrow-*` reference in the
      document to the new owner
- [x] Add a migration note for the org move, in the shape of the existing somap→tarrow
      note: `ghcr.io/evanstern/tarrow-*` receive no further tags; an instance pinned to an
      `evanstern` tag keeps working and this is not urgent; the upgrade path is to accept
      the new default or set `TARROW_REGISTRY`, then pick a tag published under the new
      owner
- [x] Record the package-visibility situation (spec R5): packages under
      `ghcr.io/tarrowhq` inherit this repository's private visibility and must be made
      public by an operator before a stranger can pull them
- [x] Leave the existing somap→tarrow note's `ghcr.io/evanstern/somap-*` references
      unchanged — they are historically accurate

## Phase 3: Remaining current-state references

- [x] `README.md`: image names → `ghcr.io/tarrowhq/tarrow-app`, `ghcr.io/tarrowhq/tarrow-db`
- [x] `app/etl/fetch.ts`: `USER_AGENT` URL → `+https://github.com/tarrowhq/tarrow`
- [x] `docs/design/task-0002-walking-skeleton-runbook.md`: the `gh api repos/evanstern/tarrow/pulls/<n>`
      example → `repos/tarrowhq/tarrow`; change nothing else in that runbook
- [x] `.env.deploy.example`: the commented `#TARROW_REGISTRY=ghcr.io/evanstern` →
      `ghcr.io/tarrowhq` (added by spec amendment during Phase 3 — this is the file a
      self-hoster copies to `.env`, so an operator who uncomments it pins to the frozen
      registry explicitly)
- [x] Verification grep: `grep -rn "evanstern" --exclude-dir=.git .` returns only the
      permitted survivors, each of which names the old owner *on purpose*: the somap
      migration note and the new org-move note in `docs/deploy/self-hosting.md` (the
      latter is about the old registry, so it must name it); TASK-0016's card and
      TASK-0020's own card under `backlog/`; this spec directory's prose; and
      `docs/design/task-0020-org-repoint-runbook.md`. **Zero hits is a failure** — it
      would mean historically-correct references were rewritten
- [x] `docker compose --profile test run --rm test` passes (container-only, constitution VII).
      Corrected during Phase 3: this line originally named `docker compose run --rm app npm
      test`, which `app/scripts/run-tests.mjs` refuses outright — the runtime image carries no
      `tests/` and no dev dependencies, so that invocation collected zero tests and would have
      read as a pass. The `test` profile is the only sanctioned invocation (`README.md`).
      216 tests, 216 passed, 0 failed, across 10 files — run against a composition whose ETL
      had been loaded first, because the suite queries the real Summit County data

## Phase 4: Post-merge publish verification (orchestrator)

**BLOCKED (2026-08-06).** The merge fired run
[31120554341](https://github.com/tarrowhq/tarrow/actions/runs/31120554341) as predicted,
but no GitHub-hosted runner ever acquired it: the jobs were cancelled at their 15- and
20-minute acquisition timeouts, and a fresh dispatch queued identically with "All
GitHub-hosted runners with label [ubuntu-latest] are busy". **GitHub Actions was in
`major_outage`**, declared 16:33:31Z — two minutes before the merge. Nothing this task
changed is implicated. Diagnosis, and a correction to a wrong first reading of it:
`docs/design/task-0020-org-repoint-runbook.md`, "Phase 4 blocker". None of the boxes below
are relaxed by this.

- [x] A `publish images` run fired on the merge commit (path filter matched via
      `docker-compose.deploy.yml` and `app/**`) — confirmed: run 31120554341 was created by
      the merge, as predicted. It never executed (Actions outage; see the runbook)
- [ ] All jobs green: `prepare`, `parity`, `publish` (×2), `smoke` — **NOT satisfied.**
      No run has executed. `parity` and `smoke` were reproduced by hand against the
      published images and pass, but a hand-run check is not a green CI job and this box
      stays open until a workflow run produces one
- [x] `ghcr.io/tarrowhq/tarrow-app` and `ghcr.io/tarrowhq/tarrow-db` exist at
      `sha-0a03fad` — published by hand during the outage, not by the workflow
- [x] Both manifests are OCI image indexes carrying `linux/amd64` and `linux/arm64` —
      verified with `docker buildx imagetools inspect --raw`
- [x] No moving tag published (no `latest`, no `main`) — each package's `tags/list`
      returns exactly `["sha-0a03fad"]`
- [x] Card the package-visibility follow-up (spec R5) on the board — TASK-0021. Confirmed
      still needed: both packages are `private` and an anonymous token request is refused,
      despite the repository now being public
