#!/bin/sh
# The deploy agent. Runs ON THE DEMO HOST; nothing outside reaches in.
#
# It asks the registry for the newest released version, and if the running
# composition is not on it, pins it there and restarts. That is the whole
# program.
#
# WHY THE HOST PULLS INSTEAD OF CI PUSHING
#
# docs/decisions/task-0025-pull-based-cd.md, in full. The short form: this
# host's request path was deliberately shortened until it had NO inbound port
# -- one Cloudflare Tunnel dialling out, nothing dialling in. Push-based CD
# would have to undo that, either by reopening a port or by giving a
# GitHub-held credential the ability to execute here. In a project whose whole
# argument is "we minimised the parties in the path, go and check", buying
# deploy convenience with a standing external key is the wrong trade. Polling
# adds no party, no port, and no key anybody else holds.
#
# WHAT IT WILL NOT DO
#
#   - It will not deploy `latest`, or any moving tag. It resolves a full semver
#     tag and pins TARROW_IMAGE_TAG to it. docker-compose.deploy.yml refuses to
#     start without an explicit tag and this supplies one; it does not relax it.
#   - It will not deploy from `main`. Only a released version reaches this host
#     (decision 1). A merge publishes an image; a human cutting a tag is what
#     says it should be in front of people.
#   - It will not roll forward on failure. If the new version does not come up
#     healthy, it puts the previous pin back and restores service on the last
#     version known to work, then exits non-zero.
#
# USAGE
#
#     tarrow-deploy-agent.sh              # one reconcile pass
#     tarrow-deploy-agent.sh --dry-run    # say what it would do, change nothing
#
# Run it from cron or a systemd timer; it is a single pass and exits. There is
# no daemon, so a crash cannot leave a half-deployed state running unattended.
#
#     */5 * * * * /opt/tarrow/tarrow-deploy-agent.sh >> /var/log/tarrow-deploy.log 2>&1
#
# Exit 0 = already current, or deployed and healthy. Exit 1 = deploy failed and
# the previous version was restored. Exit 2 = could not determine what to do
# (registry unreachable, malformed state) -- deliberately NOT 0, because an
# agent that cannot tell whether it is current must not report success.

set -eu

TARROW_DIR="${TARROW_DIR:-/opt/tarrow}"
COMPOSE_FILE="${COMPOSE_FILE:-$TARROW_DIR/docker-compose.deploy.yml}"
ENV_FILE="${ENV_FILE:-$TARROW_DIR/.env}"
REGISTRY_OWNER="${REGISTRY_OWNER:-tarrowhq}"
IMAGE="${IMAGE:-tarrow-app}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"

DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

log() { printf '%s tarrow-deploy: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { log "ERROR: $*"; exit 2; }

command -v docker >/dev/null 2>&1 || die "docker not found"
command -v curl   >/dev/null 2>&1 || die "curl not found"
[ -f "$COMPOSE_FILE" ] || die "no compose file at $COMPOSE_FILE"
[ -f "$ENV_FILE" ]     || die "no env file at $ENV_FILE (it holds the database passwords)"

# ---------------------------------------------------------------------------
# What is the newest RELEASED version?
#
# Read from the registry's tag list, and filtered to full semver -- X.Y.Z and
# nothing else. `latest` is ignored even if present, `sha-<short>` tags are
# ignored (they are every build, not every release), and a bare `1` or `1.2`
# series tag is ignored because it could be re-pointed later.
#
# GHCR needs a bearer token even for a public read; for a private package the
# request is authenticated with a read-only PAT in $GHCR_TOKEN. Once TASK-0021
# makes the packages public, GHCR_TOKEN can be removed entirely and this host
# will hold no registry credential at all.
# ---------------------------------------------------------------------------
scope="repository:${REGISTRY_OWNER}/${IMAGE}:pull"
token_url="https://ghcr.io/token?service=ghcr.io&scope=${scope}"

if [ -n "${GHCR_TOKEN:-}" ]; then
  basic=$(printf 'x:%s' "$GHCR_TOKEN" | base64 | tr -d '\n')
  bearer=$(curl -fsS -H "Authorization: Basic ${basic}" "$token_url" \
    | sed -n 's/.*"token":"\([^"]*\)".*/\1/p') || die "could not obtain a registry token"
else
  bearer=$(curl -fsS "$token_url" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p') \
    || die "could not obtain an anonymous registry token (is the package still private? set GHCR_TOKEN)"
fi
[ -n "$bearer" ] || die "registry returned an empty token"

tags=$(curl -fsS -H "Authorization: Bearer ${bearer}" \
  "https://ghcr.io/v2/${REGISTRY_OWNER}/${IMAGE}/tags/list") \
  || die "could not list tags for ${REGISTRY_OWNER}/${IMAGE}"

# Full semver only. `sort -V` picks the newest.
newest=$(printf '%s' "$tags" \
  | tr ',[]' '\n\n\n' \
  | sed -n 's/.*"\([0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\)".*/\1/p' \
  | sort -V \
  | tail -n 1)

[ -n "$newest" ] || die "no released (X.Y.Z) tag found for ${REGISTRY_OWNER}/${IMAGE} -- nothing to deploy"

current=$(grep '^TARROW_IMAGE_TAG=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)
log "newest released: ${newest}; currently pinned: ${current:-none}"

if [ "$current" = "$newest" ]; then
  # Pinned correctly -- but confirm it is actually RUNNING. A pin in .env that
  # never got applied (a failed restart, a host reboot mid-deploy) is exactly
  # the silent staleness this whole task exists to end.
  running=$(curl -fsS --max-time 10 http://127.0.0.1:3000/version 2>/dev/null \
    | sed -n 's/.*"version":"\([^"]*\)".*/\1/p' || true)
  if [ "$running" = "$newest" ]; then
    log "already serving ${newest}; nothing to do"
    exit 0
  fi
  log "pinned to ${newest} but serving '${running:-nothing}' -- reconciling"
fi

if [ "$DRY_RUN" -eq 1 ]; then
  log "DRY RUN: would deploy ${newest} (currently ${current:-none})"
  exit 0
fi

# ---------------------------------------------------------------------------
# Deploy, keeping the ability to go back.
#
# Every published tag is immutable, so "roll back" is just "pin the previous
# version again" -- no snapshot, no backup, nothing to restore. The database is
# a derived projection (Principle IV) and is not touched by a version change.
# ---------------------------------------------------------------------------
previous="$current"
backup="${ENV_FILE}.bak.$(date -u +%Y%m%d%H%M%S)"
cp "$ENV_FILE" "$backup"

pin() {
  if grep -q '^TARROW_IMAGE_TAG=' "$ENV_FILE"; then
    sed -i.tmp "s|^TARROW_IMAGE_TAG=.*|TARROW_IMAGE_TAG=$1|" "$ENV_FILE"
    rm -f "${ENV_FILE}.tmp"
  else
    printf 'TARROW_IMAGE_TAG=%s\n' "$1" >> "$ENV_FILE"
  fi
}

healthy() {
  waited=0
  while [ "$waited" -lt "$HEALTH_TIMEOUT" ]; do
    got=$(curl -fsS --max-time 10 http://127.0.0.1:3000/version 2>/dev/null \
      | sed -n 's/.*"version":"\([^"]*\)".*/\1/p' || true)
    [ "$got" = "$1" ] && return 0
    sleep 5
    waited=$((waited + 5))
  done
  return 1
}

log "deploying ${newest}"
pin "$newest"

if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --pull always \
   && healthy "$newest"; then
  log "deployed ${newest}; the origin serves it"
  rm -f "$backup"
  exit 0
fi

# ---------------------------------------------------------------------------
# It did not come up. Put the previous version back rather than leaving the
# host on a version that does not serve.
# ---------------------------------------------------------------------------
log "ERROR: ${newest} did not become healthy within ${HEALTH_TIMEOUT}s"

if [ -n "$previous" ]; then
  log "rolling back to ${previous}"
  pin "$previous"
  if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --pull always \
     && healthy "$previous"; then
    log "rolled back; the origin serves ${previous} again"
  else
    log "ERROR: ROLLBACK ALSO FAILED. The host is not serving. Env backup: ${backup}"
  fi
else
  log "no previous version to roll back to; leaving ${newest} pinned for diagnosis"
fi

exit 1
