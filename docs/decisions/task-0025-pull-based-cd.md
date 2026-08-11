# TASK-0025: a version tag deploys, and the host pulls

**Status:** accepted, 2026-08-11
**Decides:** how a published image reaches `demo.tarrow.org`, and what may trigger that

Two decisions, taken together because the second constrains the first.

---

## 1. Only a version tag deploys

A `v*` tag deploys. A merge to `main` publishes images and does not deploy. Nothing else
deploys at all.

This is deliberately narrower than "deploy on green main", which was available and is the
usual default. The reason is what the demo *is*. `docs/deploy/self-hosting.md` describes it
as an instance run for the maintainers and a small number of invited people — but it is also
a real origin at a real hostname, and the reader this project is built for is a person on a
registry asking whether they are allowed to live somewhere. If anyone is ever handed a URL,
it is that one.

So the question "is this good enough to serve to that reader" gets a human answer. Cutting a
tag *is* that answer. A merge to `main` is a statement that the code is correct; a tag is a
statement that somebody decided it should be in front of people. Those are different claims
and the pipeline should not conflate them.

The consequence is accepted openly: `main` can sit ahead of the demo indefinitely, and that
is not drift. Drift is the demo sitting behind a *release* — which is the failure this task
exists to fix, where the site served pre-redesign code for five days after v0.1.0 shipped.

## 2. The host pulls; GitHub does not push

The deploy is performed by an agent running **on the demo host**, which polls GHCR for the
newest semver tag and reconciles the running composition to it. GitHub Actions does not
connect to the host, hold a key to it, or know it exists.

The alternative — push-based CD, an Actions job with an SSH key or a Cloudflare Access
service token — is the more common arrangement and was rejected on this project's own stated
grounds rather than on taste.

`docs/deploy/self-hosting.md` records that the demo's request path was deliberately
*shortened*: it used to run through a self-hosted tunnel server on a rented VPS and then a
reverse proxy whose access log recorded client IPs, and collapsing it to a single Cloudflare
Tunnel "removed two of them, and removed the inbound port and a hand-maintained routing file
at the same time." **There is no inbound path to that host, by choice.**

Push-based CD would have to undo that. Either an inbound port reappears, or a GitHub-held
credential gains the ability to execute on the host. Both add a party to the path and a
standing key that can reach the machine, in a project whose whole argument to its readers is
*we have minimised the parties in the path, go and check.* Adding one for the convenience of
a deploy would be exactly the kind of quiet trade the self-hosting doc refuses to make when
it insists on describing the arrangement actually run rather than the good one.

Checked rather than assumed, 2026-08-11: `gh secret list` and `gh variable list` on
`tarrowhq/tarrow` are both empty. No credential capable of reaching the host exists today, so
push-based CD would not be using an existing trust relationship — it would be creating the
first one.

Pulling costs nothing in that currency. The host already reaches out — it pulls images, and
its `cloudflared` connector dials out. One more outbound poll adds no party, no port, and no
key held by anyone else.

### What this decision costs, stated plainly

- **A deploy is not instantaneous.** It happens within one poll interval of the tag being
  published, not at the moment the release job finishes.
- **The Actions run cannot report the deploy's outcome.** GitHub does not learn whether the
  host succeeded; the deploy's record lives on the host and at the origin. This is why the
  verification reads the **live origin** rather than a job log — the check has to work from
  outside, which is also the only vantage point a stranger auditing the claim would have.
- **A broken host fails quietly from GitHub's point of view.** Mitigated by making the
  version legible at the origin (`/version`), so "is the demo stale" is a question anyone can
  answer in one request instead of a thing nobody notices for five days.

That last point is the actual fix. The outage this task closes was invisible not because
nothing was watching, but because *the site was up*: healthy, answering, serving old code.
Any check that stops at "it responded" would have passed throughout.

## 3. No moving tags, anywhere

The agent resolves the newest **semver** tag and pins the composition to that exact version.
It never deploys `latest`, and `latest` is not published.

`docker-compose.deploy.yml` already refuses to start without an explicit `TARROW_IMAGE_TAG`
(no default, `:?` on all four services). CD supplies that value; it does not relax the
requirement. Two instances computing statutory distances must never be able to claim the same
version while running different code, which is the whole reason the pinning rule exists.

### The `latest` tag left over from v0.1.0, and why removing it needs care

The v0.1.0 release published a `latest` tag before PR #10 suppressed it. New publishes no
longer create one, but that tag still exists and is pinned forever at `0.1.0` — so anything
pulling `latest` is frozen at v0.1.0 and will never move again. That is precisely the drift
the no-moving-tag rule forbids, sitting in the registry.

**It must be removed by untagging, never by deleting the package version.** On GHCR,
`latest`, `0.1.0` and `sha-ff1094a` are three tags on ONE version object — verified by
digest, all three resolve to
`sha256:b49d84251d01941569d2c6c060125c0eeeb883ef617b0bfebe4061760484a1a2` on `tarrow-app`
(version id 1115104616; `tarrow-db` is 1115104330). GitHub's "delete package version" API
takes the version, not the tag. Calling it to get rid of `latest` would delete the v0.1.0
release images along with it — the release would survive as a note pointing at nothing.

Its absence is then enforced by `scripts/check-no-moving-tags.mjs` rather than remembered.

---

## Credential inventory

Written down because `docs/deploy/self-hosting.md` documents the request path honestly and
the deploy path should not be the one thing left vague.

| Credential | Held by | Can do | Cannot do |
|---|---|---|---|
| `GITHUB_TOKEN` (ephemeral, per-run) | GitHub Actions | Push images to GHCR; create a Release | Reach the demo host in any way |
| GHCR read token, or none | The demo host | Pull `tarrowhq/tarrow-*` | Write to the registry; reach GitHub Actions |
| Cloudflare Tunnel credential | The demo host's `cloudflared` | Dial out to Cloudflare's edge | Accept an inbound connection |

No credential in this table can reach the demo host from outside. That is the property being
bought, and it is the same property the request path was shortened to get.

The host's pull credential is needed **only while the packages are private** (TASK-0021).
When they are public it can be removed entirely, and the host will hold no registry
credential at all. This decision does not depend on which is true; it is simply better under
TASK-0021 than before it.
