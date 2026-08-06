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

- [ ] `README.md`: image names → `ghcr.io/tarrowhq/tarrow-app`, `ghcr.io/tarrowhq/tarrow-db`
- [ ] `app/etl/fetch.ts`: `USER_AGENT` URL → `+https://github.com/tarrowhq/tarrow`
- [ ] `docs/design/task-0002-walking-skeleton-runbook.md`: the `gh api repos/evanstern/tarrow/pulls/<n>`
      example → `repos/tarrowhq/tarrow`; change nothing else in that runbook
- [ ] Verification grep: `grep -rn "evanstern" --exclude-dir=.git .` returns only the
      permitted survivors — the somap migration note in `docs/deploy/self-hosting.md`,
      TASK-0016's card under `backlog/`, and this spec directory's own prose
- [ ] `docker compose run --rm app npm test` passes (container-only, constitution VII)

## Phase 4: Post-merge publish verification (orchestrator)

- [ ] A `publish images` run fired on the merge commit (path filter matched via
      `docker-compose.deploy.yml` and `app/**`) — confirm a run started rather than
      assuming
- [ ] All jobs green: `prepare`, `parity`, `publish` (×2), `smoke`
- [ ] `ghcr.io/tarrowhq/tarrow-app` and `ghcr.io/tarrowhq/tarrow-db` exist at the run's
      `sha-<short>` tag
- [ ] Both manifests are OCI image indexes carrying `linux/amd64` and `linux/arm64`
- [ ] No moving tag published (no `latest`, no `main`)
- [ ] Card the package-visibility follow-up (spec R5) on the board
