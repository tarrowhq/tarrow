#!/usr/bin/env node
// THE GROUNDING-WIKI FRESHNESS GATE, VENDORED INTO THE REPOSITORY.
//
// Every note in docs/wiki/ declares two things in its frontmatter: the source
// paths whose contents it describes (`sources:`), and the commit it was last
// verified against (`verified_against:`). This script fails if any note's
// sources have changed since its pin.
//
// WHY THIS FILE EXISTS RATHER THAN A PLUGIN INVOCATION. The equivalent check
// ships inside the grounding-wiki plugin, in a per-user cache directory whose
// path carries a version number. CI cannot reach it, a contributor without the
// plugin cannot run it, and a plugin upgrade moves it. CLAUDE.md claimed for
// months that "grounding-wiki's freshness gate runs as check scripts and CI"
// while no such script existed in this repository and no workflow mentioned
// the wiki -- so the rule was enforced only by whoever remembered it, and it
// was silently missed across at least two merges.
//
// A gate that lives somewhere the build cannot see is documentation. This is
// the same check, in the repository, runnable by anyone with node and git.
//
// WHAT A FAILURE MEANS, AND WHAT IT DOES NOT. A stale note is not a broken
// build in the usual sense -- the code is fine. It means the corpus is now
// lying about the code, and the corpus is what the next person (or the next
// agent) reads to orient before changing anything. Principle-level: a wrong
// map is worse than no map, because it is trusted.
//
// THE FIX IS NEVER TO BUMP THE PIN. Read the diff, correct the prose, then
// re-pin. `/grounding-wiki:wiki-update` does exactly that and prints a
// computed work order. A pin bumped without reading the diff is a false claim
// that somebody verified the content at that commit.
//
//   node scripts/check-wiki-freshness.mjs            # repo root, docs/wiki
//   node scripts/check-wiki-freshness.mjs . docs/wiki
//
// Exit 0 = every note fresh. Exit 1 = at least one stale or malformed note.
// Exit 2 = the corpus itself could not be read.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, isAbsolute, join } from "node:path";

const [rootArg, corpusArg] = process.argv.slice(2);
const REPO_ROOT = rootArg || process.cwd();
const CORPUS_DIR = corpusArg || "docs/wiki";

function git(args) {
  return execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

/**
 * The frontmatter block, parsed just far enough for the two keys that matter.
 *
 * Deliberately not a YAML dependency: this gate must run in CI with nothing
 * installed, and the frontmatter it reads is written by a generator with a
 * fixed shape. A note whose frontmatter this cannot parse fails the gate
 * rather than being skipped -- an unparseable note is an unverifiable one.
 */
function parseFrontmatter(text) {
  if (!text.startsWith("---")) return null;
  const end = text.indexOf("\n---", 3);
  if (end === -1) return null;
  const block = text.slice(3, end);
  const out = {};
  let listKey = null;
  for (const raw of block.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (line.trim() === "") continue;
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && listKey) {
      out[listKey].push(item[1].trim());
      continue;
    }
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (!kv) continue;
    const [, key, value] = kv;
    if (value === "") {
      listKey = key;
      out[key] = [];
    } else {
      listKey = null;
      out[key] = value.trim();
    }
  }
  return out;
}

const dir = isAbsolute(CORPUS_DIR) ? CORPUS_DIR : join(REPO_ROOT, CORPUS_DIR);

if (!existsSync(join(dir, "INDEX.md"))) {
  console.error(`not a corpus: ${join(dir, "INDEX.md")} is missing`);
  process.exit(2);
}

// INDEX.md is navigation and CAPSULES.md is generated from the notes' own
// descriptions; neither pins sources, so neither is a note.
const notes = readdirSync(dir)
  .filter((f) => f.endsWith(".md"))
  .filter((f) => f !== "INDEX.md" && f !== "CAPSULES.md")
  .sort();

const fails = [];
const warns = [];
let checked = 0;

for (const file of notes) {
  const rel = `${CORPUS_DIR}/${file}`;
  const fm = parseFrontmatter(readFileSync(join(dir, file), "utf8"));
  checked += 1;

  if (!fm) {
    fails.push(`${rel}: no frontmatter — not a corpus note`);
    continue;
  }

  const pin = fm.verified_against;
  if (!pin) {
    fails.push(`${rel}: no verified_against pin`);
    continue;
  }
  try {
    git(["cat-file", "-e", `${pin}^{commit}`]);
  } catch {
    fails.push(
      `${rel}: pin ${pin} is not a commit in this repository — history was ` +
        `rewritten, or the pin was hand-edited`,
    );
    continue;
  }

  const sources = Array.isArray(fm.sources) ? fm.sources : [];
  if (sources.length === 0) {
    warns.push(`${rel}: lists no sources — its staleness cannot be checked`);
    continue;
  }

  // A source path absent from the working tree is vanished proof, not
  // freshness: `git log` over a nonexistent pathspec is silently empty, which
  // would report this note FRESH forever.
  for (const s of sources.filter((s) => !existsSync(join(REPO_ROOT, s)))) {
    fails.push(
      `${rel}: source missing from the working tree: ${s} — renamed, deleted, ` +
        `or a typo. Fix the note's sources.`,
    );
  }

  let changed = "";
  try {
    changed = git(["log", "--oneline", `${pin}..HEAD`, "--", ...sources]);
  } catch (err) {
    fails.push(`${rel}: git log failed for its sources (${String(err).split("\n")[0]})`);
    continue;
  }

  if (changed) {
    const lines = changed.split("\n");
    fails.push(
      `${rel}: STALE — sources changed in ${lines.length} commit(s) since ` +
        `${pin.slice(0, 12)}, e.g. ${lines[0]}`,
    );
  }
}

for (const w of warns) console.log(`warn: ${w}`);

if (fails.length > 0) {
  console.log(`\nWIKI FRESHNESS GATE FAILED (${fails.length} issue(s)):`);
  for (const f of fails) console.log(`  - ${f}`);
  console.log(
    `
docs/wiki/ is load-bearing: it is what the next person reads to orient before
changing anything, so a note that no longer matches its sources is worse than
no note at all.

The fix is NOT to bump the pin. Read the diff, correct the prose, then re-pin:

    /grounding-wiki:wiki-update

which prints a computed work order and re-pins each note as it is verified.
`,
  );
  process.exit(1);
}

console.log(`OK: ${checked} note(s) fresh against their pinned sources.`);
