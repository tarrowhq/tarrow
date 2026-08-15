# Releasing tarrow without typing the release

This is the automated path: two scripts that take merged work on `main` and put it in front of
people, and that say precisely which of them stopped when one does.

[`RELEASING.md`](RELEASING.md) is still the document to read first if you want to know *how*
tarrow deploys — it is the explanation, the fallback, and the only version of the procedure
that works when you have nothing but this repository. This file is narrower: it is what a
sweep runs, and what a person runs when they would otherwise be following `RELEASING.md` by
hand.

Under `docs/decisions/task-0029-sweep-auto-release.md` (accepted 2026-08-11) no operator
command stands between a merged PR and a released version. **The PR review is the human
checkpoint.** That is the whole reason the refusals below are worth reading: with the second
deliberate human act removed, what stops a bad release is the set of things these scripts
decline to do.

---

## The sequence

```
merged PRs on main, every gate green
        │
        ├─ node scripts/release-tarrow.mjs      derive → refuse-if-exists → tag → push
        │                                       → watch release.yml's `release` job
        │   images published, GitHub Release created.  PUBLISHED, NOT DEPLOYED.
        │
        └─ ./scripts/deploy-demo.sh <version>   resolve infra repo → delegate pin bump
                                                and playbook → verify the live origin
            demo.tarrow.org serves that exact version and answers three addresses.
```

Nothing chains these together for you, on purpose. `release-tarrow.mjs` ends by printing the
exact `deploy-demo.sh` invocation to run next; it does not run it. The two halves have
different failure modes and different blast radii, and a wrapper that ran both would have to
collapse their exit codes into one — which is the thing this whole task exists to prevent.

**Publishing an image is not deploying it.** A `v*` tag publishes pinned multi-arch images to
GHCR and creates a Release, and stops. `demo.tarrow.org` runs whatever tag is pinned in the
private `infinitynode.media` repository and moves only when that line changes and the Ansible
playbook runs. Between 2026-08-06 and 2026-08-11 the second half was never done and the origin
served five-day-old code, healthy and answering the whole time.

---

## Step 1 — cut the release

```sh
node scripts/release-tarrow.mjs --dry-run    # always safe; writes nothing
node scripts/release-tarrow.mjs
```

It reads the tag list from the local checkout **and** from the remote and takes the union —
neither alone is sufficient, since a tag pushed by somebody else is invisible here until a
fetch and a tag created locally is invisible to the remote. From the highest `vX.Y.Z` it
derives the next unused patch, prints the reasoning that got it there, and refuses rather than
guessing when the answer is genuinely ambiguous.

Options that exist and why:

| | |
|---|---|
| `--dry-run` | Prints the version it would cut and stops. No tag, no push, no API write. |
| `--version 0.2.0` | Patch derivation can never produce a minor or major. Without this you would be pushed back to a hand-typed `git tag`, which is the manual last mile this work removes. It goes through the same refuse-if-exists gate; it buys a different number, never a different rule. |
| `--message` / `-m` | The annotated tag's message. Defaults to `tarrow <tag>`. |
| `--no-wait` | Push and return without watching `release.yml`. |
| `--remote`, `--base-ref`, `--timeout` | Defaults `origin`, `main`, 1800s. |

### What it refuses, and why each refusal is load-bearing

**The tag already exists.** It never re-pushes and never force-moves a published version — not
with a flag, not when the existing tag's release is visibly broken. Its images may already be
pulled and running somewhere, and two instances must never be able to claim the same version
while running different code. These instances compute statutory distances; that is Principle
VII's pinning rule, and `docs/decisions/task-0025-pull-based-cd.md` §3 (*no moving tags*),
which the 2026-08-11 amendment explicitly left binding. Cut the next version instead.

**The working tree is dirty.** A tag records the *committed* state, so tagging from a dirty
tree publishes something other than what is on disk in front of you. The refusal prints the
`git status --porcelain` lines it saw.

**`HEAD` is not an ancestor of `origin/main`.** This is the one to understand. Under the
amended decision the PR review *is* the human checkpoint, so releasing a commit that has not
merged would publish code no PR approved — the checkpoint would simply not have happened. The
check is by ancestry rather than by branch name, deliberately: the substantive rule is that a
released commit went through review and merged, and a worktree on a differently-named branch
pointing at a merged commit satisfies that while `git branch --show-current` does not.

This is also why running the script from a feature branch during development refuses, which is
correct and not a nuisance. It is what a dry run on this branch prints today.

**Derivation is ambiguous.** No `vX.Y.Z` exists to derive from, or a pre-release tag sorts
above the highest release (`v0.2.0-rc1` exists, latest release is `v0.1.1`). Both "next patch"
and "the release those pre-releases lead to" are defensible; picking one silently is the guess
FR-003 forbids. Pass `--version`.

### Exit codes, and what a caller does about each

| Exit | Means | What you do |
|---|---|---|
| **0** | The tag was pushed and `release.yml`'s `release` job succeeded. With `--no-wait`: the tag was pushed, unwatched. With `--dry-run`: **the inspection ran** — *not* that the release would succeed. | Go to step 2. The script prints the exact `deploy-demo.sh` line. |
| **1** | **REFUSED before touching anything.** One of the refusals above. Nothing was created, nothing was pushed, nothing needs undoing. | Read the reason and fix it. Never route around it by cutting a different version. |
| **2** | Repository state changed and the release did not complete. Two shapes, both printed explicitly: the tag **was** pushed and `release.yml` failed; or the annotated tag was created locally and the **push** failed, in which case nothing is published and the local tag is left in place deliberately. | For a workflow failure: fix the failing job and re-run the run from the Actions tab. Do **not** delete and re-push the tag, and do not cut a new version to route around it. For a push failure: push the tag by hand or `git tag -d` it, then re-run. |
| **3** | The tag **was** pushed and the outcome could not be observed — no run appeared within 240s, the run's jobs could not be read, the wait timed out, or `gh` is unavailable / the remote is not GitHub. | Read the run by eye. This is not success: a release nobody watched land is a release nobody can say landed. Do not proceed to step 2 on the assumption it worked. |
| **4** | **UNANSWERABLE before acting** — the remote's tags could not be read, or an unexpected error. Nothing was created. | Fix connectivity or the checkout. An unanswerable check must never be read as a passing one. |

A `--dry-run` that *would* refuse still exits 0 and prints `WOULD REFUSE`. Read the output,
not the status. That is the one place the exit code is not a claim about the release, and it
says so in its own output.

### What it watches, and what it deliberately does not

It waits for `release.yml`'s **`release`** job — the one that creates the Release object — not
for the whole run. The run ends with `verify-demo`, which polls the public origin for up to 20
minutes and is *expected* to fail until the pin has moved, which happens in step 2. Waiting on
it would block every release on a step that runs after this one. `verify-demo`'s state is
reported as still-pending rather than judged.

When the run fails, the report names the job that failed and lists what skipped as a
consequence, because "the release run failed" is exactly the sentence that hid the `v0.1.1`
half-release: the failing job was `publish / no-moving-tags`, the images had already published,
and a skipped `release` job did not pass — it never ran.

---

## Step 2 — move the demo onto it

```sh
./scripts/deploy-demo.sh 0.1.2
./scripts/deploy-demo.sh 0.1.2 --dry-run    # resolve everything, deploy nothing
```

The version is required and takes no default — `v0.1.2` and `0.1.2` are the same claim, and
everything downstream uses the bare form because that is what `tarrow_image_tag:` holds. A
deploy that picks its own target cannot be checked against what was released, and `latest` is
rejected outright.

It resolves the infra repo in this order (plan D3): `$TARROW_INFRA_REPO` if set →
`~/projects/infinitynode.media` → nothing found. A **set-but-missing** `$TARROW_INFRA_REPO`
stops rather than falling through to the default: setting that variable is an operator naming
the repository to deploy from, so if it does not resolve the honest answer is *the thing you
named is not there*, not *deploying from somewhere else instead*. A typo would otherwise deploy
the demo from a repo nobody asked for, and the warning saying so would scroll past in an
automated sweep that by design nobody is watching.

It checks `node`, `curl`, and `scripts/verify-deployed-version.mjs` **before** anything moves.
A missing tool discovered after the pin moved would leave the origin changed and unverifiable,
which is the one state it must never produce.

### The seam: what it expects on the infra side

`deploy-demo.sh` does not move the pin and does not run Ansible. That logic lives in
`infinitynode.media`, which owns the vars file, the CI venv, `bw-run.sh`, and the asserted
`--limit misc` — three details each of which has cost an hour when guessed from outside.
Reimplementing them here would create a second definition of how tarrow deploys, and the two
would drift silently. That is the operator's ruling of 2026-08-11.

What it calls:

```
<infra repo>/scripts/deploy-tarrow.sh <bare-semver>
```

overridable with `$TARROW_INFRA_DEPLOY_SCRIPT` (a path *relative to the infra repo*) if that
repo names it something else. The script is expected to:

1. set `tarrow_image_tag: <version>` in
   `ansible/inventory/group_vars/docker_hosts/service_config.yml`,
2. commit that change,
3. run, from the `ansible/` directory with the CI venv active:
   `../scripts/bw-run.sh ansible-playbook playbooks/deploy-service.yml -e service=tarrow --limit misc`,

and exit 0 only when the playbook succeeded.

**This contract was invented here, by this work, on 2026-08-11. Nothing on the infra side
implements it yet.** It was not read off an existing script — it was written down as the
interface the two repositories will meet at, and the infra half is carded on the
`infinitynode.media` board as its TASK-51. Until that card lands, this is a contract waiting
for its other half, and whoever writes `deploy-tarrow.sh` is writing it against the paragraph
above. If they choose a different shape, this seam is what has to change with it.

### Verification, and why the order of it is not a style choice

After the playbook returns 0, the origin is checked from outside in two halves, and the second
is not optional.

`scripts/verify-deployed-version.mjs` answers *is this the code we shipped* by polling
`/version`. It cannot answer *is it working*: an instance with an empty or broken spatial
database serves a perfectly correct `/version`.

So three addresses follow, **positive case first**:

| Address | Expected | Proves |
|---|---|---|
| `1464 Garman Rd, Akron, OH 44313` | `inside a buffer` | geometry ran and **found** something |
| `6947 Riverview Rd, Peninsula, OH 44264` | `outside every buffer we checked` | an empty result reached **honestly** |
| `1 Public Square, Cleveland, OH 44113` | `could not find this address` | out-of-county **declined**, not silently answered |

A broken instance returns the *second* answer for every address. A check that sends only the
negative cases therefore passes cleanly on top of a broken instance, and the strongest thing
tarrow is allowed to say would be being said on no evidence. `1464 Garman Rd` must come back
inside a buffer before anything else is asked; if it does not, the run stops there and nothing
below it was run. That is Principle I applied, not a preference (spec FR-005).

Each address gets six attempts 15 seconds apart, which covers a database still reloading after
the deploy — it is rebuilt in full every time (Principle IV). Retrying delays reporting a
failure; it never converts one into a pass. All three requests are `POST`, so the address travels in the
body rather than a URL that would reach history and access logs, and all three are published
example addresses from `RELEASING.md` rather than user data (Principle III).

### Exit codes, and what a caller does about each

Three outcomes, never collapsed (spec FR-006). This is the part a caller must not paraphrase.

| Exit | Means | What you do |
|---|---|---|
| **0** — DEPLOYED | The pin moved, the playbook ran, and the live origin was verified from outside to serve that exact version **and** to be answering from data. With `--dry-run`: only that the preconditions resolve. | Nothing. This is the only exit that may be reported as deployed. |
| **1** — FAILED | The deploy ran and broke, the origin did not verify, an instance exists but could not be driven, or a required tool is missing. Includes: infra repo present but its deploy script missing or not executable; `$TARROW_INFRA_REPO` set to a directory that is not there; the infra script exited nonzero; the origin serves the wrong version; a three-address check did not come good. | Read the message — it names the exact path, exit status, or address involved. The demo may be on the old version, the new one, or part-way; the script does not guess and does not report a deploy it cannot verify. |
| **2** — USAGE | Called wrong. Nothing was attempted. **`--help` also exits 2**, since it is reached by asking for usage rather than by deploying. | Fix the invocation. |
| **3** — DECLINED | There is no instance to move: no infra repo anywhere. This is the self-hoster case — someone who has never spoken to us has no `infinitynode.media` and never will (Principle VII). | Nothing, if you are self-hosting: your release already happened, and the tag, the images and the GitHub Release never depended on this step. If you are the operator, check out the infra repo or set `$TARROW_INFRA_REPO`. |

**Why 3 is not 0 and not 1.** Zero would let a caller read *nothing to do* as *deployed*, which
is the invisible staleness this whole task closes. One would tell a self-hoster their setup is
broken when it is exactly right. And after the 2026-08-11 amendment, "main sits ahead of the
demo" no longer means the ordinary state it meant under the old policy — following a sweep it
means this step declined or failed, and the report has to be able to say which.

The exercised transcript of every one of these outcomes, with real exit codes, is
`specs/003-sweep-ends-live/degradation-evidence.md`.

---

## Open items, as of 2026-08-15

Two things are true right now that a reader will otherwise walk into.

**The infra-side deploy script does not exist yet, so step 2 currently exits 1.** On a machine
with `~/projects/infinitynode.media` checked out, `deploy-demo.sh` resolves the repo, looks for
`scripts/deploy-tarrow.sh`, does not find it, and fails with the exact path it wanted and the
contract above. It is carded on the `infinitynode.media` board as TASK-51. Until it lands, the
demo moves by following [`RELEASING.md`](RELEASING.md) by hand. Do not work around it by
inlining the playbook into a script in this repository — that creates the second definition of
how tarrow deploys that the seam exists to prevent.

**`v0.1.1` is a half-release, and this automation reports it rather than repairing it.** The
tag exists and both images are published and pullable, but `release.yml` run 31523860531 failed
at `publish / no-moving-tags` (a `latest` tag still existed at the time), which made the
`release` and `verify-demo` jobs skip. There is no GitHub Release object for `v0.1.1`. Every
run of `release-tarrow.mjs` prints it under `HALF-RELEASED TAGS` along with the fix, and never
performs it — creating that Release means writing to an existing version, which is the one
thing the script refuses to do, and a mechanism whose first act is an exception to its own rule
is not a rule. It is an operator one-liner:

```sh
gh release create v0.1.1 --title v0.1.1 --generate-notes --prerelease
```

`latest` has since been retired and `check-no-moving-tags.mjs` passes, so nothing blocks the
next release.

---

## Keeping this honest

This file and [`RELEASING.md`](RELEASING.md) describe the same deployment from two ends, and
`RELEASING.md`'s own *Keeping this honest* section is the rule they are both under: **if you
change how tarrow deploys, change it in both places in the same session** — and in
`infinitynode.media` too, which holds the authoritative playbook.

The facts here most likely to go stale are the infra-side script's path and argument shape,
which is a contract that has not been implemented yet, and the two open items above, which are
dated for exactly that reason.
