// THE COPY GATE.
//
// Spec FR-014: "No rendered copy may state or imply permission. This MUST be
// verified by a test over the rendered result strings." FR-015: the coverage
// manifest, the outside-every-buffer phrasing, and the sheriff guidance MUST be
// present in the server-rendered document, and MAY be visually collapsed but
// MUST NOT require JavaScript to reveal. Board AC #3, #4, #7.
//
// EVERYTHING HERE IS READ OFF THE WIRE. Not off a component, not off a
// snapshot, not off a constant this file also wrote. Each shape below is
// produced by submitting a real address to the running composition over HTTP
// and reading the bytes that came back -- which is the same thing a browser
// with JavaScript switched off receives, because there is no JavaScript to
// switch off (app/app/root.tsx). A test that rendered components in-process
// would pass while the served page was broken.
//
// The one shape that cannot be provoked against a healthy composition --
// `search-failed` -- is produced by starting a SECOND tarrow server inside this
// container, pointed at a port with no database behind it, and reading ITS
// served document. Same code, same renderer, same wire. See `withoutADatabase`.
//
// WHY THE VOCABULARY LIST HAS AN ALLOWLIST, AND WHY THAT IS NOT A LOOPHOLE
//
// A blanket ban on the word "legal" would force tarrow to weaken the disclosure
// that its own rule content is unverified -- a paragraph that ends "never as a
// legal conclusion", which is the OPPOSITE of a permission claim and which
// server/manifest.ts refuses to serve a result without. So exact negated
// phrases may be allowlisted, with a written reason, and:
//
//   - a test below asserts every allowlisted phrase actually occurs, so a
//     stale exemption is caught rather than sitting there widening the gate;
//   - HARD_DENY is applied to the untouched body and no allowlist can excuse
//     it. Those are the constructions a frightened reader would take as
//     permission however they are framed.

import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, test } from "node:test";

import {
  FAR_FROM_EVERY_SCHOOL,
  FLAGGED_ONLY_BY_UNCERTAINTY,
  NEAR_A_SCHOOL,
  NORMALIZES_TO_NOTHING,
  NO_SUCH_ADDRESS,
  RESOLVES_BUT_HAS_NO_PARCEL,
} from "./fixtures.ts";

const APP_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = process.env.TARROW_APP_ORIGIN ?? "http://app:3000";

// ---------------------------------------------------------------------------
// The vocabulary
// ---------------------------------------------------------------------------

/**
 * Constructions no framing excuses. Checked against the untouched body, before
 * any allowlist is applied.
 */
const HARD_DENY: ReadonlyArray<readonly [RegExp, string]> = [
  [/you (?:can|may|are able to) live/i, "states permission outright"],
  [/(?:ok|okay|fine|safe) to (?:live|move|rent|buy)/i, "states permission outright"],
  [/good to go/i, "reads as permission"],
  [/in the clear/i, "reads as permission"],
  [/green light/i, "reads as permission"],
  [/no restrictions/i, "claims an absence tarrow cannot know"],
  [/this address is (?:clear|legal|approved|permitted|allowed|safe)/i, "a verdict"],
  [/\bapproved\b/i, "the constitution names this word"],
  [/\bcleared\b/i, "the constitution names this word"],
];

/**
 * Spec SC-005's permission vocabulary, plus the near neighbours a plausible
 * synonym would reach for. Substring-with-word-boundary, so "approval",
 * "clearance", and "permitted" are all caught by their stems.
 */
const FORBIDDEN: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bapprov\w*/gi, "approved / approval"],
  [/\bclear\w*/gi, "clear / clearly / cleared / clearance"],
  [/\blegal\w*/gi, "legal / legally"],
  [/\bpermit\w*/gi, "permit / permitted"],
  [/\bpermiss\w*/gi, "permission / permissible"],
  [/\ballow\w*/gi, "allow / allowed / allowable"],
  [/\beligib\w*/gi, "eligible / eligibility"],
  [/\blawful\w*/gi, "lawful / lawfully"],
  [/\bauthoris\w*|\bauthoriz\w*/gi, "authorised / authorized"],
  [/\bcomplian\w*/gi, "compliant / compliance"],
  [/\bunrestricted\b/gi, "unrestricted"],
  [/\bsafe\w*/gi, "safe / safety"],
  [/\bokay\b|\bok\b/gi, "OK"],
];

/**
 * Exact phrases in which a forbidden word is negated. Removed from the body
 * before FORBIDDEN is applied. Each needs a reason, and each is asserted below
 * to actually occur -- an exemption for text that no longer exists is an
 * exemption nobody is watching.
 */
const ALLOWED_NEGATIONS: ReadonlyArray<{ phrase: string; why: string }> = [
  {
    phrase: "never as a legal conclusion",
    why:
      "The last clause of tarrow's own unverified-rule disclosure, read from " +
      "the coverage-gap ledger (server/manifest.ts refuses to build a manifest " +
      "without that row). It tells the reader the opposite of permission: that " +
      "no distance on the page is a conclusion about the law. Banning the word " +
      "would delete the disclosure rather than the claim.",
  },
];

function scrubNegations(body: string): string {
  let out = body;
  for (const { phrase } of ALLOWED_NEGATIONS) out = out.split(phrase).join(" ");
  return out;
}

// ---------------------------------------------------------------------------
// Strings the page must carry, transcribed rather than imported
// ---------------------------------------------------------------------------
//
// Deliberately NOT derived from the constants the server built them from --
// the same reasoning tests/http-headers.test.ts gives for retyping the CSP. A
// test that compares the page against the string the page was made of passes
// whatever that string says, including after somebody quietly empties it.

/** Constitution Principle I's strongest available answer, verbatim. */
const OUTSIDE_EVERY_BUFFER = "outside every buffer we checked";

/** FR-013 / AC #7. Two independent tokens, so a reword cannot pass by accident. */
const SHERIFF_TOKENS = ["sheriff", "where you register"] as const;

/** Principle V, as this release is obliged to state it. */
const RULE_NOT_VERIFIED = "not verified rule data";

/**
 * Principle II, as the answer surface now states it.
 *
 * WHAT CHANGED, AND WHY THIS IS NOT A WEAKENING. These were the ledger's full
 * `description` paragraphs, each rendered as a full screen of its own. That
 * satisfied Principle II by volume: five screens of text written for somebody
 * auditing the instance, between a frightened reader and the rest of their
 * answer, and read by nobody.
 *
 * The ledger now carries a short `label` beside each description -- two or
 * three words, for the person looking up an address -- and the answer states
 * the gaps as a count plus those labels, on the same card as the finding.
 * The full descriptions are on /faq.
 *
 * So this list is the LABELS, and the assertion is unchanged in force: every
 * class of place tarrow did not check must be named on every result, in the
 * reader's own words, outside every <details>. What may not happen is the
 * list vanishing from the answer -- and that is what these tests still catch.
 */
const MANIFEST_TOKENS = [
  "Preschools and day-care",
  "City and village rules",
  "Anywhere outside Summit County",
] as const;

/**
 * The gaps that must be VISIBLE -- rendered outside every <details> -- rather
 * than merely present.
 *
 * FR-015 permits the manifest to be collapsed. TASK-0017 collapsed a great
 * deal of this surface on the argument that disclosure a reader scrolls past
 * was never delivered, and that argument cuts both ways: disclosure a reader
 * never opens was not delivered either. The line this gate holds is that WHAT
 * TARROW DID NOT CHECK stays unfolded, while HOW TARROW KNOWS WHAT IT CHECKED
 * may fold away or move to /faq.
 *
 * These are the facility-class and jurisdiction gaps -- the ones that make an
 * unflagged answer honest. They are the same strings as MANIFEST_TOKENS
 * because the surface now states exactly these and nothing longer: there is no
 * folded tier of gap text left on the answer to distinguish them from.
 */
const VISIBLE_GAP_TOKENS = MANIFEST_TOKENS;

/** Everything inside a <details>, removed. tarrow nests none, so this is exact. */
function withoutCollapsedContent(body: string): string {
  // Scripts first, then <details>.
  //
  // React Router's hydration bootstrap serializes the loader payload into an
  // inline <script>, and that payload contains the gap ledger as data --
  // including the strings this file checks are NOT visible. They are not
  // visible: they are inside a script element, which renders nothing. But a
  // <details> stripper cannot see that, so without this line the collapse
  // assertion reports a failure that is really an artefact of reading the
  // hydration payload as if it were markup.
  return body
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<details[\s\S]*?<\/details>/g, " ");
}

/**
 * React's server renderer emits `<!-- -->` wherever static text abuts an
 * interpolated value, so `data on {newest}` reaches the wire as
 * `data on <!-- -->5 August 2026`. Any assertion whose phrase spans that
 * boundary must strip them first or it can never match.
 *
 * This is not hypothetical tidiness: the staleness assertion below was written
 * as one regex across that boundary and was unsatisfiable from the day it was
 * written. Nobody found out, because the loop that would have run it
 * registered no tests (see ROSTER). Both halves of that are fixed here.
 */
function withoutSsrSeparators(body: string): string {
  return body.split("<!-- -->").join("");
}

/** Principle V again: a fetch date may never stand in for a verification date. */
const NEVER_VERIFIED = "never human-verified";

// ---------------------------------------------------------------------------
// Getting the shapes off the wire
// ---------------------------------------------------------------------------

interface Shape {
  readonly name: string;
  readonly status: number;
  readonly body: string;
  /** A result tarrow produced from a submitted address. */
  readonly isSearchResult: boolean;
  /** ...and one whose coverage manifest was read from data rather than withdrawn. */
  readonly hasLoadedManifest: boolean;
}

/**
 * THE ROSTER IS STATIC, AND THAT IS THE WHOLE POINT (TASK-0017).
 *
 * This used to be derived by iterating the `shapes` array that `before()`
 * fills. It does not work, and it fails SILENTLY: node:test runs every
 * `describe` callback at COLLECTION time, before any `before()` hook. So every
 * `for (const s of shapes)` loop iterated an empty array and registered ZERO
 * tests, and the suite reported all-green having checked nothing.
 *
 * Four gates were dead that way, all of them constitutional:
 *
 *   - the sheriff step on every shape (FR-013, AC #7)
 *   - the coverage manifest on every result (Principle II, FR-009/FR-015)
 *   - every layer reporting as never-human-verified (Principle V)
 *   - no shape shipping a <script> or an off-origin asset (FR-026, SC-001)
 *
 * It was found because the live page rendered "never human-verified" eight
 * times against an assertion of seven and nothing complained. So the roster is
 * declared here, up front, as data: the loops below iterate THIS, the bodies
 * look the shape up at run time, and a suite that fails to capture one fails
 * loudly in `shape()` rather than quietly running one test less.
 *
 * `expectedBytes` is the anti-vacuity floor -- a scan over an empty page finds
 * no forbidden word and proves nothing. It is per-shape because the pages are
 * legitimately different sizes: TASK-0017 cut the form to a question, a field,
 * and two footnotes, and a 2 KB floor written for the old wall of prose would
 * now fail on a page that is short on purpose.
 */
const ROSTER: ReadonlyArray<{
  readonly name: string;
  readonly isSearchResult: boolean;
  readonly hasLoadedManifest: boolean;
  readonly expectedBytes: number;
}> = [
  // Deliberately short (TASK-0017). Still far larger than an empty document,
  // and `each shape really is the shape it is named after` below is the check
  // that actually proves this page is the form.
  { name: "form", isSearchResult: false, hasLoadedManifest: false, expectedBytes: 1200 },
  { name: "faq", isSearchResult: false, hasLoadedManifest: false, expectedBytes: 2000 },
  { name: "premises-within-buffer", isSearchResult: true, hasLoadedManifest: true, expectedBytes: 2000 },
  { name: "premises-within-buffer-by-uncertainty", isSearchResult: true, hasLoadedManifest: true, expectedBytes: 2000 },
  { name: "outside-every-buffer-we-checked", isSearchResult: true, hasLoadedManifest: true, expectedBytes: 2000 },
  { name: "declined", isSearchResult: true, hasLoadedManifest: true, expectedBytes: 2000 },
  { name: "could-not-locate", isSearchResult: true, hasLoadedManifest: true, expectedBytes: 2000 },
  { name: "could-not-locate-empty-input", isSearchResult: true, hasLoadedManifest: true, expectedBytes: 2000 },
  { name: "error-boundary", isSearchResult: false, hasLoadedManifest: false, expectedBytes: 2000 },
  { name: "nothing-submitted", isSearchResult: false, hasLoadedManifest: false, expectedBytes: 2000 },
  { name: "search-failed", isSearchResult: true, hasLoadedManifest: false, expectedBytes: 2000 },
];

const EVERY_SHAPE = ROSTER.map((r) => r.name);
const SEARCH_RESULTS = ROSTER.filter((r) => r.isSearchResult).map((r) => r.name);
const LOADED_MANIFESTS = ROSTER.filter((r) => r.hasLoadedManifest).map((r) => r.name);

/**
 * Where the sheriff step is REQUIRED: every page that answers, or that stands
 * where an answer would have been.
 *
 * FR-013 and AC #7 say "every result", and that is what this list is -- the
 * five result shapes plus the three pages a reader lands on instead of one
 * (the error boundary, a bare GET of /answer, and a failed search). Those
 * three are included precisely because they are the shapes most easily read as
 * "nothing found": a page where tarrow could not answer must still point at the
 * office that can.
 *
 * `form` and `faq` are NOT on it. Neither is a result and neither says
 * anything about any address, and TASK-0017 took the sheriff sentence off the
 * search page to leave one instruction there instead of three. /faq carries
 * the guidance in full for anyone who follows the link.
 *
 * The old suite appeared to require it on all ten shapes. It did not require
 * it anywhere -- the loop it used registered no tests at all (see ROSTER), so
 * this is the first time the rule is written down as something that runs.
 */
const NEEDS_SHERIFF_STEP = ROSTER.map((r) => r.name).filter(
  (name) => name !== "form" && name !== "faq",
);

const shapes: Shape[] = [];

function shape(name: string): Shape {
  const found = shapes.find((s) => s.name === name);
  assert.ok(found, `no shape named ${name} was captured`);
  return found;
}

async function submit(origin: string, address: string): Promise<Response> {
  return fetch(`${origin}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ address }).toString(),
  });
}

/**
 * A second tarrow server, in this container, with nowhere to connect.
 *
 * `search-failed` cannot be provoked against a healthy composition, and the
 * suite must not be able to take the composition down to try -- tests/docker.ts
 * is read-only on purpose. So this starts the real server entry point with
 * PGHOST/PGPORT pointing at a closed port. Every search it answers takes the
 * `database-unreachable` branch of server/search.ts, and the document it
 * serves is rendered by the same route and the same components as every other
 * shape here.
 */
async function withoutADatabase<T>(use: (origin: string) => Promise<T>): Promise<T> {
  const PORT = 3931;
  const child: ChildProcess = spawn(process.execPath, ["server/entry.ts"], {
    cwd: APP_ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      PGHOST: "127.0.0.1",
      // Nothing listens here. `pool.connect()` is refused immediately.
      PGPORT: "59371",
      PGCONNECT_TIMEOUT: "2",
    },
    stdio: "ignore",
  });
  const origin = `http://127.0.0.1:${PORT}`;
  try {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const alive = await fetch(`${origin}/`)
        .then((r) => r.ok)
        .catch(() => false);
      if (alive) return await use(origin);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(
      "the database-less tarrow server never came up, so the search-failed " +
        "shape was never rendered and nothing about it was checked",
    );
  } finally {
    child.kill("SIGKILL");
  }
}

before(async () => {
  const capture = async (
    name: string,
    res: Response,
    flags: { isSearchResult: boolean; hasLoadedManifest: boolean },
  ) => {
    shapes.push({ name, status: res.status, body: await res.text(), ...flags });
  };

  const RESULT = { isSearchResult: true, hasLoadedManifest: true };
  const NOT_A_RESULT = { isSearchResult: false, hasLoadedManifest: false };

  await capture("form", await fetch(`${ORIGIN}/`), NOT_A_RESULT);
  // /faq is not a result and states nothing about any address -- but a reader
  // arrives on it from an answer and reads it as part of that answer, so the
  // permission vocabulary is forbidden here exactly as it is everywhere else.
  await capture("faq", await fetch(`${ORIGIN}/faq`), NOT_A_RESULT);
  await capture(
    "premises-within-buffer",
    await submit(ORIGIN, NEAR_A_SCHOOL.typed),
    RESULT,
  );
  await capture(
    "premises-within-buffer-by-uncertainty",
    await submit(ORIGIN, FLAGGED_ONLY_BY_UNCERTAINTY.typed),
    RESULT,
  );
  await capture(
    "outside-every-buffer-we-checked",
    await submit(ORIGIN, FAR_FROM_EVERY_SCHOOL.typed),
    RESULT,
  );
  await capture(
    "declined",
    await submit(ORIGIN, RESOLVES_BUT_HAS_NO_PARCEL.typed),
    RESULT,
  );
  await capture(
    "could-not-locate",
    await submit(ORIGIN, NO_SUCH_ADDRESS.typed),
    RESULT,
  );
  await capture(
    "could-not-locate-empty-input",
    await submit(ORIGIN, NORMALIZES_TO_NOTHING.typed),
    RESULT,
  );
  await capture(
    "error-boundary",
    await fetch(`${ORIGIN}/no-such-page-copy-probe`),
    NOT_A_RESULT,
  );
  await capture("nothing-submitted", await fetch(`${ORIGIN}/answer`), NOT_A_RESULT);

  await withoutADatabase(async (origin) => {
    await capture("search-failed", await submit(origin, NEAR_A_SCHOOL.typed), {
      isSearchResult: true,
      hasLoadedManifest: false,
    });
  });
});

// ---------------------------------------------------------------------------

describe("every shape was actually captured before anything is concluded", () => {
  test("every shape on the roster came back, and none is an empty body", () => {
    assert.deepEqual(
      shapes.map((s) => s.name).sort(),
      [...EVERY_SHAPE].sort(),
      "the captured set does not match the roster the gates below iterate",
    );
    for (const { name, expectedBytes } of ROSTER) {
      assert.ok(
        shape(name).body.length > expectedBytes,
        `${name}: ${shape(name).body.length} bytes, floor ${expectedBytes}. A ` +
          "scan over an empty page finds no forbidden word and proves nothing.",
      );
    }
  });

  test("each shape really is the shape it is named after", () => {
    const marker: Record<string, string> = {
      form: "A street address in Summit County, Ohio",
      faq: "What tarrow is",
      "premises-within-buffer": "Result: inside a buffer tarrow checked",
      "premises-within-buffer-by-uncertainty": "Result: inside a buffer tarrow checked",
      "outside-every-buffer-we-checked": "Result: outside every buffer we checked",
      declined: "No result: tarrow stopped instead of measuring",
      "could-not-locate": "No result: tarrow could not find this address",
      "could-not-locate-empty-input": "No result: tarrow could not find this address",
      "error-boundary": "No result: tarrow could not answer",
      "nothing-submitted": "No result: nothing was submitted",
      "search-failed": "No result: tarrow failed",
    };
    for (const [name, text] of Object.entries(marker)) {
      assert.ok(
        shape(name).body.includes(text),
        `${name} does not carry its own label "${text}" -- so whatever was ` +
          "captured under that name is not what this suite thinks it is",
      );
    }
  });

  test("the flagged shapes really flagged, and the unflagged one really did not", () => {
    assert.ok(
      shape("premises-within-buffer").body.includes(
        NEAR_A_SCHOOL.expectPremisesNameContains,
      ),
    );
    assert.ok(
      shape("premises-within-buffer-by-uncertainty").body.includes(
        FLAGGED_ONLY_BY_UNCERTAINTY.expectPremisesNameContains,
      ),
      "the sign fixture stopped flagging: its premises is 310 m away and only " +
        "lands inside the buffer because the uncertainty radius is SUBTRACTED",
    );
    assert.ok(
      !shape("outside-every-buffer-we-checked").body.includes(
        "What tarrow found inside the buffer",
      ),
    );
  });
});

describe("no rendered copy states or implies permission (FR-014, AC #3)", () => {
  for (const name of EVERY_SHAPE) {
    test(`${name}: none of the hard-denied constructions, at all`, () => {
      const body = shape(name).body;
      for (const [pattern, why] of HARD_DENY) {
        assert.doesNotMatch(
          body,
          pattern,
          `${name}: ${why}. Constitution Principle I -- tarrow never says a ` +
            "person may live somewhere, and no allowlist excuses this one.",
        );
      }
    });

    test(`${name}: no permission vocabulary outside the reviewed negations`, () => {
      const scrubbed = scrubNegations(shape(name).body);
      for (const [pattern, why] of FORBIDDEN) {
        const hits = [...scrubbed.matchAll(pattern)].map((m) => m[0]);
        assert.deepEqual(
          hits,
          [],
          `${name} renders ${JSON.stringify(hits)} (${why}). Spec SC-005 ` +
            "requires zero. If the word is genuinely negated, the phrase goes " +
            "in ALLOWED_NEGATIONS with a reason -- it does not get waved past.",
        );
      }
    });
  }

  test("every allowlisted negation is still actually on a page", () => {
    for (const { phrase, why } of ALLOWED_NEGATIONS) {
      const carriers = shapes.filter((s) => s.body.includes(phrase)).map((s) => s.name);
      assert.ok(
        carriers.length > 0,
        `nothing renders "${phrase}" any more, so its exemption is dead and ` +
          `widening the gate for nothing. Reason on file: ${why}`,
      );
    }
  });

  test('the words "no results" never appear -- they read as good news', () => {
    for (const name of EVERY_SHAPE) {
      assert.doesNotMatch(
        shape(name).body,
        /no results? (?:found|for)/i,
        `${name}: an absence of flags is not a finding of nothing. ` +
          "Principle II: absence is meaningful only against a stated list of " +
          "what was searched.",
      );
    }
  });
});

describe("the strongest available answer is phrased as Principle I requires", () => {
  test("the unflagged result says outside every buffer we checked, in those words", () => {
    const body = shape("outside-every-buffer-we-checked").body;
    assert.ok(
      body.toLowerCase().includes(OUTSIDE_EVERY_BUFFER),
      "the unflagged answer must be phrased as a statement about what WE " +
        "CHECKED, not as an absence of findings",
    );
  });

  test("it qualifies itself on the finding card, not further down the deck", () => {
    // Case-folded on BOTH sides. The body is read off the wire, where the
    // label is title-cased and the qualifier begins a sentence; comparing
    // lowercase needles against the raw body silently never matches, which is
    // a test that passes by finding nothing rather than by proving something.
    const body = shape("outside-every-buffer-we-checked").body.toLowerCase();
    const headline = body.indexOf("outside every buffer we checked");
    const qualifier = body.indexOf("smaller than it sounds");
    assert.ok(
      headline > -1,
      "the unflagged answer does not name itself as outside every buffer",
    );
    assert.ok(
      qualifier > headline,
      "the qualification must come after the finding it qualifies",
    );
    assert.ok(
      qualifier - headline < 400,
      `the qualification sits ${qualifier - headline} characters after the ` +
        "finding, so it is no longer on the same card. A reader who stops " +
        "after the first screen must not stop on good news.",
    );
  });
});

describe("the sheriff step is on every result, including declines and errors (FR-013, AC #7)", () => {
  for (const name of NEEDS_SHERIFF_STEP) {
    test(`${name} carries it`, () => {
      for (const token of SHERIFF_TOKENS) {
        assert.ok(
          shape(name).body.toLowerCase().includes(token),
          `${name} does not tell the reader to confirm with the sheriff's ` +
            `office (missing "${token}")`,
        );
      }
    });
  }

  // ...and /faq carries it too, because that is where the search page's
  // sheriff sentence went. If this fails, the guidance was not relocated --
  // it was deleted.
  test("faq carries it, since the search page now links here instead", () => {
    for (const token of SHERIFF_TOKENS) {
      assert.ok(
        shape("faq").body.toLowerCase().includes(token),
        `/faq is missing "${token}". The search page dropped its sheriff line ` +
          "on the understanding that this page carries it.",
      );
    }
  });
});

describe("the coverage manifest is on every result (FR-009, FR-015, AC #2)", () => {
  for (const name of LOADED_MANIFESTS) {
    test(`${name} names what was not checked, from the ledger`, () => {
      for (const token of MANIFEST_TOKENS) {
        assert.ok(
          shape(name).body.includes(token),
          `${name} does not render the coverage-gap ledger entry "${token}". ` +
            "Principle II: absence of a flag is meaningful only against a " +
            "stated list of what was searched.",
        );
      }
    });

  }

  /**
   * Principle V and Principle VII, CHECKED ON /faq RATHER THAN ON THE ANSWER.
   *
   * These were asserted on every result, because the answer carried a layer
   * registry and a staleness sentence on a card of its own. It no longer does:
   * a table of source layers and fetch dates is provenance -- how tarrow knows
   * what it checked -- and a person looking up an address is not its audience.
   *
   * THE OBLIGATION DID NOT MOVE WITH IT. It is still true that an instance
   * running stale data is a hazard unless it says so, and still true that no
   * layer has been checked by a person. So the gate follows the content to
   * /faq and keeps its full force there: every layer in the registry, every
   * one marked never-verified, and the fetch date on the page. What is
   * forbidden is this disappearing, and that is exactly what these catch.
   */
  test("faq carries the layer registry, every layer never human-verified", () => {
    const table = shape("faq").body.match(
      /<table[^>]*data-table="layers"[^>]*>([\s\S]*?)<\/table>/,
    );
    assert.ok(
      table,
      "/faq renders no layer registry table. It moved off the answer deck on " +
        "the understanding that this page carries it; if it is here neither, " +
        "Principle V's disclosure was deleted rather than relocated.",
    );
    const rows = [...table[1]!.matchAll(/<tr>([\s\S]*?)<\/tr>/g)]
      .map((m) => m[1] ?? "")
      // The header row carries <th>, not <td>.
      .filter((r) => r.includes("<td"));
    assert.equal(
      rows.length,
      7,
      `/faq's layer registry renders ${rows.length} rows; there are 7 layers. ` +
        "A layer missing from this table is a layer whose staleness the reader " +
        "was never told about.",
    );
    for (const row of rows) {
      assert.ok(
        row.includes(NEVER_VERIFIED),
        `/faq has a layer row whose verification date is not rendered as ` +
          `"${NEVER_VERIFIED}": ${row.slice(0, 200)}`,
      );
    }
  });

  test("faq states how old this instance's data is", () => {
    assert.match(
      withoutSsrSeparators(shape("faq").body),
      /last fetched data on \d+ \w+ \d{4}/,
      "Principle VII: an instance running old data is a hazard unless it " +
        "announces itself as one",
    );
  });

  for (const name of SEARCH_RESULTS) {
    test(`${name} says the rule tarrow applied is not verified data`, () => {
      assert.ok(
        shape(name).body.toLowerCase().includes(RULE_NOT_VERIFIED),
        `${name} omits the Principle V disclosure. The 304.8 m buffer is ` +
          "applied without a file-authored, human-verified rule record, and " +
          "the interface must not let a reader think otherwise.",
      );
    });
  }

  /**
   * WHERE THE GAP LIST IS REQUIRED, AND WHERE IT WOULD BE NOISE.
   *
   * Principle II binds the list to a FINDING: "absence of a flag is meaningful
   * only against a stated list of what was searched". The two shapes that
   * produce a finding -- a flagged answer and an unflagged one -- must carry
   * it, and on the unflagged answer it is the whole reason the answer is
   * honest.
   *
   * A refusal has no finding. tarrow could not locate the address, or declined
   * to measure it, and nothing was searched at all -- so there is no absence
   * for the list to qualify. Printing "3 not checked" beside "we measured
   * nothing" states a limit on a measurement that was never made, which reads
   * as though something WAS checked. Those shapes say the stronger thing
   * instead, in their own words: nothing was measured, near or far.
   */
  const FINDINGS = [
    "premises-within-buffer",
    "premises-within-buffer-by-uncertainty",
    "outside-every-buffer-we-checked",
  ];

  for (const name of FINDINGS) {
    test(`${name} leaves what was NOT checked visible, not folded away`, () => {
      const visible = withoutCollapsedContent(shape(name).body);
      for (const token of VISIBLE_GAP_TOKENS) {
        assert.ok(
          visible.includes(token),
          `${name} renders the ledger entry "${token}" only inside a <details>. ` +
            "Principle II: an absence of flags is meaningful only against a " +
            "STATED list of what was searched, and a reader who never opens " +
            "the disclosure was never given that list. Collapse the provenance, " +
            "not the gaps.",
        );
      }
    });
  }

  test("a withdrawn manifest says so rather than saying nothing", () => {
    for (const name of ["search-failed", "error-boundary"]) {
      assert.ok(
        shape(name).body.includes(
          "tarrow cannot tell you what it checked, because it checked nothing",
        ),
        `${name} must withdraw its coverage claim explicitly. A silence where ` +
          "the manifest would be reads as reassurance.",
      );
    }
  });
});

describe("a refusal and a result differ by more than a sentence (User Story 3, AC #4)", () => {
  const RESULTS = ["premises-within-buffer", "outside-every-buffer-we-checked"];
  const REFUSALS = ["declined", "could-not-locate", "search-failed"];

  test("only results render a measured parcel, a distance, or a premises list", () => {
    // The furniture of a page that measured something. These are the card
    // eyebrow and the disclosure rows on the measured-from card, which exists
    // only where tarrow resolved an address to a parcel and measured from it.
    const STRUCTURE = ["Measured from", "Matched by", "Slack this side"];
    for (const name of REFUSALS) {
      for (const marker of STRUCTURE) {
        assert.equal(
          shape(name).body.includes(marker),
          false,
          `${name} renders "${marker}". A page where tarrow measured nothing ` +
            "must not have the furniture of a page where it measured something.",
        );
      }
    }
    // ...and the results do, so the check above is not vacuous.
    for (const name of RESULTS) {
      for (const marker of STRUCTURE) {
        assert.ok(
          shape(name).body.includes(marker),
          `${name} is missing "${marker}", so the assertion above proves ` +
            "nothing about refusals being structurally different.",
        );
      }
    }
  });

  test("every shape carries a distinct label above the headline", () => {
    // TASK-0022 moved this onto an explicit `data-answer-label` attribute
    // rather than reading it off a class name. The label is a CONTRACT --
    // the one string that names a shape and must differ across all of them --
    // and hanging it off a styling hook meant a restyle could silently take
    // the gate with it. An attribute that exists only to be asserted cannot
    // be renamed by accident.
    const labels = [...RESULTS, ...REFUSALS, "nothing-submitted", "error-boundary"].map(
      (name) => {
        const match = shape(name).body.match(
          /data-answer-label="([^"]+)"/,
        );
        assert.ok(match, `${name} renders no answer label at all`);
        return match[1];
      },
    );
    assert.equal(
      new Set(labels).size,
      labels.length,
      `two shapes share a label: ${labels.join(" | ")}`,
    );
  });

  test("the refusals are drawn as an interruption, the results are not", () => {
    // Not colour alone: the modifier class changes the finding card's edge to
    // dashed, and it is asserted here so that a restyle cannot quietly erase
    // the only non-textual difference a reader sees at a glance.
    //
    // TASK-0022 renamed `answer answer--x` to `card card--x` when the banner
    // became a full-screen card. The property asserted is unchanged: each
    // shape is drawn in its own state, and the two no-answer shapes are drawn
    // differently from the two answers.
    for (const name of REFUSALS) {
      assert.match(
        shape(name).body,
        /class="card card--(?:stopped|broken)"/,
        `${name} is drawn like a result`,
      );
    }
    assert.match(
      shape("premises-within-buffer").body,
      /class="card card--flagged"/,
    );
    assert.match(
      shape("outside-every-buffer-we-checked").body,
      /class="card card--measured"/,
    );
  });

  test("declined and could-not-locate say different things about what tarrow knows", () => {
    const declined = shape("declined").body;
    const notFound = shape("could-not-locate").body;
    // The distinction that matters to a reader: tarrow KNOWS where this is and
    // stopped anyway, versus tarrow has no idea where this is. Confusing the
    // two would send somebody to re-type an address that was never the problem.
    assert.ok(declined.includes("Why tarrow stopped"));
    assert.ok(declined.includes("tarrow knows where this is"));
    assert.ok(!notFound.includes("Why tarrow stopped"));
    assert.ok(notFound.includes("could not find this address"));
    assert.ok(notFound.includes("What to try"));
    assert.ok(!declined.includes("What to try"));
  });

  test("neither refusal can be read as an absence of nearby schools", () => {
    assert.ok(
      shape("declined").body.includes("&#x201C;nothing nearby&#x201D;") ||
        shape("declined").body.includes("“nothing nearby”"),
      "declined must say explicitly that it is not 'nothing nearby'",
    );
    assert.ok(shape("could-not-locate").body.includes("Not an answer."));
  });
});

describe("none of it requires JavaScript (FR-015, SC-001, User Story 4 scenario 4)", () => {
  for (const name of EVERY_SHAPE) {
    test(`${name} puts nothing load-bearing behind script`, () => {
      // These bodies are fetched from the running server, so they carry React
      // Router's hydration bootstrap. That is permitted (see
      // docs/decisions/task-0008-01-nonce.md); DEPENDING on it is not.
      //
      // So the assertion is about position, not presence: everything inside
      // <body> that a reader needs comes BEFORE the first <script>. A browser
      // with scripting off, or one that refused the bundle, or a reader who
      // hits Escape while the page is still arriving, has the whole answer.
      // That is what FR-015 and SC-001 actually require.
      const body = shape(name).body;
      const beforeScript = body.split(/<script/i)[0] ?? "";
      const closing = /<\/(?:main|body)>/i;
      assert.match(
        beforeScript,
        closing,
        `${name} reaches its first <script> before it closes <main>, so some ` +
          "of the page depends on script having run. The answer, the coverage " +
          "manifest, and the sheriff step must be readable with scripting off.",
      );
    });

    test(`${name} references no off-origin asset`, () => {
      const refs = [
        ...shape(name).body.matchAll(/\b(?:src|href|srcset|action)="([^"]*)"/g),
      ].map((m) => m[1] ?? "");
      for (const ref of refs) {
        assert.doesNotMatch(ref, /^(?:https?:)?\/\//, `${name} references ${ref}`);
      }
    });
  }

  test("progressive disclosure is <details>, which opens without script", () => {
    const body = shape("premises-within-buffer").body;
    assert.match(body, /<details/);
    assert.match(body, /<summary/);
    // ...and what is inside it is in the document, collapsed rather than absent.
    assert.ok(body.includes("St. Vincent-St. Mary High School"));
  });
});

describe("the typed address never reaches a URL", () => {
  test("the form is a real form that POSTs to a same-origin path", () => {
    const body = shape("form").body;
    const form = body.match(/<form\b[^>]*>/i)?.[0] ?? "";
    assert.match(form, /method="post"/i, "a GET form would put the address in the URL");
    const action = form.match(/action="([^"]*)"/)?.[1] ?? "";
    assert.equal(action, "/answer");
    assert.doesNotMatch(action, /\?/, "a query string in the action is a URL leak");
  });

  test("no result page echoes the address into a link, a title, or an action", () => {
    for (const s of shapes.filter((x) => x.isSearchResult)) {
      const attributes = [
        ...s.body.matchAll(/\b(?:href|action|src|content)="([^"]*)"/g),
      ].map((m) => m[1] ?? "");
      for (const value of attributes) {
        assert.doesNotMatch(
          value.toUpperCase(),
          /GARMAN|MILAN|EASTERN|AKERS|NONEXISTENT/,
          `${s.name} puts a searched address in an attribute (${value}), which ` +
            "reaches history, the address bar, and a Referer header",
        );
      }
      const title = s.body.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
      assert.doesNotMatch(
        title.toUpperCase(),
        /GARMAN|MILAN|EASTERN|AKERS|NONEXISTENT/,
        `${s.name} puts a searched address in the page title, which is the ` +
          "browser tab, the window title, and the history entry",
      );
    }
  });
});
