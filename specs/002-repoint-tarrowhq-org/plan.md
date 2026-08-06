# Plan — repoint project references to the tarrowhq org

**Spec:** `specs/002-repoint-tarrowhq-org/spec.md`
**Board task:** TASK-0020
**Constitution:** v1.2.0, ratified 2026-08-04 — real and ratified, so this plan is checked
against it directly rather than against the grounding docs.

## Constitution check

**Principle VII (Anyone Can Run It Themselves)** is the governing principle here, and it
is the only one this change touches. Three of its rules bear directly:

- *"Packaging is a deliverable, not documentation. An instance someone else can actually
  stand up is the artifact that proves this principle; a README describing how one might
  is not."* — This is precisely the failure being repaired. After the next publish, the
  documented pull path and the published artifact diverge. A doc that names a frozen
  registry is a README describing how one might, not a deliverable.
- *"Images are **pinned**, never floating."* — Constrains the fix: substituting the owner
  must not become an occasion to introduce a `:latest`. The `TARROW_IMAGE_TAG:?` guard in
  `docker-compose.deploy.yml` stays exactly as it is.
- *"Images must be **multi-architecture**."* — Constrains verification: the post-merge
  publish must be confirmed to produce `linux/amd64` **and** `linux/arm64` under the new
  owner. TASK-0016 established this property; an org move is exactly the kind of
  bookkeeping change that could silently drop it if the workflow behaved differently than
  expected under a new owner.

**Principle VII's self-hostability claim also raises the package-visibility question**
(spec R5). Packages inherit the *new* repository's visibility and `tarrowhq/tarrow` is
private, so the images that appear under `ghcr.io/tarrowhq` will start private. A
published image a stranger cannot pull does not satisfy "deployable by someone who has
never spoken to us." This plan does **not** fix that — it cannot be fixed from a file in
this repository, and it cannot be done before the packages exist — but it does require it
be recorded in two durable places rather than left to be discovered by the first stranger
who gets a 401. See Phase 4.

**Principles I–VI are untouched.** No change to failure semantics, coverage reporting,
privacy posture, rule storage, receipts, or jurisdiction claims. No code path that
computes or serves an answer is modified. `app/etl/fetch.ts` is edited, but only its
`USER_AGENT` string constant — not its fetching, parsing, or error behavior.

**Container-only verification (Principle VII).** Nothing in this change requires running a
tool on a host. The verification that matters (R4) runs in CI, in containers, on GitHub's
runners. No local `docker compose` run is needed to prove this task, because the thing
being proven is *what the published images are named*, and that is a CI-side fact.

## Approach

The work splits along a line worth naming: **three phases of text substitution that a
careful reader can verify from the diff, and one phase of post-merge observation that no
diff can prove.** The task is not done when the diff is right; it is done when the publish
lands and the images are confirmed.

### Why not a single `sed`

Every hit of `evanstern` is not the same kind of hit:

- `docker-compose.deploy.yml` — a functional default. Wrong owner means a wrong pull.
- `docs/deploy/self-hosting.md` — has *two* categories: current-state references that must
  change, and the **existing somap→tarrow migration note** whose `ghcr.io/evanstern/somap-*`
  references are **historically correct and must not change**. Those images really were
  published under `evanstern`; rewriting them to `tarrowhq` would make the note lie about
  where a somap self-hoster's images actually live.
- `README.md`, `app/etl/fetch.ts` — current-state references, must change.
- `docs/design/task-0002-walking-skeleton-runbook.md` — a signed-off runbook. Its `gh api`
  line is a copy-pasteable command, so it must be corrected; but the runbook is an
  execution record and nothing else in it should be touched.
- `backlog/tasks/task-0016-*.md` — TASK-0016's final summary records that images were
  verified under `ghcr.io/evanstern`. That is **an accurate historical record of a
  verification that happened** and must not be edited. It is also under `backlog/`, which
  is never hand-edited by rule.

A blanket substitution gets the third, fifth, and sixth of those wrong. This is the whole
reason the task carries phases instead of being done inline.

### Phases

**Phase 1 — the functional default.** `docker-compose.deploy.yml`: four `image:` lines,
`ghcr.io/evanstern` → `ghcr.io/tarrowhq`. Nothing else on those lines changes — the
`${TARROW_IMAGE_TAG:?...}` guard and its message stay byte-identical.

**Phase 2 — the self-hosting document.** Update the image table and every current-state
reference to name `ghcr.io/tarrowhq/tarrow-{app,db}`. Add a second migration note, in the
same shape as the existing somap→tarrow one, covering the org move: old images stay
pullable, no urgency, upgrade path is the new default or an explicit `TARROW_REGISTRY`.
Leave the existing somap note's historical `evanstern` references intact. Record the
package-visibility situation (R5) here — this is the document a self-hoster reads, so it
is where "these packages are private until an operator makes them public" belongs.

**Phase 3 — the remaining current-state references.** `README.md` image names;
`app/etl/fetch.ts`'s `USER_AGENT` URL; the runbook's `gh api repos/...` example. Small and
mechanical, but grouped separately from Phase 2 because Phase 2 carries a judgment call
(what the migration note says) and this does not.

**Phase 4 — post-merge verification (R4).** Not dispatched to an implementer; the
orchestrator does this after merge, because it depends on a merge having happened.

The merge fires the publish on its own: the `push` trigger's path filter includes
`docker-compose.deploy.yml` and `app/**`, both of which Phases 1 and 3 touch. Confirm:

1. the run completes with all jobs green (`prepare`, `parity`, `publish` ×2, `smoke`),
2. `ghcr.io/tarrowhq/tarrow-app` and `ghcr.io/tarrowhq/tarrow-db` exist at the run's
   `sha-<short>` tag,
3. both manifests are OCI image indexes carrying `linux/amd64` and `linux/arm64`,
4. no moving tag was published.

Then card the package-visibility follow-up (R5), which can only be acted on once the
packages exist.

## Sequencing and dispatch

Phases 1–3 are independent in content but land on one branch as one PR (one task, one
PR). They are dispatched separately per the sweep's fresh-implementer-per-phase rule, not
because they block each other but because each re-grounds cheaply from the spec.

Phases 1 and 3 are **mechanical tier**: the constraint is fully stated (substitute this
owner, on these lines, not those). Phase 2 is also **mechanical tier** — the migration
note's content is specified in the spec's R2 to the level of what it must state, and the
existing somap note gives the shape to copy. The judgment that would have made it default
tier (deciding *whether* the note is needed, and what a self-hoster needs told) is spent
here, in this plan and the spec, not at implementation time.

This is a tier ruling, and it is recorded on the board card at dispatch per the sweep's
rule.

## Risks

- **Over-substitution.** The named must-not-change sites (somap migration note, TASK-0016
  card) are the risk. Mitigated by naming them explicitly in the phase instructions and by
  a post-implementation grep that expects a *specific* set of surviving `evanstern` hits
  rather than zero.
- **The publish not firing.** If Phase 1 or 3 were dropped, the path filter might not
  match and no publish would fire, leaving R4 unverifiable without a manual dispatch. The
  orchestrator checks that a run started after merge rather than assuming one did.
- **Private packages read as success.** The publish will go green while producing images a
  stranger cannot pull. R5 exists so this is stated rather than mistaken for done.
