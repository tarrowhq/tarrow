#!/usr/bin/env node
// Fails if a moving tag exists on either published image.
//
// WHY THIS IS A CHECK AND NOT A NOTE IN A README
//
// The rule -- every published tag is immutable, there is no `latest` -- is
// stated in .github/workflows/publish-images.yml, in docker-compose.deploy.yml,
// and in the constitution's Principle VII amendment. It was still broken: the
// v0.1.0 release published `latest` before the workflow was corrected in PR
// #10, and that tag then sat in the registry pinned forever at 0.1.0, silently
// freezing anything that pulled it. Three documents said it could not happen
// while it had already happened.
//
// A rule enforced by prose is a rule enforced by whoever last read the prose.
// This makes the registry itself the thing that gets asked.
//
// WHAT COUNTS AS MOVING
//
// A tag that can point at different content over time: `latest`, `main`,
// `edge`, `stable`, `nightly`, or a bare `v1`/`1.2` series tag that a later
// release would re-point. Immutable tags are `sha-<short>` and full semver
// (`0.1.0`), and those are the only two shapes this pipeline publishes.
//
// The danger of a moving tag here is specific and worse than untidiness: two
// instances computing statutory distances could claim the same version while
// running different code, which is the exact failure the pinning rule exists
// to prevent.
//
// USAGE
//
//     node scripts/check-no-moving-tags.mjs
//     node scripts/check-no-moving-tags.mjs --owner tarrowhq --image tarrow-app
//
// Needs a token that can read the packages: GITHUB_TOKEN or GH_TOKEN in the
// environment, or a logged-in `gh`. Public packages need no token at all, so
// once TASK-0021 lands this runs anonymously.
//
// Exit 0 = no moving tags. Exit 1 = at least one found. Exit 2 = could not
// determine, which is NOT treated as success -- an unanswerable check must not
// look like a passing one.

import { execFileSync } from "node:child_process";

const DEFAULT_OWNER = "tarrowhq";
const DEFAULT_IMAGES = ["tarrow-app", "tarrow-db"];

/**
 * Tag names that are moving by construction. Matched case-insensitively and
 * exactly -- `sha-0a24287` and `0.1.0` are not in here and never match.
 */
const MOVING_NAMES = new Set([
  "latest",
  "main",
  "master",
  "edge",
  "stable",
  "nightly",
  "dev",
  "develop",
  "release",
  "prod",
  "production",
]);

/**
 * A partial semver series tag -- `v1`, `1.2`, `v1.2` -- which a later release
 * would re-point at new content. Full `1.2.3` is immutable and allowed.
 */
const SERIES_TAG = /^v?\d+(\.\d+)?$/;

function isMoving(tag) {
  if (MOVING_NAMES.has(tag.toLowerCase())) return true;
  return SERIES_TAG.test(tag);
}

function token() {
  const fromEnv = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (fromEnv) return fromEnv;
  try {
    return execFileSync("gh", ["auth", "token"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null; // Public packages are readable without one.
  }
}

/**
 * Tags are read from the REGISTRY (ghcr.io/v2/.../tags/list) rather than from
 * GitHub's packages API, deliberately. The packages API answers in terms of
 * VERSION objects, each carrying a list of tags -- a shape that invites exactly
 * the mistake this project nearly made: `latest`, `0.1.0` and `sha-ff1094a` are
 * three tags on ONE version, so "delete the version with the latest tag" would
 * have deleted the v0.1.0 release images too. The registry's tag list is the
 * view that matches the question being asked.
 */
async function tagsFor(owner, image, auth) {
  const scope = `repository:${owner}/${image}:pull`;
  const tokenUrl = `https://ghcr.io/token?service=ghcr.io&scope=${encodeURIComponent(scope)}`;

  const headers = auth
    ? { Authorization: `Basic ${Buffer.from(`x:${auth}`).toString("base64")}` }
    : {};

  const tokenRes = await fetch(tokenUrl, { headers });
  if (!tokenRes.ok) {
    throw new Error(
      `could not obtain a registry token for ${owner}/${image} ` +
        `(HTTP ${tokenRes.status}). If the packages are private, set GITHUB_TOKEN ` +
        `or run \`gh auth login\`.`,
    );
  }
  const { token: bearer } = await tokenRes.json();

  const listRes = await fetch(`https://ghcr.io/v2/${owner}/${image}/tags/list`, {
    headers: { Authorization: `Bearer ${bearer}` },
  });
  if (!listRes.ok) {
    throw new Error(`could not list tags for ${owner}/${image} (HTTP ${listRes.status})`);
  }

  const body = await listRes.json();
  return Array.isArray(body.tags) ? body.tags : [];
}

function parseArgs(argv) {
  const out = { owner: DEFAULT_OWNER, images: [] };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--owner") out.owner = argv[++i];
    else if (argv[i] === "--image") out.images.push(argv[++i]);
  }
  if (out.images.length === 0) out.images = DEFAULT_IMAGES;
  return out;
}

async function main() {
  const { owner, images } = parseArgs(process.argv.slice(2));
  const auth = token();

  const offenders = [];
  for (const image of images) {
    let tags;
    try {
      tags = await tagsFor(owner, image, auth);
    } catch (err) {
      process.stderr.write(`\ncheck-no-moving-tags: ${err.message}\n\n`);
      process.exit(2); // Unanswerable is not the same as clean.
    }

    const moving = tags.filter(isMoving);
    if (moving.length > 0) offenders.push({ image, moving });
    process.stdout.write(
      `${owner}/${image}: ${tags.length} tag(s), ` +
        `${moving.length === 0 ? "none moving" : `MOVING: ${moving.join(", ")}`}\n`,
    );
  }

  if (offenders.length === 0) {
    process.stdout.write("\nNo moving tags. Every published tag is immutable.\n");
    return;
  }

  process.stderr.write(
    "\n" +
      "A MOVING TAG EXISTS ON A PUBLISHED IMAGE.\n" +
      "\n" +
      offenders.map((o) => `  ${owner}/${o.image}: ${o.moving.join(", ")}`).join("\n") +
      "\n\n" +
      "Every tag this project publishes must be immutable (`sha-<short>` or a full\n" +
      "semver like 0.1.0). A moving tag lets two instances claim the same version\n" +
      "while running different code -- and these instances compute statutory\n" +
      "distances, which is why Principle VII's pinning rule exists.\n" +
      "\n" +
      "TO REMOVE ONE, UNTAG IT. Do NOT delete the package version.\n" +
      "\n" +
      "On GHCR a version object can carry several tags at once: `latest`, `0.1.0`\n" +
      "and `sha-ff1094a` were all three tags on ONE version. GitHub's delete API\n" +
      "takes the VERSION, so deleting it to remove `latest` would delete the\n" +
      "released images with it and leave the release pointing at nothing.\n",
  );
  process.exit(1);
}

main().catch((err) => {
  process.stderr.write(`\ncheck-no-moving-tags: ${err?.stack || err}\n`);
  process.exit(2);
});
