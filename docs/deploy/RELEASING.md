# Releasing tarrow, and getting it onto demo.tarrow.org

**This is the whole procedure. You do not need any other repository checked out to follow it.**

The deployment is driven by Ansible from a *separate private repository*
(`infinitynode.media`), and that has been the single biggest source of confusion about this
project — three separate times, someone has had to work out where the deploy lives before
they could do a release. So the facts that live over there are **copied here**, not linked
to. If the two ever disagree, that is a bug in whichever one was edited without the other;
see [Keeping this honest](#keeping-this-honest) at the bottom.

---

## The one-paragraph version

Publishing an image is not deploying it. A `v*` tag builds and publishes pinned, multi-arch
images to GHCR and creates a GitHub Release — and stops there. The demo instance runs
whatever image tag is **pinned in the infrastructure repository's Ansible vars**, and it
moves only when somebody changes that line and runs the deploy playbook. If you cut a
release and do not do the second half, `demo.tarrow.org` keeps serving exactly what it served
before, healthy and answering, for as long as you leave it.

That is not hypothetical. It is what happened between 2026-08-06 and 2026-08-11.

---

## Two ways to do this, and which one you want

Since 2026-08-11 there are two scripts that do everything below —
`scripts/release-tarrow.mjs` for the release and `scripts/deploy-demo.sh` for the demo — and
**they are the preferred path.** They exist because the steps in this document are not the hard
part; what a person skips while typing them is. Their runbook, including every exit code and
what a caller does about each, is
[`docs/deploy/automated-release.md`](automated-release.md).

Keep reading here anyway if you want to know what those scripts *do*, if one of them refuses
and you need to understand why, or if you are deploying by hand — which the automated path
cannot yet do end to end (its infra-side half is not written; see *Open items* in that file).
This document remains the fallback and the explanation, and it is still true.

---

## Where the deployment actually lives

| | |
|---|---|
| **Infra repository** | `infinitynode.media` (private) |
| **Runbook there** | `docs/runbooks/tarrow-deploy.md` — longer than this, covers first-time setup, the Cloudflare Tunnel, and the LAN name |
| **Host** | `misc`, also `vm-103`, reachable as `coda@vm-103.local.infinity-node.win` |
| **Stack source** | `services/misc/tarrow/` in the infra repo |
| **Deployed to** | `/opt/stacks/tarrow/` on the host |
| **The pinned tag** | `tarrow_image_tag:` in `ansible/inventory/group_vars/docker_hosts/service_config.yml` |
| **Public path** | `tarrow-cloudflared` dials **out** to Cloudflare. No inbound port, no Traefik route, no published socket. |
| **Secrets** | Vaultwarden item `tarrow`: `postgres_password`, `app_password`, `cf_tunnel_token` |

**The pinned tag is the thing people forget.** It is a single line in a file in another
repository, and it is the only thing that decides what the public sees.

---

## Cutting a release

**The current way:**

```sh
node scripts/release-tarrow.mjs --dry-run    # prints the version it would cut; writes nothing
node scripts/release-tarrow.mjs
```

It derives the next unused patch from the highest existing `vX.Y.Z` — reading the tag list from
both the local checkout and the remote — refuses if that tag already exists, refuses on a dirty
tree, refuses if `HEAD` has not merged to `origin/main`, then cuts and pushes the annotated tag
and watches the workflow, naming the job that failed if one does. It does not switch branches
or pull for you; it checks that you are somewhere releasable and declines if you are not.
[`automated-release.md`](automated-release.md) has its exit codes and every refusal.

**What it does, and the manual equivalent.** From this repository, on `main`, with the working
tree clean:

```sh
git switch main && git pull
git tag -a v0.1.1 -m "What changed, in one line"
git push origin v0.1.1
```

Do this when the script refuses for a reason you have decided is wrong, or when you have no
`node`. Understand what you are stepping around first: those refusals are the only checkpoint
left. Under `docs/decisions/task-0029-sweep-auto-release.md` (accepted 2026-08-11) cutting a
tag is no longer a person deciding this should be in front of readers — the PR review is that
decision, and the tag is machinery. Which means a tag pushed from an unmerged commit publishes
code no PR approved, and nothing downstream will catch it.

Either way, the push fires `.github/workflows/release.yml`, which:

1. calls `publish-images.yml` (parity check → multi-arch build → push → smoke test),
2. publishes `0.1.1` **and** `sha-<short>` for both `tarrow-app` and `tarrow-db`,
3. creates the GitHub Release, marked pre-release automatically below `1.0.0`,
4. runs `verify-demo`, which polls `https://demo.tarrow.org/version` for up to 20 minutes.

**`verify-demo` will fail until you do the second half below.** That is deliberate — it is
the alarm for exactly the failure this document exists to prevent. It is
`continue-on-error`, so it does not invalidate the release or the images.

Check the tags landed:

```sh
node scripts/check-no-moving-tags.mjs        # also asserts no `latest` crept in
```

---

## Getting it onto the demo — the half that is easy to skip

You need the `infinitynode.media` repository for this. **If you do not have it checked out,
skip to [Deploying without the infra repo](#deploying-without-the-infra-repo).**

**The intended way is one command**, which does steps 1 through 3 below and refuses to call it
deployed unless the live origin proves it:

```sh
./scripts/deploy-demo.sh 0.1.1
```

**It does not work yet**, and this is the one place the automated path is genuinely incomplete.
It delegates the pin bump and the playbook to `<infra repo>/scripts/deploy-tarrow.sh`, which
has not been written — it is carded on the `infinitynode.media` board as TASK-51. Run today it
resolves the infra repo, does not find that script, and exits 1 naming the path it wanted. So
the steps below are the procedure until that card lands, and they are what the infra-side
script will do once it exists.

```sh
cd ~/projects/infinitynode.media
```

**1. Move the pin.** Edit
`ansible/inventory/group_vars/docker_hosts/service_config.yml`:

```yaml
tarrow_image_tag: 0.1.1        # was: sha-785b71f
```

Either a full semver (`0.1.1`) or an immutable `sha-<short>` is valid. There is deliberately
no `latest` to float onto.

**2. Run the playbook.** Three details, each of which has cost an hour before:

```sh
cd ~/projects/infinitynode.media/ansible     # NOT the repo root — ansible.cfg only
                                             # auto-loads from the current directory, and
                                             # from the root you get "no hosts matched"
source ../.venv-ci/bin/activate              # or: exec: ansible-playbook: not found
../scripts/bw-run.sh ansible-playbook playbooks/deploy-service.yml \
  -e service=tarrow --limit misc             # --limit is asserted; without it the play refuses
```

This copies the stack to `/opt/stacks/tarrow/`, renders `.env` as `root:root` `0600`, and
brings up `tarrow-db` → `tarrow-migrate` (exits 0) → `tarrow-app` → `tarrow-cloudflared`.

**3. Verify — and do not accept a 200 as the answer.**

```sh
curl -s https://demo.tarrow.org/version
```

That must report the version you just deployed. `/version` exists precisely because a stale
instance is a *working* instance: every health check passed for five days while the site
served five-day-old code.

```sh
node scripts/verify-deployed-version.mjs --expect 0.1.1
```

**Then check it is answering from data**, which the version endpoint cannot tell you. Send
three addresses, positive case first:

| Address | Expected | Proves |
|---|---|---|
| `1464 Garman Rd, Akron, OH 44313` | `inside a buffer` | geometry ran and **found** something |
| `6947 Riverview Rd, Peninsula, OH 44264` | `outside every buffer we checked` | an empty result reached **honestly** |
| `1 Public Square, Cleveland, OH 44113` | `could not find this address` | out-of-county **declined**, not silently answered |

A broken instance returns the *second* answer for every address, so a negative-only check
reads as a pass. All three return `200`; the distinction is entirely in the body.

```sh
curl -sS -X POST https://demo.tarrow.org/answer \
  --data-urlencode 'address=1464 Garman Rd, Akron, OH 44313' | grep -i 'result'
```

This table is where `deploy-demo.sh` gets its checks — same three addresses, same order, same
expected strings. If you change a row here, change it there.

---

## Deploying without the infra repo

Everything above needs `infinitynode.media`. This section does not — it is the same
deployment, driven by hand, and is what to use when you have only this repository.

```sh
ssh coda@vm-103.local.infinity-node.win
cd /opt/stacks/tarrow
sudo -e .env                    # set TARROW_IMAGE_TAG=0.1.1
sudo docker compose up -d --pull always
```

**`sudo` is required for every `docker compose` here.** `.env` is `root:root` `0600` because
it holds the database passwords and the tunnel token; as `coda` you get
`open /opt/stacks/tarrow/.env: permission denied`. Do not "fix" it with `chown` or a looser
mode — the next Ansible run reverts it silently and the failure reappears looking new.

**This is a temporary state, not an alternative workflow.** Ansible re-renders `.env` from
its own template on the next deploy, so a hand-edited tag is overwritten the moment anyone
runs the playbook. Move the pin in the infra repo when you can, or the next deploy quietly
rolls the demo backwards.

---

## Things that will bite you

**The registry moved and the runbook over there may not say so.** Images are now
`ghcr.io/tarrowhq/tarrow-app` and `ghcr.io/tarrowhq/tarrow-db`. Anything naming
`ghcr.io/evanstern/*` is stale.

**The packages are private** (TASK-0021), and packages inherit the visibility of the
repository that published them. A renamed image publishes to a *brand new* package that
starts private even if the one it replaced was public for months — the workflow goes green,
because publishing succeeded, and the failure appears on the host as `denied` at pull time.
Both images are separate packages with separate settings pages; flipping one and assuming the
other followed is the easy mistake.

```sh
# From the host, costs nothing and does not pull:
docker manifest inspect ghcr.io/tarrowhq/tarrow-app:0.1.1 >/dev/null 2>&1 && echo OK || echo DENIED
```

**`0.1.0`'s images predate `/version`.** Deploying that tag leaves
`verify-deployed-version.mjs` reporting the endpoint missing — correctly. Any tag cut after
2026-08-11 has it.

**A `latest` tag existed from the v0.1.0 release, and has been retired.** While it was there it
failed `check-no-moving-tags.mjs` on every publish — which is what skipped the `release` job of
the `v0.1.1` run and left that version with published images and no GitHub Release. Verified
2026-08-15: both packages report ten tags and none moving. If one ever reappears,
`docs/deploy/removing-the-latest-tag.md` is the procedure, and it must be **untagged, never
deleted as a version** — `latest`, `0.1.0` and `sha-ff1094a` were three tags on one version
object, so deleting the version destroys the release images.

**`scripts/tarrow-deploy-agent.sh` and Ansible must not both be in charge.** The agent polls
the registry and self-updates; Ansible re-pins from its vars on every run. Running both means
each undoes the other. This deployment uses **Ansible** — the agent is for a self-hoster who
has no configuration management, and it is not installed on `misc`.

---

## Keeping this honest

The authoritative deployment lives in `infinitynode.media`. This file duplicates it on
purpose, because a procedure you cannot follow from the repository you are standing in is a
procedure that gets rediscovered from scratch every time — which is exactly what kept
happening.

**If you change how tarrow deploys, change it in both places in the same session.** The facts
most likely to drift are the pinned-tag path, the host name, and the playbook invocation.
Everything else here is stable.

There is now a third place: [`automated-release.md`](automated-release.md) and the two scripts
it documents. The same rule covers it — the three-address table above and the checks in
`scripts/deploy-demo.sh` are the same claim written twice, and the manual playbook invocation
above is what `<infra repo>/scripts/deploy-tarrow.sh` is contracted to run. A change to either
is a change to both.
