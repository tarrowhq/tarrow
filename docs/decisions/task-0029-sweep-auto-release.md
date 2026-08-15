# TASK-0029 — a sweep cuts the release tag; the human checkpoint is the PR

**Status:** accepted, 2026-08-11
**Decided by:** operator ruling, taken 2026-08-11 during TASK-0029 lane authoring and recorded
in `docs/design/task-0029-sweep-ends-live-runbook.md` under *Operator decisions*
**Amends:** §1 of `docs/decisions/task-0025-pull-based-cd.md`. §2 (*the host pulls; GitHub does
not push*) and §3 (*no moving tags, anywhere*) are **not** overturned and remain binding.

---

## The decision

A sweep cuts and pushes the version tag itself. No operator command stands between a merged PR
and a released version.

**What survives from §1, unchanged:** a `v*` tag is still the only thing that deploys. A merge
to `main` still publishes images and does not deploy. Nothing else deploys at all. The trigger
is not widened, and no new trigger is added — what changes is who pulls it.

**What falls:** the claim that cutting a tag must be a separate, deliberate human act performed
after the merge. §1 read:

> So the question "is this good enough to serve to that reader" gets a human answer. Cutting a
> tag *is* that answer. A merge to `main` is a statement that the code is correct; a tag is a
> statement that somebody decided it should be in front of people.

That second sentence no longer holds. The human answer is now given at PR review, and the tag
is machinery.

## What is not overturned, and must not be read as loosened

Automating the release did not touch the credential posture. It is worth saying flatly, because
"the pipeline now deploys by itself" is the sentence a reader would ordinarily take as evidence
that something gained a key.

- **§2 stands.** The deploy is still performed from the host's side and from an operator's
  machine reaching out. GitHub Actions still does not connect to the host, hold a key to it, or
  know it exists. There is still no inbound path to that host, by choice, and none is created
  here (spec NFR-001).
- **§3 stands.** No moving tags. The automation resolves an exact semver version and pins to it,
  and `scripts/check-no-moving-tags.mjs` runs on any PR touching this path (NFR-002).
- **The credential inventory table in TASK-0025 is unchanged.** This decision adds no credential
  to it. `gh secret list` and `gh variable list` on `tarrowhq/tarrow` were empty when that table
  was written and this work does not populate them.

A future change that would add a GitHub-held credential capable of reaching the demo host is
governed by §2 and is not licensed by anything in this document.

## The authority, and the operator's reasoning

This is a decision, not a discovery. Nothing was learned about the system that made §1 wrong;
the operator changed what the policy should be. §1 was policy for exactly as long as it was
policy, and it was followed — on 2026-08-11 the whole chain (cut `v0.1.1`, move the pin in
`infinitynode.media`, run the playbook, verify three addresses) was performed by hand, which is
precisely what §1 asked for.

The operator's stated reasoning, recorded because it is the load-bearing part:

> the PR approval already was the human checkpoint, and demanding a second deliberate act is
> exactly the manual last mile TASK-0029 exists to remove.

## The argument that lost

Stated at its strongest, because a future reader has to be able to see the trade rather than
only the outcome.

**A sweep can merge several PRs, and "I approved this diff" is not identical to "ship this to
the public instance."** Those are two different claims about two different objects. The first is
about a change; the second is about a running origin serving a specific reader. §1's reasoning
about *what the demo is* was not decoration — it is the substance of the objection:

> it is also a real origin at a real hostname, and the reader this project is built for is a
> person on a registry asking whether they are allowed to live somewhere. If anyone is ever
> handed a URL, it is that one.

Under Principle I the asymmetry is total, and that argument reaches its strongest form in
batching: five diffs each individually correct can compose into an instance nobody looked at as
a whole, and after this amendment there is no moment at which someone asks "these five,
together, in front of that reader?"

**Where the ruling disagrees.** The deliberate act being defended sat *before* the step that
actually failed. `v0.1.0` was tagged — someone did perform the deliberate act — and the demo
still served pre-redesign code for five days, because the tag was never the thing that moved the
origin. The checkpoint's stated content, *is this good enough to serve to that reader*, is a
judgment about the code, and the code is what a PR review has in front of it. A second act
performed on a version number, minutes later, with the same information, is closer to a chore
than to a deliberation, and a checkpoint that has become a chore is not protecting anyone.

**Where it does not.** The batching objection is not answered, only accepted. It survives as a
cost below rather than as a refuted claim.

## What this amendment costs, stated plainly

- **The human checkpoint moves earlier and becomes less deliberate.** PR review approves a diff.
  After this decision nobody is asked, at any later point, "in front of people?" — the question
  §1 existed to force is now answered implicitly by approving the change.
- **A sweep that merges several PRs ships them all together.** There is no per-change release
  boundary, and no moment corresponding to the composed state of the instance.
- **Nobody types a command whose act of typing meant "this is ready for people."** The loss is a
  moment of attention, not a control — but it was a real moment and it is gone.
- **"main sits ahead of the demo" changes meaning.** §1 accepted that openly and called it not
  drift. After this amendment, main sitting ahead of the demo following a sweep means the
  release phase *declined* or *failed*, and that must be reported as such (FR-006) rather than
  read as the ordinary state it used to be.

## What still protects the reader

The amendment removes a human act. These are the structural checks that do not depend on one,
and they are the reason the removal is survivable.

- **Verification is positive-case-first (FR-005).** A broken instance answers "outside every
  buffer" for every address, so a negative-only check reads as a pass while the instance is
  broken. `1464 Garman Rd` must come back *inside a buffer* before anything may be called
  deployed. This is Principle I applied, not a style preference — the same way §1's own closing
  point was that "it responded" would have passed throughout the five-day outage.
- **Three outcomes, never collapsed (FR-006).** *Declined* (no instance to move — the
  self-hoster case), *failed* (deploy or verify broke), and *deployed* are distinct in the exit
  code and in the report. A release phase that rounds any of them up to "deployed" reintroduces
  exactly the invisible staleness this work closes.
- **The automation never publishes over an existing version object (NFR-003).** If the version
  it would cut already exists, it stops and reports rather than re-pushing or force-moving it.
  Two instances must never claim the same version while running different code — §3's rule, and
  Principle VII's pinning requirement.
- **Principle I's asymmetry is unchanged.** Shipping a broken instance faster is still strictly
  worse than shipping a correct one slower. What was traded here is a second human act, not that
  ordering, and no part of this decision may be cited to trade it.

## Consequences

- The release phase is repo-local — scripts plus `docs/deploy/automated-release.md`, pointed at
  from the sweep's Output gate (FR-002). The praxisflux sweep plugin stays generic.
- `docs/deploy/RELEASING.md` is amended in the same PR (FR-007), per its own *Keeping this
  honest* section.
- §1 of `docs/decisions/task-0025-pull-based-cd.md` carries a pointer to this document, so it is
  never read standalone as still-current. The original §1 reasoning is left in place: it is the
  record of what was believed and why, and this amendment engages with it rather than replacing
  it.
- **This sweep builds the mechanism and does not fire it at the live origin.** Shipping a path
  to the public instance and exercising it in the same breath is a one-way door; the first real
  use is the next sweep.
