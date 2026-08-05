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
// `search-failed` -- is produced by starting a SECOND somap server inside this
// container, pointed at a port with no database behind it, and reading ITS
// served document. Same code, same renderer, same wire. See `withoutADatabase`.
//
// WHY THE VOCABULARY LIST HAS AN ALLOWLIST, AND WHY THAT IS NOT A LOOPHOLE
//
// A blanket ban on the word "legal" would force somap to weaken the disclosure
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
const ORIGIN = process.env.SOMAP_APP_ORIGIN ?? "http://app:3000";

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
  [/no restrictions/i, "claims an absence somap cannot know"],
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
      "The last clause of somap's own unverified-rule disclosure, read from " +
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

/** Principle II. Read off the coverage-gap ledger, transcribed here from it. */
const MANIFEST_TOKENS = [
  "ORC 2950.034 protects preschools",
  "Summit County municipalities impose their own residency ordinances",
  "Coverage is Summit County, Ohio only",
  "St. Vincent-St. Mary High School",
] as const;

/** Principle V again: a fetch date may never stand in for a verification date. */
const NEVER_VERIFIED = "never human-verified";

// ---------------------------------------------------------------------------
// Getting the shapes off the wire
// ---------------------------------------------------------------------------

interface Shape {
  readonly name: string;
  readonly status: number;
  readonly body: string;
  /** A result somap produced from a submitted address. */
  readonly isSearchResult: boolean;
  /** ...and one whose coverage manifest was read from data rather than withdrawn. */
  readonly hasLoadedManifest: boolean;
}

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
 * A second somap server, in this container, with nowhere to connect.
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
      "the database-less somap server never came up, so the search-failed " +
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
  test("all ten shapes came back, and none is an empty body", () => {
    assert.equal(shapes.length, 10, `captured ${shapes.map((s) => s.name).join(", ")}`);
    for (const s of shapes) {
      assert.ok(
        s.body.length > 2000,
        `${s.name}: ${s.body.length} bytes. A scan over an empty page finds no ` +
          "forbidden word and proves nothing.",
      );
    }
  });

  test("each shape really is the shape it is named after", () => {
    const marker: Record<string, string> = {
      form: "A street address in Summit County, Ohio",
      "premises-within-buffer": "Result — inside a buffer somap checked",
      "premises-within-buffer-by-uncertainty": "Result — inside a buffer somap checked",
      "outside-every-buffer-we-checked": "Result — outside every buffer we checked",
      declined: "No result — somap stopped instead of measuring",
      "could-not-locate": "No result — somap could not find this address",
      "could-not-locate-empty-input": "No result — somap could not find this address",
      "error-boundary": "No result — somap could not answer",
      "nothing-submitted": "No result — nothing was submitted",
      "search-failed": "No result — somap failed",
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
        "What somap found inside the buffer",
      ),
    );
  });
});

describe("no rendered copy states or implies permission (FR-014, AC #3)", () => {
  for (const name of [
    "form",
    "premises-within-buffer",
    "premises-within-buffer-by-uncertainty",
    "outside-every-buffer-we-checked",
    "declined",
    "could-not-locate",
    "could-not-locate-empty-input",
    "error-boundary",
    "nothing-submitted",
    "search-failed",
  ]) {
    test(`${name}: none of the hard-denied constructions, at all`, () => {
      const body = shape(name).body;
      for (const [pattern, why] of HARD_DENY) {
        assert.doesNotMatch(
          body,
          pattern,
          `${name}: ${why}. Constitution Principle I -- somap never says a ` +
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
    for (const s of shapes) {
      assert.doesNotMatch(
        s.body,
        /no results? (?:found|for)/i,
        `${s.name}: an absence of flags is not a finding of nothing. ` +
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

  test("it qualifies itself in the banner, not further down the page", () => {
    const body = shape("outside-every-buffer-we-checked").body;
    const headline = body.indexOf("Outside every buffer we checked.");
    const qualifier = body.indexOf("smaller than it sounds");
    assert.ok(headline > -1 && qualifier > headline);
    assert.ok(
      qualifier - headline < 400,
      "the qualification must sit immediately under the headline. A reader " +
        "who stops reading after the first line must not stop on good news.",
    );
  });
});

describe("the sheriff step is on every result, including declines and errors (FR-013, AC #7)", () => {
  for (const s of shapes) {
    test(`${s.name} carries it`, () => {
      for (const token of SHERIFF_TOKENS) {
        assert.ok(
          s.body.toLowerCase().includes(token),
          `${s.name} does not tell the reader to confirm with the sheriff's ` +
            `office (missing "${token}")`,
        );
      }
    });
  }
});

describe("the coverage manifest is on every result (FR-009, FR-015, AC #2)", () => {
  for (const s of shapes.filter((x) => x.hasLoadedManifest)) {
    test(`${s.name} names what was not checked, from the ledger`, () => {
      for (const token of MANIFEST_TOKENS) {
        assert.ok(
          s.body.includes(token),
          `${s.name} does not render the coverage-gap ledger entry "${token}". ` +
            "Principle II: absence of a flag is meaningful only against a " +
            "stated list of what was searched.",
        );
      }
    });

    test(`${s.name} reports every layer as never human-verified`, () => {
      const occurrences = s.body.split(NEVER_VERIFIED).length - 1;
      assert.equal(
        occurrences,
        7,
        `${s.name} renders "${NEVER_VERIFIED}" ${occurrences} times and there ` +
          "are 7 layers. A null verification date must render as NEVER -- not " +
          "as a blank cell, not as a dash, and never as a fetch date wearing a " +
          "verification's name (Principle V).",
      );
    });

    test(`${s.name} states how old this instance's data is`, () => {
      assert.match(
        s.body,
        /last fetched data on \d+ \w+ \d{4}/,
        "Principle VII: an instance running old data is a hazard unless it " +
          "announces itself as one",
      );
    });
  }

  for (const s of shapes.filter((x) => x.isSearchResult)) {
    test(`${s.name} says the rule somap applied is not verified data`, () => {
      assert.ok(
        s.body.toLowerCase().includes(RULE_NOT_VERIFIED),
        `${s.name} omits the Principle V disclosure. The 304.8 m buffer is ` +
          "applied without a file-authored, human-verified rule record, and " +
          "the interface must not let a reader think otherwise.",
      );
    });
  }

  test("a withdrawn manifest says so rather than saying nothing", () => {
    for (const name of ["search-failed", "error-boundary"]) {
      assert.ok(
        shape(name).body.includes(
          "somap cannot tell you what it checked, because it checked nothing",
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
    const STRUCTURE = [
      "The parcel somap measured from",
      "Distance somap measured",
      "How the parcel was attached to the address",
    ];
    for (const name of REFUSALS) {
      for (const marker of STRUCTURE) {
        assert.equal(
          shape(name).body.includes(marker),
          false,
          `${name} renders "${marker}". A page where somap measured nothing ` +
            "must not have the furniture of a page where it measured something.",
        );
      }
    }
    // ...and the results do, so the check above is not vacuous.
    assert.ok(shape("premises-within-buffer").body.includes("Distance somap measured"));
    assert.ok(
      shape("outside-every-buffer-we-checked").body.includes(
        "The parcel somap measured from",
      ),
    );
  });

  test("every shape carries a distinct label above the headline", () => {
    const labels = [...RESULTS, ...REFUSALS, "nothing-submitted", "error-boundary"].map(
      (name) => {
        const match = shape(name).body.match(
          /class="answer__label">([^<]+)</,
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
    // Not colour alone: the modifier class changes the border to dashed, and
    // it is asserted here so that a restyle cannot quietly erase the only
    // non-textual difference a reader sees at a glance.
    for (const name of REFUSALS) {
      assert.match(
        shape(name).body,
        /class="answer answer--(?:stopped|broken)"/,
        `${name} is drawn like a result`,
      );
    }
    assert.match(
      shape("premises-within-buffer").body,
      /class="answer answer--flagged"/,
    );
    assert.match(
      shape("outside-every-buffer-we-checked").body,
      /class="answer answer--measured"/,
    );
  });

  test("declined and could-not-locate say different things about what somap knows", () => {
    const declined = shape("declined").body;
    const notFound = shape("could-not-locate").body;
    assert.ok(declined.includes("Why somap stopped"));
    assert.ok(declined.includes("somap knows where this is"));
    assert.ok(!notFound.includes("Why somap stopped"));
    assert.ok(notFound.includes("somap does not know where this address is"));
    assert.ok(notFound.includes("Why this happens, and what to try"));
    assert.ok(!declined.includes("Why this happens, and what to try"));
  });

  test("neither refusal can be read as an absence of nearby schools", () => {
    assert.ok(
      shape("declined").body.includes("It is not &#x201C;nothing nearby&#x201D;") ||
        shape("declined").body.includes("It is not “nothing nearby”"),
    );
    assert.ok(shape("could-not-locate").body.includes("This is not an answer."));
  });
});

describe("none of it requires JavaScript (FR-015, SC-001, User Story 4 scenario 4)", () => {
  for (const s of shapes) {
    test(`${s.name} contains no script element of any kind`, () => {
      assert.doesNotMatch(
        s.body,
        /<script/i,
        `${s.name} ships script. somap ships none: the CSP is script-src 'self' ` +
          "with no nonce, so anything inline would be dead code, and a reader " +
          "verifying the page should find nothing to audit.",
      );
    });

    test(`${s.name} references no off-origin asset`, () => {
      const refs = [...s.body.matchAll(/\b(?:src|href|srcset|action)="([^"]*)"/g)].map(
        (m) => m[1] ?? "",
      );
      for (const ref of refs) {
        assert.doesNotMatch(ref, /^(?:https?:)?\/\//, `${s.name} references ${ref}`);
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
