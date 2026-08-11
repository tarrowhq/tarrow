# Removing the `latest` tag left over from v0.1.0

**Status:** not yet done. One operator command, below. The check that enforces its absence
(`scripts/check-no-moving-tags.mjs`) is live and currently **fails**, which is correct — the
tag is really there.

## What is wrong

The v0.1.0 release published `latest` on both packages before
`.github/workflows/publish-images.yml` was corrected to suppress it. New publishes no longer
create one, but the existing tag is pinned forever at `0.1.0` and will never move again.
Anything pulling `ghcr.io/tarrowhq/tarrow-app:latest` is silently frozen at v0.1.0 — the
exact drift the no-moving-tag rule exists to prevent, sitting in the registry.

Three separate documents said this could not happen while it had already happened. That is
why the rule is now a check against the registry rather than a sentence in a workflow.

## Why this is not a one-liner

**`latest`, `0.1.0` and `sha-ff1094a` are three tags on a single version object.** Verified
by digest, 2026-08-11:

| Package | Version id | Digest shared by all three tags |
|---|---|---|
| `tarrow-app` | `1115104616` | `sha256:b49d84251d01941569d2c6c060125c0eeeb883ef617b0bfebe4061760484a1a2` |
| `tarrow-db` | `1115104330` | `sha256:86d5b69aa88ce0f59f1593955ab5417b73b21662b376c076a605c6eaa80bf485` |

GitHub's "delete package version" API — and the *Delete version* button in the package
settings UI — takes the **version**, not the tag.

> **Deleting version 1115104616 or 1115104330 would delete the v0.1.0 release images.**
> The GitHub Release would survive as a note pointing at nothing, and
> `TARROW_IMAGE_TAG=0.1.0` would stop resolving for every self-hoster who followed the
> release instructions. This is the failure mode to avoid; it is not recoverable by
> re-tagging, because the images themselves would be gone.

So `latest` has to be **moved off** that version and onto a throwaway one, and only the
throwaway deleted.

## The procedure

Run from a machine with `docker` logged in to `ghcr.io` and a token carrying
`write:packages` and `delete:packages`.

```sh
# 1. Point `latest` at a throwaway manifest, so it no longer shares a version
#    object with the release. `scratch` is empty -- nothing is published that
#    anyone could run by accident.
printf 'FROM scratch\n' > /tmp/Dockerfile.retire
for image in tarrow-app tarrow-db; do
  docker buildx build --push \
    -t "ghcr.io/tarrowhq/${image}:latest" \
    -f /tmp/Dockerfile.retire /tmp
done

# 2. Confirm `latest` no longer resolves to the release digest, and that
#    0.1.0 and sha-ff1094a still do. DO NOT SKIP THIS.
for image in tarrow-app tarrow-db; do
  for tag in latest 0.1.0 sha-ff1094a; do
    printf '%s:%s -> ' "$image" "$tag"
    docker buildx imagetools inspect --raw "ghcr.io/tarrowhq/${image}:${tag}" \
      | sha256sum | cut -c1-16
  done
done

# 3. Only now, delete the throwaway version that `latest` points at -- NOT the
#    version carrying 0.1.0. Read the tag list in the output before deleting.
gh api "/orgs/tarrowhq/packages/container/tarrow-app/versions" \
  --jq '.[] | select(.metadata.container.tags | index("latest")) | {id, tags: .metadata.container.tags}'
# Verify the printed tags are ["latest"] AND NOTHING ELSE, then:
# gh api -X DELETE "/orgs/tarrowhq/packages/container/tarrow-app/versions/<id>"

# ...and the same two steps for tarrow-db.

# 4. The check must now pass.
node scripts/check-no-moving-tags.mjs
```

Step 3's guard is the whole safety of this: if the version you are about to delete carries
any tag besides `latest`, stop — you are looking at the release.

## Why it was left for an operator

Attempted 2026-08-11 during TASK-0025 and deliberately not completed. The raw registry
`DELETE` was refused by a safety check on the grounds that the target digest was shared with
the published release, which was the correct call: the mechanism had not been proven safe on
this registry, and the blast radius of getting it wrong is every self-hoster's
`TARROW_IMAGE_TAG=0.1.0`.

Nothing was deleted, moved, or re-tagged. The registry is exactly as it was.

The remaining risk of leaving it: anything already pulling `latest` stays frozen at v0.1.0.
Since there is no documented use of `latest` anywhere — every instruction in
`docs/deploy/self-hosting.md` and every release note pins an explicit tag, and
`docker-compose.deploy.yml` refuses to start without one — the realistic exposure is a
stranger who guessed at `:latest` out of habit. That is worth fixing, and it is not worth
risking the release images to fix in a hurry.
