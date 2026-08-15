#!/usr/bin/env bash
# Moves demo.tarrow.org onto a released version, and says honestly whether it did.
#
# Publishing an image is not deploying it. A `v*` tag publishes pinned images to
# GHCR and stops. demo.tarrow.org runs whatever tag is pinned in a *different,
# private* repository (`infinitynode.media`) and moves only when that line changes
# and an Ansible playbook runs. Between 2026-08-06 and 2026-08-11 the second half
# was never done: the origin served five-day-old code, healthy, answering every
# request. This script is the second half, run as one invocation.
#
# WHAT IT DOES NOT DO, ON PURPOSE
#
# It does not move the pin and it does not run Ansible. That logic lives in
# `infinitynode.media`, which owns the vars file, the CI venv, `bw-run.sh`, and the
# asserted `--limit misc` -- three details each of which has cost an hour when
# guessed from the outside. Reimplementing them here would create a second
# definition of "how tarrow deploys" that drifts from the real one silently.
# Operator ruling, 2026-08-11: the pin-bump script lives over there; tarrow calls
# it by path. See docs/decisions/task-0029-sweep-auto-release.md.
#
# THE INTERFACE THIS SCRIPT EXPECTS ON THE INFRA SIDE
#
#     <infra repo>/scripts/deploy-tarrow.sh <version>
#
# where <version> is a bare semver with no leading `v` (`0.1.2`), matching what
# `tarrow_image_tag:` holds. That script is expected to move the pin in
# ansible/inventory/group_vars/docker_hosts/service_config.yml, commit it, and run
# playbooks/deploy-service.yml -e service=tarrow --limit misc. It exits 0 when the
# playbook succeeded. As of 2026-08-11 it DOES NOT EXIST YET -- it is carded on the
# infra board (spec AC#5 / plan D2), and until it lands this script reports a
# failure naming the exact path it wanted. Override the path with
# $TARROW_INFRA_DEPLOY_SCRIPT (relative to the infra repo) if that repo names it
# something else; do not work around its absence by inlining the playbook here.
#
# THREE OUTCOMES, NEVER COLLAPSED (spec FR-006)
#
#   exit 0  DEPLOYED  the pin moved, the playbook ran, and the live origin was
#                     verified from outside to serve that exact version AND to be
#                     answering from data.
#   exit 3  DECLINED  there is no instance to move. This is the self-hoster case:
#                     someone who has never spoken to us has no
#                     `infinitynode.media` and never will (Constitution Principle
#                     VII). Not a failure -- but never silent, and never 0.
#   exit 1  FAILED    the deploy ran and broke, or the origin did not verify, or
#                     an instance exists but could not be reached/driven.
#   exit 2  USAGE     called wrong. Nothing was attempted.
#
# The distinction is load-bearing. After
# docs/decisions/task-0029-sweep-auto-release.md, "main sits ahead of the demo"
# no longer means the ordinary state it meant under the old policy -- following a
# sweep it means this step DECLINED or FAILED, and the caller has to be able to
# say which. A step that rounds either of them up to "deployed", or quietly does
# nothing and exits 0, recreates exactly the invisible staleness this work closes.
#
# USAGE
#
#     scripts/deploy-demo.sh 0.1.2
#     scripts/deploy-demo.sh v0.1.2 --timeout 600
#     scripts/deploy-demo.sh 0.1.2 --origin https://demo.tarrow.org
#     scripts/deploy-demo.sh 0.1.2 --dry-run   # resolve everything, deploy nothing
#
# --dry-run's exit 0 means "the preconditions resolve", NOT "deployed". It is the
# one place the exit codes above are not a claim about the origin, and it says so
# in its own output.

set -euo pipefail

# ---------------------------------------------------------------------------
# Outcomes as named constants, so no call site has to remember a bare number.
# ---------------------------------------------------------------------------
readonly EXIT_DEPLOYED=0
readonly EXIT_FAILED=1
readonly EXIT_USAGE=2
readonly EXIT_DECLINED=3

readonly DEFAULT_ORIGIN="https://demo.tarrow.org"
readonly DEFAULT_TIMEOUT=300
readonly DEFAULT_INFRA_HOME="${HOME:-/nonexistent-home}/projects/infinitynode.media"
readonly DEFAULT_DEPLOY_SCRIPT="scripts/deploy-tarrow.sh"

# Answer-check tuning. The database is a derived projection rebuilt in full on
# every deploy (Constitution Principle IV), so the app can be serving /version
# correctly while the spatial data is still loading. Retrying absorbs that;
# it never converts a failure into a pass, only delays reporting one.
readonly ANSWER_ATTEMPTS=6
readonly ANSWER_INTERVAL=15

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

log()  { printf '%s deploy-demo: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
warn() { printf '%s deploy-demo: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }

usage() {
  cat >&2 <<'EOF'
usage: scripts/deploy-demo.sh <version> [--origin URL] [--timeout SECONDS] [--dry-run]

  <version>   the released version to put in front of people, e.g. 0.1.2 or v0.1.2.
              Required. There is no default and no "latest": a deploy that picks
              its own target cannot be checked against what was released.

  --origin    the origin to verify from outside. Default https://demo.tarrow.org
  --timeout   seconds to poll /version for the new version. Default 300
  --dry-run   resolve the infra repo and its deploy script, print what would run,
              change nothing and verify nothing

exit 0 deployed and verified | 1 failed | 2 usage | 3 declined (no instance)
EOF
}

# ---------------------------------------------------------------------------
# Arguments
# ---------------------------------------------------------------------------
VERSION=""
ORIGIN="$DEFAULT_ORIGIN"
TIMEOUT="$DEFAULT_TIMEOUT"
DRY_RUN=0

while [ $# -gt 0 ]; do
  case "$1" in
    --origin)  ORIGIN="${2:-}"; shift 2 ;;
    --timeout) TIMEOUT="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit "$EXIT_USAGE" ;;
    -*)
      warn "unknown option: $1"
      usage
      exit "$EXIT_USAGE"
      ;;
    *)
      if [ -n "$VERSION" ]; then
        warn "unexpected second version argument: $1"
        usage
        exit "$EXIT_USAGE"
      fi
      VERSION="$1"
      shift
      ;;
  esac
done

if [ -z "$VERSION" ]; then
  warn "no version given. This script will not guess what belongs in front of people."
  usage
  exit "$EXIT_USAGE"
fi

# `v0.1.2` and `0.1.2` are the same claim. The tag carries the `v`; the pin and
# the image tag do not, so everything downstream of here uses the bare form.
VERSION="${VERSION#v}"

case "$VERSION" in
  [0-9]*.[0-9]*.[0-9]*) : ;;
  *)
    warn "'$VERSION' is not a full X.Y.Z version."
    warn "Only a released semver reaches the demo -- no moving tags, no branch names,"
    warn "no 'latest' (docs/decisions/task-0025-pull-based-cd.md §3, still binding)."
    exit "$EXIT_USAGE"
    ;;
esac

case "$TIMEOUT" in
  ''|*[!0-9]*) warn "--timeout must be a whole number of seconds, got '$TIMEOUT'"; exit "$EXIT_USAGE" ;;
esac

# ---------------------------------------------------------------------------
# Preflight, before anything is moved.
#
# A missing `node` or `curl` discovered AFTER the pin moved would leave the
# origin changed and unverifiable, which is the one state this script must never
# produce. So the tools verification needs are checked first.
# ---------------------------------------------------------------------------
command -v node >/dev/null 2>&1 || {
  warn "node not found. Verification runs scripts/verify-deployed-version.mjs, and a"
  warn "deploy this script cannot verify is a deploy it must not perform."
  exit "$EXIT_FAILED"
}
command -v curl >/dev/null 2>&1 || {
  warn "curl not found. The three-address check needs it."
  exit "$EXIT_FAILED"
}
[ -f "$REPO_ROOT/scripts/verify-deployed-version.mjs" ] || {
  warn "missing $REPO_ROOT/scripts/verify-deployed-version.mjs"
  exit "$EXIT_FAILED"
}

# ---------------------------------------------------------------------------
# Resolve the infra repo (plan D3): $TARROW_INFRA_REPO -> ~/projects/... -> none.
#
# On "none" this exits nonzero and prints every path it tried. It is deliberately
# NOT a silent success: a deploy step that quietly does nothing is precisely how a
# release comes to look deployed while the origin serves old code.
# ---------------------------------------------------------------------------
TRIED=()
INFRA_REPO=""

if [ -n "${TARROW_INFRA_REPO:-}" ]; then
  TRIED+=("$TARROW_INFRA_REPO   (from \$TARROW_INFRA_REPO)")
  if [ -d "$TARROW_INFRA_REPO" ]; then
    INFRA_REPO="$TARROW_INFRA_REPO"
  else
    # D3 is a fallback chain, so a set-but-missing override falls through rather
    # than stopping. Say so out loud: a typo in that variable would otherwise
    # deploy from a repo the operator did not name, and find out later.
    warn "\$TARROW_INFRA_REPO is set to '$TARROW_INFRA_REPO', which is not a directory."
    warn "Falling through to the default location. If that is not what you meant, stop now."
  fi
else
  TRIED+=("\$TARROW_INFRA_REPO   (not set)")
fi

if [ -z "$INFRA_REPO" ]; then
  TRIED+=("$DEFAULT_INFRA_HOME   (the default location)")
  if [ -d "$DEFAULT_INFRA_HOME" ]; then
    INFRA_REPO="$DEFAULT_INFRA_HOME"
  fi
fi

if [ -z "$INFRA_REPO" ]; then
  {
    echo
    echo "DECLINED: there is no instance to move."
    echo
    echo "The private infrastructure repository that pins what demo.tarrow.org runs"
    echo "could not be found. Every path tried, in order:"
    echo
    for p in "${TRIED[@]}"; do
      echo "    $p"
    done
    echo
    echo "IF YOU ARE SELF-HOSTING, THIS IS EXPECTED AND IS NOT AN ERROR IN YOUR SETUP."
    echo "\`infinitynode.media\` is the private repo that deploys OUR demo instance. You"
    echo "do not have it, you cannot get it, and you do not need it: tarrow is deployable"
    echo "in full from this repository alone (Constitution Principle VII). The release"
    echo "itself -- the tag, the multi-arch images, the GitHub Release -- does not depend"
    echo "on this step and has already happened. See docs/deploy/RELEASING.md,"
    echo "\"Deploying without the infra repo\", for how to move your own instance."
    echo
    echo "IF YOU ARE THE OPERATOR, check out the infra repo or set \$TARROW_INFRA_REPO."
    echo
    echo "Version $VERSION was NOT deployed to $ORIGIN, and this run is reporting"
    echo "\"declined\" -- not \"deployed\", and not \"failed\". After"
    echo "docs/decisions/task-0029-sweep-auto-release.md, main sitting ahead of the demo"
    echo "following a sweep means this step declined or failed; this is the declined one."
  } >&2
  exit "$EXIT_DECLINED"
fi

DEPLOY_SCRIPT_REL="${TARROW_INFRA_DEPLOY_SCRIPT:-$DEFAULT_DEPLOY_SCRIPT}"
DEPLOY_SCRIPT="$INFRA_REPO/$DEPLOY_SCRIPT_REL"

# The repo is here but its deploy script is not. That is a FAILURE, not a decline:
# an instance exists and we cannot move it. Rounding this down to "declined" would
# tell an operator "nothing to do" about the one machine they are responsible for.
if [ ! -x "$DEPLOY_SCRIPT" ]; then
  {
    echo
    echo "FAILED: the infra repo is here, but its tarrow deploy script is not."
    echo
    echo "    infra repo:     $INFRA_REPO"
    echo "    wanted:         $DEPLOY_SCRIPT"
    if [ -e "$DEPLOY_SCRIPT" ]; then
      echo "    problem:        the file exists but is not executable"
    else
      echo "    problem:        no such file"
    fi
    echo "    override with:  \$TARROW_INFRA_DEPLOY_SCRIPT (path inside the infra repo)"
    echo
    echo "That script owns the pin bump and the playbook run, by the operator ruling of"
    echo "2026-08-11 (docs/decisions/task-0029-sweep-auto-release.md). It is expected to"
    echo "take one argument, a bare semver, and to:"
    echo
    echo "    1. set tarrow_image_tag: <version> in"
    echo "       ansible/inventory/group_vars/docker_hosts/service_config.yml"
    echo "    2. commit that change"
    echo "    3. run, from the ansible/ directory with the CI venv active:"
    echo "       ../scripts/bw-run.sh ansible-playbook playbooks/deploy-service.yml \\"
    echo "         -e service=tarrow --limit misc"
    echo
    echo "As of 2026-08-11 it had not been written; it is carded on the infra board."
    echo "Do not work around this by running the playbook by hand from a script here --"
    echo "that creates a second definition of how tarrow deploys, and the two drift."
    echo "To deploy right now, follow docs/deploy/RELEASING.md by hand."
    echo
    echo "Version $VERSION was NOT deployed to $ORIGIN."
  } >&2
  exit "$EXIT_FAILED"
fi

# ---------------------------------------------------------------------------
# Dry run stops here, having proved only that the preconditions resolve.
# ---------------------------------------------------------------------------
if [ "$DRY_RUN" -eq 1 ]; then
  log "DRY RUN -- nothing was deployed and nothing was verified."
  log "would run: $DEPLOY_SCRIPT $VERSION"
  log "would then verify $ORIGIN serves $VERSION, and answers three addresses."
  log "exit 0 here means the preconditions resolve. It does not mean deployed."
  exit "$EXIT_DEPLOYED"
fi

# ---------------------------------------------------------------------------
# Move the pin and run the playbook -- over there.
# ---------------------------------------------------------------------------
log "infra repo: $INFRA_REPO"
log "delegating pin bump and playbook to $DEPLOY_SCRIPT_REL for version $VERSION"

# `set -e` is suspended for exactly this call so its real exit status survives to
# be reported. `if ! cmd` would swallow it -- inside that branch `$?` is the
# status of the negation, which is always 0, and a failure report naming exit
# code 0 is worse than none.
status=0
"$DEPLOY_SCRIPT" "$VERSION" || status=$?

if [ "$status" -ne 0 ]; then
  {
    echo
    echo "FAILED: the infra deploy script exited $status."
    echo
    echo "    ran: $DEPLOY_SCRIPT $VERSION"
    echo
    echo "Its output above is the authoritative account of what happened. The demo may be"
    echo "on the old version, on the new one, or part-way; this script does not guess, and"
    echo "it does not report a deploy it cannot verify. Read that output, then check the"
    echo "origin yourself:"
    echo
    echo "    node scripts/verify-deployed-version.mjs --expect $VERSION --origin $ORIGIN"
  } >&2
  exit "$EXIT_FAILED"
fi

# ---------------------------------------------------------------------------
# Verify from outside. Two halves, and the second is not optional.
#
# /version answers "is it the code we shipped". It cannot answer "is it working",
# because an instance with an empty or broken spatial database serves a perfectly
# correct /version. That is what the three addresses are for.
# ---------------------------------------------------------------------------
log "playbook finished; verifying $ORIGIN from outside"

if ! node "$REPO_ROOT/scripts/verify-deployed-version.mjs" \
     --expect "$VERSION" --origin "$ORIGIN" --timeout "$TIMEOUT"; then
  {
    echo
    echo "FAILED: the playbook succeeded but $ORIGIN is not serving $VERSION."
    echo
    echo "The pin has moved. A successful playbook run and a serving origin are different"
    echo "claims, and this is the gap between them -- the image did not pull, the container"
    echo "did not come up, or it came up on something else. Do not treat a 200 from the"
    echo "site as evidence against this."
  } >&2
  exit "$EXIT_FAILED"
fi

# ---------------------------------------------------------------------------
# The three addresses, POSITIVE CASE FIRST.
#
# This ordering is a Principle I requirement, not a style choice (spec FR-005). A
# broken instance -- empty database, failed ETL, geometry not running -- returns
# "outside every buffer we checked" for EVERY address. So a check that only sends
# addresses expecting that answer passes cleanly while the instance is broken, and
# the strongest thing tarrow is allowed to say would be being said on no evidence.
#
# `1464 Garman Rd` must come back INSIDE A BUFFER before anything else is asked.
# If it does not, nothing below it means anything and the run stops there.
#
# All three return HTTP 200. The distinction is entirely in the body. The
# addresses and their expected answers are the table in docs/deploy/RELEASING.md.
# They are published example addresses, not user data (Principle III).
# ---------------------------------------------------------------------------
ADDRESSES=(
  "1464 Garman Rd, Akron, OH 44313|inside a buffer|geometry ran and FOUND something -- the positive case"
  "6947 Riverview Rd, Peninsula, OH 44264|outside every buffer we checked|an empty result reached honestly"
  "1 Public Square, Cleveland, OH 44113|could not find this address|out-of-county declined, not silently answered"
)

ask() {
  # Sends one address and prints the body. POST, because the address travels in
  # the request body rather than a URL that would reach history and access logs.
  curl -sS --max-time 30 -X POST "$ORIGIN/answer" \
    --data-urlencode "address=$1" 2>/dev/null
}

check_address() {
  local address="$1" expected="$2" proves="$3"
  local attempt=1 body=""

  while [ "$attempt" -le "$ANSWER_ATTEMPTS" ]; do
    body="$(ask "$address" || true)"
    if printf '%s' "$body" | grep -qi -- "$expected"; then
      log "ok: '$address' -> '$expected' ($proves)"
      return 0
    fi
    if [ "$attempt" -lt "$ANSWER_ATTEMPTS" ]; then
      log "not yet: '$address' has not said '$expected'; retry $attempt/$ANSWER_ATTEMPTS in ${ANSWER_INTERVAL}s"
      sleep "$ANSWER_INTERVAL"
    fi
    attempt=$((attempt + 1))
  done

  {
    echo
    echo "FAILED: $ORIGIN is serving $VERSION but is not answering correctly."
    echo
    echo "    address:   $address"
    echo "    expected:  $expected"
    echo "    proves:    $proves"
    echo "    got:       $(printf '%s' "$body" | grep -io 'Result: [^<\"]*\|No result: [^<\"]*' | head -n 1 || true)"
    echo
    echo "Polled for $((ANSWER_ATTEMPTS * ANSWER_INTERVAL))s, which covers a database still reloading"
    echo "after the deploy (it is rebuilt in full every time). This one did not come good."
    if [ "$expected" = "inside a buffer" ]; then
      echo
      echo "THIS IS THE POSITIVE CASE, AND IT IS THE ONE THAT MATTERS MOST. An instance with"
      echo "no data answers 'outside every buffer we checked' for everything, so the other"
      echo "two checks would have passed on top of a broken instance. They were not run."
    fi
    echo
    echo "The version is deployed. It is NOT verified, and this run reports failed."
  } >&2
  return 1
}

for row in "${ADDRESSES[@]}"; do
  IFS='|' read -r address expected proves <<< "$row"
  check_address "$address" "$expected" "$proves" || exit "$EXIT_FAILED"
done

log "DEPLOYED: $ORIGIN serves $VERSION and answers all three addresses correctly."
exit "$EXIT_DEPLOYED"
