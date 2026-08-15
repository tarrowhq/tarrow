# Implementation Plan: a sweep ends live on demo.tarrow.org

**Spec**: `specs/003-sweep-ends-live/spec.md` · **Board task**: TASK-0029
**Constitution**: `.specify/memory/constitution.md` v1.2.0, ratified 2026-08-04 — **present
and ratified**, so this plan is checked against it rather than against the grounding docs.

## Constitution check

| Principle | Bearing on this work | Verdict |
|---|---|---|
| **I. Fail safe, say which way** | An automated path to the public origin can ship a broken instance faster. Mitigation is structural: verification is positive-case-first (a broken instance answers "outside every buffer" for everything, so a negative-only check passes while the instance is broken), and *declined* / *failed* / *deployed* are three distinct reported outcomes that are never collapsed. | **Pass** — with FR-005 and FR-006 as the enforcement. |
| **II. Coverage is part of the answer** | Untouched. No change to what an answer states. | Pass |
| **III. Privacy is a stance** | The verification step sends three *published example* addresses from `RELEASING.md` to the origin. No user data, no new logging, no new party in the request path. | Pass |
| **IV. Legal content authored as files** | Untouched. | Pass |
| **V. Every answer carries receipts** | Untouched. | Pass |
| **VI. Complete a jurisdiction** | Untouched. | Pass |
| **VII. Anyone can run it themselves** | **Directly engaged.** A release path that only works with a private infra repo would make publishing depend on infrastructure a stranger cannot have. US3 is the compliance mechanism: publishing never gates on the infra repo, and the deploy step declines audibly. Image pinning and multi-arch are preserved — nothing here introduces a floating tag. | **Pass** — US3 is constitutionally required, not optional polish. |
| **Delivery — one TASK one PR** | The infra half genuinely cannot live in a tarrow PR. Ruling 3 cards it on the infra board rather than stretching one task across two repositories. | Pass |
| **Delivery — every PR leaves main deployable** | This PR adds scripts and documents; it changes no application code. A document-and-tooling PR satisfies the deployability rule trivially. | Pass |

**Deviations**: none. Where compliance was in tension (VII vs. the convenience of assuming the
infra repo), the spec resolves it in favour of the principle.

## Decisions taken here, so implementation does not have to guess

### D1 — Version derivation, and the v0.1.1 half-release (FR-003, NFR-003)

**The release phase never re-runs an existing tag.** It derives the next unused patch version
from the highest existing `v*` tag, and if the tag it would cut already exists it **stops and
reports**, rather than re-pushing or force-moving it.

Rationale: re-running `v0.1.1` would publish over an existing version object. Under
Principle VII's pinning rule, two instances must never be able to claim the same version while
running different code — and `0.1.1`'s images are already published and pullable. Re-publishing
that tag from a different tree is exactly the drift the rule forbids.

Consequence for the live half-release: `v0.1.1`'s missing Release object is **not** repaired by
this automation. It is a one-line operator action (`gh release create v0.1.1 …`) and is
reported as such, not silently fixed by a mechanism whose first act would then be an exception
to its own rule.

### D2 — Where each piece lives

| Piece | Location | Why |
|---|---|---|
| Release phase runbook | `docs/deploy/RELEASING.md` (amended) + `docs/deploy/automated-release.md` (new) | FR-002/FR-007: repo-local, praxisflux stays generic; `RELEASING.md` remains the entry point a human already knows. |
| Version derivation + tag + wait | `scripts/release-tarrow.mjs` | Sibling of the existing `check-*.mjs` / `verify-deployed-version.mjs` scripts. |
| Deploy caller | `scripts/deploy-demo.sh` | Resolves the infra repo, delegates to its script, fails loudly when absent (ruling 2). |
| Pin-bump + playbook | **`infinitynode.media`** — not this repo | Ruling 2: that repo owns the vars file, the venv, `bw-run.sh`, and the asserted `--limit`. |
| Registry-resolution check | **`infinitynode.media`** — carded there | Ruling 3 / AC#5: it must read that repo's compose file. |
| Decision amendment | `docs/decisions/task-0029-sweep-auto-release.md` | FR-008: a decision record, not prose. |

### D3 — Infra repo resolution order (FR-004, AC#6)

`$TARROW_INFRA_REPO` if set → `~/projects/infinitynode.media` → not found. On *not found*:
exit nonzero, print every path tried, and state that a self-hoster has no such repo and this
is expected for them. Never a silent no-op — a deploy step that quietly does nothing is how a
release looks deployed while the origin serves old code, which is the whole failure being
closed.

### D4 — Verification is the existing script plus the three addresses

`scripts/verify-deployed-version.mjs` already polls `/version` from outside. It is reused, not
rewritten. The three-address check from `RELEASING.md` is added as the second half, **positive
case first** (`1464 Garman Rd` → *inside a buffer*). Reusing the script keeps one definition of
"is the origin serving what we shipped".

## Phases

Each phase is a fresh implementer dispatch. Nothing is handed between phases except artifacts:
this spec dir, the ticked boxes in `tasks.md`, and the branch's commits.

- **Phase 1 — The decision record.** Amend `task-0025-pull-based-cd.md` per ruling 1. Closes
  AC#1. First because it is the authority the rest of the work executes under; if the
  amendment cannot be written honestly, nothing downstream should be built.
- **Phase 2 — The release script.** `scripts/release-tarrow.mjs`: derive, refuse-if-exists
  (D1), tag, push, wait for `release.yml`, hand off to verification. Closes part of AC#2.
- **Phase 3 — The deploy caller and its honest degradation.** `scripts/deploy-demo.sh` with D3
  resolution, plus the three-address verification wired in positive-case-first. Closes AC#3 and
  AC#4, and **exercises** the absent-infra path for AC#6 (SC-004: run it, record the output).
- **Phase 4 — Documentation, the sweep's Output-gate hook, and re-grounding.** New
  `docs/deploy/automated-release.md`; amend `RELEASING.md` (FR-007); re-verify and honestly
  re-pin any `docs/wiki/` note whose sources this PR touched (`self-hosting`,
  `work-planning`); run the freshness gate.
- **Phase 5 — The infra card (orchestrator, not an implementer).** Card AC#5 on the
  `infinitynode.media` board with the live hazard and its evidence; cross-reference from
  TASK-0029.

## Risks

- **Automating a path to a public origin.** Mitigated by scope: this PR *builds* the mechanism
  and does not fire it (spec, *out of scope*). First real use is the next sweep.
- **The infra pin hazard is live and outside this PR's reach.** Reported to the operator and
  carded; this repo cannot fix another repository's main branch.
- **`RELEASING.md` and the infra runbook drifting apart.** FR-007 keeps them in one session;
  the honesty section of `RELEASING.md` already names this as the known failure.
