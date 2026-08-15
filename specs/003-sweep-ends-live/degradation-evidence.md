# SC-004 — the absent-infra path, exercised

**Spec**: `spec.md` SC-004 / US3 / FR-006 · **Plan**: D3 · **Phase**: 3
**Run**: 2026-08-15, on branch `task-0029-sweep-ends-live`, from
`.claude/worktrees/task-0029`

SC-004 requires the absent-infra path to be **run**, not asserted, and its output recorded
as an artifact. This file is that record. Every transcript below is copied verbatim from a
real invocation of `scripts/deploy-demo.sh`; nothing here is reconstructed.

No deploy was performed and no tag was cut. The infra-side deploy script is stubbed where a
success path had to be shown, and that is stated at each place it applies.

---

## 1. DECLINED — a self-hoster, with no infra repo anywhere (US3, AC#6)

The constitutional case: Principle VII says tarrow must be deployable in full by someone who
has never spoken to us, and that person has no `infinitynode.media`. The run is done under
`env -i` with no `HOME`, so **neither** resolution path can find anything — the closest
reachable stand-in for a stranger's machine.

```
$ env -i PATH=/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin \
    TARROW_INFRA_REPO=/nonexistent/path \
    /bin/bash ./scripts/deploy-demo.sh 0.1.2
```

```
2026-08-15T18:55:42Z deploy-demo: $TARROW_INFRA_REPO is set to '/nonexistent/path', which is not a directory.
2026-08-15T18:55:42Z deploy-demo: Falling through to the default location. If that is not what you meant, stop now.

DECLINED: there is no instance to move.

The private infrastructure repository that pins what demo.tarrow.org runs
could not be found. Every path tried, in order:

    /nonexistent/path   (from $TARROW_INFRA_REPO)
    /nonexistent-home/projects/infinitynode.media   (the default location)

IF YOU ARE SELF-HOSTING, THIS IS EXPECTED AND IS NOT AN ERROR IN YOUR SETUP.
`infinitynode.media` is the private repo that deploys OUR demo instance. You
do not have it, you cannot get it, and you do not need it: tarrow is deployable
in full from this repository alone (Constitution Principle VII). The release
itself -- the tag, the multi-arch images, the GitHub Release -- does not depend
on this step and has already happened. See docs/deploy/RELEASING.md,
"Deploying without the infra repo", for how to move your own instance.

IF YOU ARE THE OPERATOR, check out the infra repo or set $TARROW_INFRA_REPO.

Version 0.1.2 was NOT deployed to https://demo.tarrow.org, and this run is reporting
"declined" -- not "deployed", and not "failed". After
docs/decisions/task-0029-sweep-auto-release.md, main sitting ahead of the demo
following a sweep means this step declined or failed; this is the declined one.
```

**Exit code: 3 (DECLINED).** Not 0, so no caller can read it as a deploy; not 1, so no
self-hoster is told their setup is broken. Every path tried is named, in order.

`/nonexistent-home/...` is the placeholder the script substitutes when `$HOME` is unset —
the `env -i` artefact, not a real path. On a machine with a `$HOME` the second line reads
`~/projects/infinitynode.media`.

---

## 2. FAILED — the infra repo is present, its deploy script is not

Distinct from case 1 on purpose, and the distinction is the point of FR-006. An instance
exists here and could not be moved. Reporting "declined" would tell the operator there was
nothing to do about the one machine they are responsible for.

This is also **the live state of this repo today**: the infra-side
`scripts/deploy-tarrow.sh` does not exist yet — it is carded on the `infinitynode.media`
board (ruling 3 / AC#5). The `$TARROW_INFRA_REPO` override is set to a nonexistent path to
show the D3 fallthrough; the resolved repo is the real checkout.

```
$ TARROW_INFRA_REPO=/nonexistent/path ./scripts/deploy-demo.sh 0.1.2
```

```
2026-08-15T18:55:46Z deploy-demo: $TARROW_INFRA_REPO is set to '/nonexistent/path', which is not a directory.
2026-08-15T18:55:46Z deploy-demo: Falling through to the default location. If that is not what you meant, stop now.

FAILED: the infra repo is here, but its tarrow deploy script is not.

    infra repo:     /Users/evanstern/projects/infinitynode.media
    wanted:         /Users/evanstern/projects/infinitynode.media/scripts/deploy-tarrow.sh
    problem:        no such file
    override with:  $TARROW_INFRA_DEPLOY_SCRIPT (path inside the infra repo)

That script owns the pin bump and the playbook run, by the operator ruling of
2026-08-11 (docs/decisions/task-0029-sweep-auto-release.md). It is expected to
take one argument, a bare semver, and to:

    1. set tarrow_image_tag: <version> in
       ansible/inventory/group_vars/docker_hosts/service_config.yml
    2. commit that change
    3. run, from the ansible/ directory with the CI venv active:
       ../scripts/bw-run.sh ansible-playbook playbooks/deploy-service.yml \
         -e service=tarrow --limit misc

As of 2026-08-11 it had not been written; it is carded on the infra board.
Do not work around this by running the playbook by hand from a script here --
that creates a second definition of how tarrow deploys, and the two drift.
To deploy right now, follow docs/deploy/RELEASING.md by hand.

Version 0.1.2 was NOT deployed to https://demo.tarrow.org.
```

**Exit code: 1 (FAILED).** The message names the exact path wanted and the interface
expected of it, so whoever writes the infra-side script has the contract without reading
this one.

---

## 3. The positive-case-first check catches a broken instance (FR-005, SC-003)

The safety claim under Principle I is that a **negative-only** verification passes while the
instance is broken. Exercised against a local stub serving a correct `/version` and an empty
spatial database — every address gets "outside every buffer we checked", which is exactly
what a broken instance does:

```
$ node /tmp/broken-instance.mjs &          # correct /version, no data
$ TARROW_INFRA_REPO=/tmp/fake-infra \
    ./scripts/deploy-demo.sh 0.1.2 --origin http://127.0.0.1:8811 --timeout 0
```

(`/tmp/fake-infra/scripts/deploy-tarrow.sh` is a stub that echoes and exits 0. Nothing was
deployed.)

```
2026-08-15T18:54:16Z deploy-demo: playbook finished; verifying http://127.0.0.1:8811 from outside
http://127.0.0.1:8811 serves 0.1.2 (revision deadbeef) -- as expected.
2026-08-15T18:54:16Z deploy-demo: not yet: '1464 Garman Rd, Akron, OH 44313' has not said 'inside a buffer'; retry 1/6 in 15s
[... retries 2-5 ...]

FAILED: http://127.0.0.1:8811 is serving 0.1.2 but is not answering correctly.

    address:   1464 Garman Rd, Akron, OH 44313
    expected:  inside a buffer
    proves:    geometry ran and FOUND something -- the positive case
    got:       Result: outside every buffer we checked

THIS IS THE POSITIVE CASE, AND IT IS THE ONE THAT MATTERS MOST. An instance with
no data answers 'outside every buffer we checked' for everything, so the other
two checks would have passed on top of a broken instance. They were not run.

The version is deployed. It is NOT verified, and this run reports failed.
```

**Exit code: 1 (FAILED).** `/version` passed. Both negative-case addresses would have
passed. The positive case is the only thing that caught it, which is the whole reason FR-005
fixes the order.

---

## 4. The three expected answers, read from the live origin

`RELEASING.md`'s verification table gives three expected answers. Confirmed against
`https://demo.tarrow.org` (currently serving `0.1.1`), so the strings the script greps for
are the strings the running application actually emits — not remembered from the doc.

| Address | HTTP | Body says |
|---|---|---|
| `1464 Garman Rd, Akron, OH 44313` | 200 | `Result: inside a buffer tarrow checked` |
| `6947 Riverview Rd, Peninsula, OH 44264` | 200 | `Result: outside every buffer we checked` |
| `1 Public Square, Cleveland, OH 44113` | 200 | `No result: tarrow could not find this address` |

All three are 200; the distinction is entirely in the body, as `RELEASING.md` says. The
script matches on the substring `inside a buffer` for the first, and it was confirmed that
neither of the other two bodies contains that substring — so the positive check cannot be
satisfied by a negative answer. These are published example addresses from the runbook, not
user data (Principle III).

Requests were sent to the origin; nothing was deployed and no pin was moved.

---

## 5. Full outcome matrix, as exercised

| Case | Command | Exit | Reported as |
|---|---|---|---|
| No version argument | `./scripts/deploy-demo.sh` | 2 | usage — nothing attempted |
| `latest` as the version | `./scripts/deploy-demo.sh latest` | 2 | usage — no moving tags (§3) |
| No infra repo anywhere | case 1 above | **3** | **DECLINED** |
| Infra repo, no deploy script | case 2 above | **1** | **FAILED** |
| Infra script exits nonzero | stub exiting 7 | **1** | **FAILED**, naming exit 7 |
| Origin serves the wrong version | stub + `--expect 9.9.9` | **1** | **FAILED** — "serves 0.1.1, expected 9.9.9" |
| Origin correct, data broken | case 3 above | **1** | **FAILED** on the positive case |
| Everything correct | stub + live origin at `0.1.1` | **0** | **DEPLOYED** |
| `--dry-run` | stub infra repo | 0 | prints what it would run; states this is not a deploy claim |

The last success row was produced by pointing the script at a stub infra script and the real
origin at the version it already serves. It proves the verification half end-to-end. **No
deploy was performed at any point in this phase.**
