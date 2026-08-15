# Tasks: a sweep ends live on demo.tarrow.org

**Spec**: `specs/003-sweep-ends-live/spec.md` · **Plan**: `plan.md` · **Board**: TASK-0029

Each phase is one fresh implementer dispatch. A phase is done when every box under it is
ticked and its work is committed on `task-0029-sweep-ends-live`.

## Phase 1: The decision record

- [x] Write `docs/decisions/task-0029-sweep-auto-release.md` amending
      `docs/decisions/task-0025-pull-based-cd.md` §1: a sweep cuts the release tag
      automatically, on the operator's 2026-08-11 authority and stated reasoning.
- [x] State explicitly that §2 (*the host pulls; GitHub does not push*) and §3 (*no moving
      tags*) are **not** overturned and remain binding.
- [x] Record the argument that was rejected — "a sweep can merge several PRs, and 'approved
      this diff' is not identical to 'ship this to the public instance'" — so a future reader
      sees the trade, not just the outcome.
- [x] Add a pointer from `task-0025-pull-based-cd.md` to the amendment, so §1 is never read
      standalone as still-current.

## Phase 2: The release script

- [x] `scripts/release-tarrow.mjs`: derive the next unused patch version from the highest
      existing `v*` tag.
- [x] Refuse-if-exists (plan D1): if the derived tag already exists, exit nonzero and report;
      never re-push or force-move a published version.
- [x] Cut and push the annotated tag.
- [x] Wait for `release.yml` and report which job failed if it does — the v0.1.1 case
      (`no-moving-tags` failing, `release` and `verify-demo` skipped) is the worked example.
- [x] `--dry-run` that prints the version it would cut and does nothing else.
- [x] Report the v0.1.1 half-release as an operator action rather than repairing it (D1).

## Phase 3: The deploy caller and its honest degradation

- [ ] `scripts/deploy-demo.sh` resolving the infra repo per plan D3
      (`$TARROW_INFRA_REPO` → `~/projects/infinitynode.media` → not found).
- [ ] Absent-infra path exits nonzero, prints every path tried, and states plainly that a
      self-hoster has no such repo and this is expected. Never a silent no-op.
- [ ] Delegate pin-bump and playbook to the infra-side script by path (ruling 2); do not
      reimplement the Ansible invocation here.
- [ ] Wire verification: `verify-deployed-version.mjs` for `/version`, then the three
      addresses **positive case first** (`1464 Garman Rd` → *inside a buffer*).
- [ ] Distinguish *declined* (no instance), *failed* (deploy or verify broke), and *deployed*
      in the exit code and the message. Never collapse them.
- [ ] **Exercise** the absent-infra path (SC-004): actually run it with no infra repo
      resolvable and record the output in this spec dir or the PR body. Asserting is not
      enough.

## Phase 4: Documentation, the Output-gate hook, and re-grounding

- [ ] `docs/deploy/automated-release.md`: the repo-local release phase the sweep's Output gate
      points at (FR-002).
- [ ] Amend `docs/deploy/RELEASING.md` in this same PR (FR-007), keeping it followable without
      the infra repo checked out.
- [ ] Re-verify and honestly re-pin any `docs/wiki/` note whose sources this PR touched
      (`self-hosting`, `work-planning`) — read the diff, classify RE-PIN-ONLY vs NEEDS-REVIEW,
      amend prose before bumping.
- [ ] `node scripts/check-wiki-freshness.mjs` exits 0.
- [ ] `node scripts/check-no-moving-tags.mjs` exits 0.

## Phase 5: The infra card (orchestrator)

- [x] Card AC#5 on the `infinitynode.media` board: a CI check resolving every pinned image tag
      against its own compose file's registry.
- [x] Record the live hazard on that card with its evidence: main pins `sha-785b71f` against a
      compose file naming `ghcr.io/evanstern/*`; the tag resolves in `evanstern` and not in
      `tarrowhq`; the demo serves `0.1.1`; PRs #19/#20 carry the fix and are unmerged.
- [x] Cross-reference the infra card from TASK-0029 so AC#5's closure is findable from here.
