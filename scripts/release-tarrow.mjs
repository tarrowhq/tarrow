#!/usr/bin/env node
// Derives the next version, cuts and pushes the tag, and watches release.yml
// do its half of the work.
//
// WHY THIS IS A SCRIPT AND NOT THREE LINES IN A RUNBOOK
//
// The three lines are already in docs/deploy/RELEASING.md and they are not the
// hard part. The hard part is everything a person skips when they type them by
// hand: checking that the version they picked is not already published, noticing
// that the workflow they just fired went red in a job whose failure silently
// skipped two others, and not rounding "the run finished" up to "the release
// exists".
//
// That is not hypothetical either. On 2026-08-11 `v0.1.1` was tagged by hand.
// The images published. Run 31523860531 then failed at `publish / no-moving-tags`
// (a `latest` tag still existed at the time), which made `release` and
// `verify-demo` skip. The result is a version that is tagged, whose images are
// pullable, and which has no GitHub Release object at all -- a half-release that
// looked like a red X on a run nobody read the jobs of. This script reports that
// shape by name instead of leaving it to be discovered.
//
// WHAT IT WILL NOT DO
//
// It never re-pushes or force-moves an existing tag. Not with a flag, not with
// an override, not when the existing tag's release is visibly broken. Under
// Principle VII's pinning rule two instances must never be able to claim the
// same version while running different code, and re-publishing a tag from a
// different tree is exactly that -- these instances compute statutory distances.
// See docs/decisions/task-0029-sweep-auto-release.md (D1 / NFR-003): the
// v0.1.1 half-release is REPORTED as an operator action, not repaired here. A
// mechanism whose first act is an exception to its own rule is not a rule.
//
// WHERE THIS SCRIPT'S JOB ENDS
//
// At "the release ran". Publishing an image is not deploying it: demo.tarrow.org
// runs whatever tag is pinned in the infrastructure repository and moves only
// when that pin moves. Moving it, running the playbook, and verifying the live
// origin belong to `scripts/deploy-demo.sh`. This script hands off to it by name
// and does not reach for the origin itself.
//
// It deliberately does NOT wait for release.yml's `verify-demo` job. That job
// polls the public origin for up to 20 minutes and is EXPECTED to fail until the
// pin has moved, so waiting on it would block every release on a step that runs
// after this one. The wait is satisfied when the `release` job completes -- that
// is what "the release ran" means -- and `verify-demo`'s state is reported as
// still-pending rather than judged.
//
// USAGE
//
//     node scripts/release-tarrow.mjs --dry-run
//     node scripts/release-tarrow.mjs
//     node scripts/release-tarrow.mjs --message "Statutory buffer rendering"
//     node scripts/release-tarrow.mjs --version 0.2.0     # minor/major, explicit
//     node scripts/release-tarrow.mjs --no-wait
//
// `--version` exists because patch derivation can never produce a minor or major
// release, and without it the operator would be pushed back to a hand-typed
// `git tag` -- reintroducing the manual last mile this work exists to remove. It
// goes through exactly the same refuse-if-exists gate as a derived version; it
// buys a different number, never a different rule.
//
// `--dry-run` prints the version it would cut and does nothing else: no tag, no
// push, no API write. Its exit code reports that the INSPECTION ran, not that the
// release would succeed -- anything that would block a real run is printed and
// marked `WOULD REFUSE`. Read the output, not the status.
//
// EXIT CODES (distinct on purpose; FR-006 -- outcomes are never collapsed)
//
//   0  the tag was pushed and release.yml's `release` job succeeded.
//      With --dry-run: the inspection ran. With --no-wait: the tag was pushed.
//   1  REFUSED before touching anything. The tag already exists, the tree is
//      dirty, HEAD is not on origin/main, or derivation was ambiguous. Nothing
//      was created, nothing was pushed, and nothing needs undoing.
//   2  the tag WAS pushed and release.yml failed. Repository state has changed.
//      The report names which job failed and which skipped as a consequence.
//   3  the tag WAS pushed and the outcome could not be observed -- the wait timed
//      out, or `gh` is unavailable. This is not success: a release nobody watched
//      land is a release nobody can say landed.
//   4  UNANSWERABLE before acting. Tags could not be read, or this is not a git
//      checkout. Nothing was created. An unanswerable check must never look like
//      a passing one.

import { execFileSync } from "node:child_process";

const DEFAULT_REMOTE = "origin";
const DEFAULT_WORKFLOW = "release.yml";
const DEFAULT_BASE_REF = "main";

// The `release` job is the one that creates the Release object. It is what the
// wait is for; `verify-demo` runs after and belongs to the deploy step.
const RELEASE_JOB = "release";
const VERIFY_JOB = "verify-demo";

const WAIT_TIMEOUT_SECONDS = 1800; // release.yml builds multi-arch images.
const RUN_APPEARS_SECONDS = 240; // How long a pushed tag may take to show a run.
const POLL_SECONDS = 20;

const EXIT_OK = 0;
const EXIT_REFUSED = 1;
const EXIT_RELEASE_FAILED = 2;
const EXIT_UNOBSERVED = 3;
const EXIT_UNANSWERABLE = 4;

const RELEASE_TAG = /^v(\d+)\.(\d+)\.(\d+)$/;
const PRERELEASE_TAG = /^v(\d+)\.(\d+)\.(\d+)-(.+)$/;

// ---------------------------------------------------------------------------
// Subprocesses. Only `git` and `gh` -- no dependencies beyond node builtins.
// ---------------------------------------------------------------------------

function run(bin, args, { allowFail = false } = {}) {
  try {
    return execFileSync(bin, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (err) {
    if (allowFail) return null;
    const detail = String(err?.stderr || err?.message || "").trim();
    throw new Error(`${bin} ${args.join(" ")} failed: ${detail}`);
  }
}

const git = (args, opts) => run("git", args, opts);
const gh = (args, opts) => run("gh", args, opts);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = {
    dryRun: false,
    noWait: false,
    version: null,
    message: null,
    remote: DEFAULT_REMOTE,
    baseRef: DEFAULT_BASE_REF,
    timeout: WAIT_TIMEOUT_SECONDS,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--no-wait") out.noWait = true;
    else if (arg === "--version") out.version = argv[++i];
    else if (arg === "--message" || arg === "-m") out.message = argv[++i];
    else if (arg === "--remote") out.remote = argv[++i];
    else if (arg === "--base-ref") out.baseRef = argv[++i];
    else if (arg === "--timeout") out.timeout = Number(argv[++i]);
    else {
      throw new Error(
        `unknown argument \`${arg}\`. See the header of this file for usage.`,
      );
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tags: derivation, and the existence question asked of BOTH sides
// ---------------------------------------------------------------------------

/**
 * Tags are read from the local list AND from the remote, and the union is what
 * "exists" means. Neither alone is sufficient: a tag pushed by someone else is
 * absent locally until a fetch, and a tag created locally and never pushed is
 * absent from the remote. Deriving from a partial view is how two people cut the
 * same version from different trees.
 *
 * Returns null for the remote half when the remote cannot be reached -- the
 * caller treats that as unanswerable, not as "no tags".
 */
function collectTags(remote) {
  const local = (git(["tag", "--list", "v*"], { allowFail: true }) ?? "")
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);

  const raw = git(["ls-remote", "--tags", remote], { allowFail: true });
  if (raw === null) return { local, remote: null };

  const remoteTags = raw
    .split("\n")
    .map((line) => line.split("\t")[1])
    .filter(Boolean)
    .map((ref) => ref.replace(/^refs\/tags\//, "").replace(/\^\{\}$/, ""))
    .filter((t) => t.startsWith("v"));

  return { local, remote: [...new Set(remoteTags)] };
}

function parseTag(tag) {
  const release = RELEASE_TAG.exec(tag);
  if (release) {
    return {
      tag,
      major: Number(release[1]),
      minor: Number(release[2]),
      patch: Number(release[3]),
      pre: null,
    };
  }
  const pre = PRERELEASE_TAG.exec(tag);
  if (pre) {
    return {
      tag,
      major: Number(pre[1]),
      minor: Number(pre[2]),
      patch: Number(pre[3]),
      pre: pre[4],
    };
  }
  return null;
}

const compare = (a, b) => a.major - b.major || a.minor - b.minor || a.patch - b.patch;

/**
 * The next unused patch after the highest RELEASE tag.
 *
 * Pre-release tags are excluded from the highest-tag calculation and then
 * checked separately: if any pre-release sorts above the highest release, this
 * refuses and asks for --version. That situation (`v0.2.0-rc1` exists, latest
 * release is `v0.1.1`) has two defensible answers -- 0.1.2 and 0.2.0 -- and
 * picking one silently is exactly the guess FR-003 forbids.
 */
function deriveNextVersion(tags) {
  const parsed = tags.map(parseTag).filter(Boolean);
  const releases = parsed.filter((p) => p.pre === null).sort(compare);
  const prereleases = parsed.filter((p) => p.pre !== null).sort(compare);

  if (releases.length === 0) {
    return {
      error:
        "no `vX.Y.Z` release tag exists, so there is nothing to derive the next " +
        "version FROM. Pass the first version explicitly: --version 0.1.0",
      trail: [`${parsed.length} parseable v* tag(s), none of them a plain release`],
    };
  }

  const highest = releases[releases.length - 1];
  const above = prereleases.filter((p) => compare(p, highest) > 0);
  if (above.length > 0) {
    return {
      error:
        `pre-release tag(s) sort above the highest release ${highest.tag}: ` +
        `${above.map((p) => p.tag).join(", ")}. Both "next patch after ` +
        `${highest.tag}" and "the release those pre-releases lead to" are ` +
        "defensible, and guessing between them is not. Pass --version.",
      trail: [`highest release tag: ${highest.tag}`],
    };
  }

  const next = `v${highest.major}.${highest.minor}.${highest.patch + 1}`;
  return {
    tag: next,
    trail: [
      `${releases.length} release tag(s) seen: ${releases.map((r) => r.tag).join(", ")}`,
      prereleases.length > 0
        ? `${prereleases.length} pre-release tag(s) seen: ${prereleases.map((p) => p.tag).join(", ")}`
        : "no pre-release tags",
      `highest release tag: ${highest.tag}`,
      `next unused patch: ${next}`,
    ],
  };
}

function normaliseVersion(v) {
  const trimmed = String(v ?? "").trim();
  const tag = trimmed.startsWith("v") ? trimmed : `v${trimmed}`;
  if (!parseTag(tag)) {
    throw new Error(
      `\`${trimmed}\` is not a version this pipeline can publish. Tags are ` +
        "`vX.Y.Z`, optionally with a pre-release suffix (`v0.2.0-rc1`). There " +
        "are no series tags and no `latest` -- see scripts/check-no-moving-tags.mjs.",
    );
  }
  return tag;
}

// ---------------------------------------------------------------------------
// The repository, and the half-release check
// ---------------------------------------------------------------------------

/** owner/repo from the remote URL, so the gh calls do not hardcode tarrowhq. */
function repoSlug(remote) {
  const url = git(["remote", "get-url", remote], { allowFail: true });
  if (!url) return null;
  const m = /(?:github\.com[:/])([^/]+)\/([^/]+?)(?:\.git)?$/.exec(url.trim());
  return m ? { owner: m[1], repo: m[2] } : null;
}

function ghAvailable() {
  return run("gh", ["auth", "status"], { allowFail: true }) !== null;
}

/**
 * Tags that exist with no GitHub Release object behind them -- the v0.1.1 shape.
 *
 * This is REPORTED, never repaired (plan D1). Creating the missing Release here
 * would be this mechanism's first act being an exception to its own rule about
 * not writing over existing version objects, and the operator would then have a
 * tool that says it never touches published versions while doing so on startup.
 */
function halfReleasedTags(slug, tags) {
  const listed = gh(
    [
      "api",
      `repos/${slug.owner}/${slug.repo}/releases`,
      "--paginate",
      "--jq",
      ".[].tag_name",
    ],
    { allowFail: true },
  );
  if (listed === null) return null; // Unanswerable; the caller says so.

  const released = new Set(listed.split("\n").map((t) => t.trim()).filter(Boolean));
  return tags.filter((t) => parseTag(t) && !released.has(t)).sort();
}

// ---------------------------------------------------------------------------
// Preflight
// ---------------------------------------------------------------------------

/**
 * Returns a list of blockers. Each is a reason a real run must refuse, phrased
 * so that reading it tells you what to do next.
 *
 * The `main` check is by ANCESTRY, not by branch name: the substantive rule is
 * that a released commit is one that went through review and merged, and a
 * worktree on a differently-named branch pointing at a merged commit satisfies
 * that while `git branch --show-current` does not.
 */
function preflight(remote, baseRef) {
  const blockers = [];

  const dirty = git(["status", "--porcelain"], { allowFail: true });
  if (dirty === null) {
    blockers.push("this is not a git checkout, or git is unavailable.");
    return blockers;
  }
  if (dirty !== "") {
    blockers.push(
      "the working tree is not clean. A tag records the COMMITTED state, so " +
        "tagging here would publish something other than what is on disk:\n" +
        dirty
          .split("\n")
          .map((l) => `        ${l}`)
          .join("\n"),
    );
  }

  const base = `${remote}/${baseRef}`;
  const baseSha = git(["rev-parse", "--verify", `${base}^{commit}`], { allowFail: true });
  if (baseSha === null) {
    blockers.push(
      `\`${base}\` could not be resolved. Fetch it, or name the base branch ` +
        "with --base-ref.",
    );
  } else {
    const merged = run("git", ["merge-base", "--is-ancestor", "HEAD", baseSha], {
      allowFail: true,
    });
    if (merged === null) {
      blockers.push(
        `HEAD is not an ancestor of \`${base}\`. This commit has not merged, so ` +
          "releasing it would publish code no PR approved -- and the PR review " +
          "IS the human checkpoint under " +
          "docs/decisions/task-0029-sweep-auto-release.md.",
      );
    }
  }

  return blockers;
}

// ---------------------------------------------------------------------------
// Watching release.yml
// ---------------------------------------------------------------------------

/**
 * A tag push shows up as a run whose headBranch is the TAG name (verified against
 * run 31523860531, headBranch `v0.1.1`). The run does not exist the instant the
 * push returns, so its appearance is polled for separately from its outcome --
 * "not created yet" and "created and failing" are different states and a single
 * timeout would blur them.
 */
async function findRun(slug, tag, workflow) {
  const deadline = Date.now() + RUN_APPEARS_SECONDS * 1000;
  for (;;) {
    const raw = gh(
      [
        "run",
        "list",
        "--repo",
        `${slug.owner}/${slug.repo}`,
        "--workflow",
        workflow,
        "--limit",
        "30",
        "--json",
        "databaseId,headBranch,status,conclusion,url,event",
      ],
      { allowFail: true },
    );
    if (raw !== null) {
      let runs = [];
      try {
        runs = JSON.parse(raw);
      } catch {
        runs = [];
      }
      const match = runs.find((r) => r.headBranch === tag);
      if (match) return match;
    }
    if (Date.now() >= deadline) return null;
    process.stdout.write(`  no ${workflow} run for ${tag} yet; waiting...\n`);
    await sleep(POLL_SECONDS * 1000);
  }
}

function jobsFor(slug, runId) {
  const raw = gh(
    [
      "api",
      `repos/${slug.owner}/${slug.repo}/actions/runs/${runId}/jobs`,
      "--paginate",
      "--jq",
      ".jobs[] | [.name, .status, (.conclusion // \"\")] | @tsv",
    ],
    { allowFail: true },
  );
  if (raw === null) return null;
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [name, status, conclusion] = line.split("\t");
      return { name, status, conclusion: conclusion || null };
    });
}

function renderJobs(jobs) {
  const width = Math.max(...jobs.map((j) => j.name.length), 0);
  return jobs
    .map((j) => {
      const state = j.status === "completed" ? j.conclusion ?? "unknown" : j.status;
      const shout = state === "failure" || state === "cancelled" || state === "timed_out";
      return `  ${j.name.padEnd(width)}  ${shout ? state.toUpperCase() : state}`;
    })
    .join("\n");
}

/**
 * Waits for the `release` job -- not for the whole run. See the header: the run
 * ends with `verify-demo`, which polls the public origin for up to 20 minutes and
 * is expected to fail until the pin has moved, which happens after this script.
 */
async function waitForRelease(slug, tag, workflow, timeout) {
  process.stdout.write(`\nWaiting for ${workflow} (${tag})...\n`);

  const found = await findRun(slug, tag, workflow);
  if (!found) {
    return {
      code: EXIT_UNOBSERVED,
      report:
        `No ${workflow} run appeared for ${tag} within ${RUN_APPEARS_SECONDS}s.\n` +
        "The tag IS pushed. Either the workflow's trigger did not match or\n" +
        "Actions is backed up. Check the Actions tab before cutting anything else.",
    };
  }

  process.stdout.write(`  run ${found.databaseId}: ${found.url}\n`);
  const deadline = Date.now() + Math.max(0, timeout) * 1000;

  for (;;) {
    const jobs = jobsFor(slug, found.databaseId);
    if (jobs === null) {
      return {
        code: EXIT_UNOBSERVED,
        report:
          `Could not read the jobs of run ${found.databaseId}. The tag IS pushed.\n` +
          `Read it by eye: ${found.url}`,
      };
    }

    const releaseJob = jobs.find((j) => j.name === RELEASE_JOB);
    const done = releaseJob && releaseJob.status === "completed";

    if (done && releaseJob.conclusion === "success") {
      const verify = jobs.find((j) => j.name === VERIFY_JOB);
      const verifyNote =
        verify && verify.status !== "completed"
          ? `\n\`${VERIFY_JOB}\` is still running. It polls the public origin and will\n` +
            "fail until the demo's pin moves -- that is the next step, not a fault here.\n"
          : "";
      return {
        code: EXIT_OK,
        report:
          `${workflow} created the release for ${tag}.\n\n` +
          renderJobs(jobs) +
          "\n" +
          verifyNote +
          `\n  ${found.url}\n`,
      };
    }

    if (done || found.status === "completed") {
      const refreshed = jobsFor(slug, found.databaseId) ?? jobs;
      return {
        code: EXIT_RELEASE_FAILED,
        report: failureReport(tag, workflow, found, refreshed),
      };
    }

    if (Date.now() >= deadline) {
      return {
        code: EXIT_UNOBSERVED,
        report:
          `Stopped watching after ${timeout}s; run ${found.databaseId} had not\n` +
          "reached the `release` job. The tag IS pushed and the run may still\n" +
          "succeed. Nothing here says it failed -- only that nobody watched it land.\n\n" +
          renderJobs(jobs) +
          `\n\n  ${found.url}\n`,
      };
    }

    await sleep(POLL_SECONDS * 1000);
  }
}

/**
 * The v0.1.1 report, generalised.
 *
 * "The release run failed" would have been true of run 31523860531 and would
 * have hidden the two things that actually mattered: the failing job was
 * `publish / no-moving-tags`, and the images HAD published. Naming the failed
 * job and listing what skipped because of it is the difference between a person
 * knowing they have a half-release and a person assuming they have none.
 */
function failureReport(tag, workflow, found, jobs) {
  const failed = jobs.filter(
    (j) =>
      j.status === "completed" &&
      ["failure", "cancelled", "timed_out"].includes(j.conclusion),
  );
  const skipped = jobs.filter(
    (j) => j.status === "completed" && j.conclusion === "skipped",
  );
  const succeeded = jobs.filter(
    (j) => j.status === "completed" && j.conclusion === "success",
  );

  const lines = [
    `${workflow} DID NOT CREATE THE RELEASE FOR ${tag}.`,
    "",
    renderJobs(jobs),
    "",
  ];

  if (failed.length > 0) {
    lines.push(`FAILED: ${failed.map((j) => j.name).join(", ")}`);
  }
  if (skipped.length > 0) {
    lines.push(
      `SKIPPED AS A CONSEQUENCE: ${skipped.map((j) => j.name).join(", ")}`,
      "A skipped job did not pass. It never ran.",
    );
  }
  if (succeeded.some((j) => j.name.startsWith("publish /"))) {
    lines.push(
      "",
      "PART OF `publish` SUCCEEDED, so images may be in the registry for a",
      "version that has no Release object -- the v0.1.1 shape. Check before",
      "assuming this release produced nothing:",
      `  docker manifest inspect ghcr.io/<owner>/tarrow-app:${tag.replace(/^v/, "")}`,
    );
  }

  lines.push(
    "",
    `The tag ${tag} IS pushed and is NOT removed by this script. Fix the failing`,
    "job and re-run the workflow from the Actions tab; do not delete and re-push",
    "the tag, and do not cut a new version to route around it.",
    "",
    `  ${found.url}`,
  );

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Argument and version-shape errors are REFUSALS, not unanswerable states: the
 * script understood the request perfectly well and declined it, and nothing was
 * created. Collapsing them into the catch-all exit 4 would tell a caller "could
 * not determine" about a typo.
 */
function refuseOnBadInput(fn) {
  try {
    return fn();
  } catch (err) {
    process.stderr.write(`\nrelease-tarrow: ${err.message}\nNothing was created.\n`);
    process.exit(EXIT_REFUSED);
  }
}

async function main() {
  const opts = refuseOnBadInput(() => parseArgs(process.argv.slice(2)));

  // Read-only, and it is what makes the tag list mean anything.
  git(["fetch", "--tags", opts.remote], { allowFail: true });

  const { local, remote } = collectTags(opts.remote);
  if (remote === null) {
    process.stderr.write(
      "\nrelease-tarrow: could not read tags from " +
        `\`${opts.remote}\`. Refusing to derive a version from the local tag list\n` +
        "alone: a tag pushed by somebody else is invisible here until a fetch\n" +
        "succeeds, and deriving from half the picture is how two trees claim one\n" +
        "version. Nothing was created.\n",
    );
    process.exit(EXIT_UNANSWERABLE);
  }

  const known = [...new Set([...local, ...remote])];
  process.stdout.write(
    `Tags: ${local.length} local, ${remote.length} on ${opts.remote}, ` +
      `${known.length} distinct.\n`,
  );

  // --- the version, derived or given, with the reasoning printed ---
  let tag;
  if (opts.version) {
    tag = refuseOnBadInput(() => normaliseVersion(opts.version));
    process.stdout.write(`Version given explicitly: ${tag}\n`);
  } else {
    const derived = deriveNextVersion(known);
    if (derived.error) {
      process.stderr.write(
        `\nrelease-tarrow: ${derived.error}\n` +
          derived.trail.map((l) => `  ${l}\n`).join("") +
          "Nothing was created.\n",
      );
      process.exit(EXIT_REFUSED);
    }
    tag = derived.tag;
    process.stdout.write(derived.trail.map((l) => `  ${l}\n`).join(""));
  }

  // --- refuse-if-exists (plan D1 / NFR-003) ---
  const exists = known.includes(tag);
  if (exists && !opts.dryRun) {
    process.stderr.write(
      "\n" +
        `${tag} ALREADY EXISTS.\n` +
        "\n" +
        `  local:  ${local.includes(tag) ? "yes" : "no"}\n` +
        `  ${opts.remote}: ${remote.includes(tag) ? "yes" : "no"}\n` +
        "\n" +
        "This script never re-pushes or force-moves a published version. Its\n" +
        "images may already be pulled and running somewhere, and two instances\n" +
        "computing statutory distances must never be able to claim the same\n" +
        "version while running different code (Principle VII's pinning rule,\n" +
        "docs/decisions/task-0029-sweep-auto-release.md).\n" +
        "\n" +
        "Cut the next version instead. If that tag's RELEASE is what is missing,\n" +
        "see the half-release note below -- creating it is an operator action.\n" +
        "\n" +
        "Nothing was created.\n",
    );
    process.exit(EXIT_REFUSED);
  }

  // --- the half-release report (D1: report, never repair) ---
  const slug = repoSlug(opts.remote);
  const haveGh = ghAvailable();
  let halfReleased = null;
  if (slug && haveGh) {
    halfReleased = halfReleasedTags(slug, known);
    if (halfReleased === null) {
      process.stdout.write(
        "\nCould not list this repository's releases, so whether any tag is\n" +
          "missing its Release object is unknown. That is a gap in the report,\n" +
          "not a clean bill.\n",
      );
    } else if (halfReleased.length > 0) {
      process.stdout.write(
        "\nHALF-RELEASED TAGS -- tagged, with no GitHub Release object:\n" +
          halfReleased.map((t) => `  ${t}\n`).join("") +
          "\n" +
          "Images for these may well be published and pullable; a Release object\n" +
          "is a separate thing from a tag, and release.yml creates it in a job\n" +
          "that skips when anything in `publish` fails.\n" +
          "\n" +
          "This script does NOT repair them. Repairing one means writing to an\n" +
          "existing version, which is the one thing it refuses to do. It is a\n" +
          "one-line operator action:\n" +
          halfReleased
            .map(
              (t) =>
                `  gh release create ${t} --title ${t} --generate-notes` +
                `${/^v0\./.test(t) ? " --prerelease" : ""}\n`,
            )
            .join(""),
      );
    }
  } else {
    process.stdout.write(
      "\n`gh` is unavailable or this remote is not GitHub, so no Release-object\n" +
        "check and no workflow watching. The tag can still be cut and pushed.\n",
    );
  }

  // --- preflight ---
  const blockers = preflight(opts.remote, opts.baseRef);

  // --- dry run stops here, having written nothing ---
  if (opts.dryRun) {
    process.stdout.write(`\nDRY RUN. Would cut and push: ${tag}\n`);
    if (exists) {
      process.stdout.write(
        `\nWOULD REFUSE: ${tag} already exists (local: ` +
          `${local.includes(tag) ? "yes" : "no"}, ${opts.remote}: ` +
          `${remote.includes(tag) ? "yes" : "no"}). A real run exits ${EXIT_REFUSED}.\n`,
      );
    }
    if (blockers.length > 0) {
      process.stdout.write(
        "\nWOULD REFUSE, on preflight:\n" +
          blockers.map((b) => `  - ${b}\n`).join("") +
          `A real run exits ${EXIT_REFUSED} without creating anything.\n`,
      );
    }
    process.stdout.write(
      "\nNo tag was created, nothing was pushed, no API write was made. This\n" +
        "exit code says the inspection ran, not that the release would succeed.\n",
    );
    return EXIT_OK;
  }

  if (blockers.length > 0) {
    process.stderr.write(
      "\nREFUSING TO CUT A RELEASE.\n\n" +
        blockers.map((b) => `  - ${b}\n`).join("") +
        "\nNothing was created.\n",
    );
    process.exit(EXIT_REFUSED);
  }

  // --- cut and push ---
  const message = opts.message ?? `tarrow ${tag}`;
  const head = git(["rev-parse", "--short", "HEAD"]);

  process.stdout.write(`\nTagging ${head} as ${tag}: ${message}\n`);
  git(["tag", "-a", tag, "-m", message]); // never -f, under any condition

  try {
    git(["push", opts.remote, `refs/tags/${tag}`]); // never --force
  } catch (err) {
    // The local tag is left in place deliberately: deleting it here would
    // destroy the only local record that this ran, and a stray local tag is
    // visible and harmless where a silent rollback is neither.
    process.stderr.write(
      `\nrelease-tarrow: the local tag ${tag} was created but the push failed.\n` +
        `  ${err.message}\n\n` +
        `Nothing is published. Push it by hand (\`git push ${opts.remote} ${tag}\`)\n` +
        `or drop it (\`git tag -d ${tag}\`), then re-run.\n`,
    );
    process.exit(EXIT_RELEASE_FAILED);
  }

  process.stdout.write(`Pushed ${tag} to ${opts.remote}.\n`);

  if (opts.noWait || !slug || !haveGh) {
    process.stdout.write(
      `\n${tag} is pushed and release.yml has been triggered. This run is NOT\n` +
        "watching it, so whether the release exists is unverified here.\n",
    );
    return opts.noWait ? EXIT_OK : EXIT_UNOBSERVED;
  }

  // --- watch release.yml's release job ---
  const { code, report } = await waitForRelease(slug, tag, DEFAULT_WORKFLOW, opts.timeout);

  if (code === EXIT_OK) {
    process.stdout.write(`\n${report}\n`);
    process.stdout.write(
      "PUBLISHED, NOT DEPLOYED. demo.tarrow.org runs whatever tag is pinned in\n" +
        "the infrastructure repository and has not moved. The pin bump, the\n" +
        "playbook, and verifying the live origin are `scripts/deploy-demo.sh`:\n" +
        "\n" +
        `  ./scripts/deploy-demo.sh ${tag.replace(/^v/, "")}\n`,
    );
    return EXIT_OK;
  }

  process.stderr.write(`\n${report}\n`);
  return code;
}

main()
  .then((code) => process.exit(code ?? EXIT_OK))
  .catch((err) => {
    process.stderr.write(`\nrelease-tarrow: ${err?.stack || err}\n`);
    process.exit(EXIT_UNANSWERABLE);
  });
