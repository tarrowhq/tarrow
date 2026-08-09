// THE WORDS.
//
// This file is the deliverable of Phase 5, rewritten for length by TASK-0017
// and rebuilt as a card deck by TASK-0022. The board card for TASK-0002 said it
// plainly: "The hardest part is not the map, it is the language."
//
// Who is reading this. Somebody on a sex offender registry, looking for
// somewhere to live, sometimes against a thirty-day order to move. They are
// not a lawyer. They may be reading on a phone, on a library computer, at the
// end of a long day, frightened. Copy written to cover tarrow rather than to be
// understood by that person has failed, however defensible it would look in a
// disclaimer.
//
// FIVE RULES THIS FILE IS WRITTEN UNDER
//
//   1. NEVER STATE OR IMPLY PERMISSION. Constitution Principle I: tarrow never
//      says approved, legal, permitted, or clear. The strongest sentence
//      available is "outside every buffer we checked", and it is only honest
//      when the reader can see, on the same page, what was not checked.
//      app/tests/copy.test.ts scans the raw response body of every result
//      shape for that vocabulary and fails on it.
//
//   2. AN ABSENCE OF FLAGS IS NOT GOOD NEWS. "No results found" reads as good
//      news, so that phrasing does not appear here. The unflagged answer is
//      headed with what it actually is, and the sentence immediately under
//      the headline says the finding is smaller than it sounds -- on the same
//      screen, before the reader has moved anywhere.
//
//   3. A REFUSAL AND A RESULT MUST BE UNMISTAKABLE APART. Spec User Story 3
//      requires "more than a sentence's wording". So they differ in the label
//      above the headline, the headline, the border (dashed for every shape
//      that is not an answer), and -- structurally -- in which cards exist
//      at all: no refusal renders a residence, a distance, or a premises card,
//      because there is none.
//
//   4. THE SHERIFF STEP IS THE RECOMMENDED ACTION, NOT A DISCLAIMER. It is
//      written as the next thing to do and as what to take with you, on every
//      shape including the ones where tarrow failed. It is the only card drawn
//      in reversed ink, because it is the only thing here the reader can DO.
//
//   5. LENGTH IS A SAFETY PROPERTY, NOT A STYLE PREFERENCE (TASK-0017). This
//      page used to run the answer, then six full-length sections of
//      qualification, every one of them true. A reader under a deadline read
//      the first screen. Disclosure that is scrolled past has not been
//      delivered, so Principle II was being satisfied on the wire and failed
//      in the head -- which is the only place it matters.
//
//      The rule that came out of that, and that a future editor should apply
//      rather than reverse: WHAT TARROW DID NOT CHECK STAYS VISIBLE; HOW TARROW
//      KNOWS WHAT IT CHECKED COLLAPSES. The gap list, the staleness statement,
//      and the flagged premises with their distances are on the surface,
//      unfolded, always. The provenance tables, the per-premises arithmetic,
//      and the parcel resolution are one click away in a <details> -- present
//      in the served HTML, never absent from it (spec FR-015). General
//      explanation that belongs to no particular answer lives at /faq.
//
//      A LINK IS NOT A STATEMENT. Moving the coverage manifest itself to /faq
//      would be a Principle II violation dressed as an information-architecture
//      improvement, and it is the specific mistake this comment exists to stop.
//
//      TASK-0022 TOOK THAT RULE FURTHER, STRUCTURALLY. Cutting length could
//      only go so far: the gaps still sat in a section below the answer,
//      competing with everything else on a scrolling page and losing. Now each
//      one is its own screen and the reader moves THROUGH them rather than
//      past them. Principle II stops depending on the reader's stamina. The
//      direction and its reasoning are in
//      docs/decisions/task-0022-direction-e-one-card.md.
//
// AND ONE RULE ABOUT MECHANISM: nothing in this file computes anything.
// Phase 3's handoff: "A renderer that derives 'no flags means fine' is the
// failure the type gate exists to prevent; it cannot construct a clearance,
// but it can still write one as a sentence." Every number here comes from the
// result; every limitation comes from the coverage-gap ledger; the only
// arithmetic is a unit conversion in app/format.ts.
//
// AND ONE ABOUT DELIVERY: nothing on this surface may wait for script. The page
// hydrates (app/root.tsx), but the manifest, the outside-every-buffer phrasing,
// and the sheriff guidance are in the server-rendered document on every shape
// (spec FR-015) -- collapsed is allowed, absent is not. The deck is CSS
// scroll-snap and nothing else, so with scripting off it is a long page with
// big sections, which is the whole answer. Progressive disclosure is
// <details>/<summary>, which opens natively.
//
// WHERE THE REST OF IT LIVES. This file was 1089 lines carrying the masthead,
// every result shape, the coverage manifest, the distance scale, and the
// sheriff step, and the safety properties above were impossible to find among
// them. TASK-0022 split it by responsibility:
//
//   app/app/cards.tsx          the deck's primitives -- Card, Eyebrow, the
//                              SVG bars. They do not know what they hold.
//   app/app/finding-view.tsx   what tarrow FOUND: the finding card, one card
//                              per premises, the parcel, the ambiguity, the
//                              sheriff card.
//   app/app/manifest-view.tsx  what tarrow did NOT check, and how it knows
//                              what it did: the gap cards and the provenance.
//
// This file keeps the five shapes and the order they are assembled in, which
// is the part that carries the argument.

import { Card, CardTitle, Eyebrow, Measured, Prose } from "./cards.tsx";
import {
  AmbiguityCard,
  FindingCard,
  LookElsewhereCard,
  PremisesCard,
  ResidenceCard,
  SHERIFF_FOOTER,
  SheriffCard,
} from "./finding-view.tsx";
import { count, feet, plural } from "./format.ts";
import { CoverageLine, CoverageWithdrawnCard } from "./manifest-view.tsx";
import type { SearchResult } from "../server/result.ts";

// ---------------------------------------------------------------------------
// The furniture every shape carries
// ---------------------------------------------------------------------------

/**
 * The wordmark and what tarrow is, as the deck's first card on the ask screen
 * and as a compact header nowhere else.
 *
 * ON THE ANSWER DECK THERE IS NO MASTHEAD. That is the point of direction E:
 * the finding owns its screen and nothing competes with it -- not a nav, not a
 * wordmark, not a strapline. tarrow identifies itself on the search screen the
 * reader arrived through and on the cards at the end of the deck.
 */
export function Masthead() {
  return (
    <header className="masthead">
      <p className="masthead__name">
        <a href="/">tarrow</a>
      </p>
      <p className="masthead__where">
        School-premises distances for Summit County, Ohio. A helper, not an
        authority.
      </p>
    </header>
  );
}

/**
 * THE LAST CARD, and it is a door rather than a paragraph.
 *
 * What was here before: a card headed "tarrow kept nothing", explaining across
 * three paragraphs that the address was not logged, not in the URL, not in a
 * database, and that the page is marked never to be stored -- with "check
 * another address" as a small link at the bottom of it.
 *
 * Both halves of that were wrong. The privacy paragraph is tarrow explaining
 * itself to somebody who did not ask, at the moment they have finished reading
 * their answer; it is true, it is on /faq, and it does not belong on the way
 * out. And the one thing a reader at the end of a deck actually wants to do --
 * look up another address -- was a link inside a card about something else.
 *
 * So the last screen is the action, and nothing else.
 */
export function CheckAnotherCard() {
  return (
    <Card kind="act">
      <CardTitle>Check another address</CardTitle>
      <p className="act__go">
        <a href="/">Start again</a>
      </p>
    </Card>
  );
}

/**
 * The sheriff step, for the shapes where tarrow measured nothing.
 *
 * Rule 4 binds every shape including the failures -- a page where tarrow could
 * not answer must still point at the office that can.
 */
function sheriffStepsFor(kind: SearchResult["kind"]): readonly string[] {
  switch (kind) {
    case "outside-every-buffer-we-checked":
      return [
        "Give the address exactly as you typed it.",
        "Say tarrow measured no school premises inside the buffer it checked.",
        "Say it checked school premises only, and no city or village rule at all.",
      ];
    case "declined":
      return [
        "Give the address exactly as you typed it.",
        "Say tarrow found the address and then refused to measure it.",
        "Ask them to check it against the state's school distance rule.",
      ];
    case "could-not-locate":
      return [
        "Give the address exactly as you typed it.",
        "Say tarrow could not find it and measured nothing.",
        "Ask them to check it against the state's school distance rule.",
      ];
    case "search-failed":
      return [
        "Give the address exactly as you typed it.",
        "Say tarrow broke before it checked anything, so nothing was measured.",
        "Ask them to check it against the state's school distance rule.",
      ];
    default:
      return [
        "Give the address exactly as you typed it.",
        "Say what tarrow reported, and that it checked school premises only.",
        "Ask them to check it against the state's school distance rule.",
      ];
  }
}

// ---------------------------------------------------------------------------
// The five shapes
// ---------------------------------------------------------------------------

/** Shape 1: at least one school premises is inside the buffer. */
function WithinBuffer({
  result,
}: {
  result: Extract<SearchResult, { kind: "premises-within-buffer" }>;
}) {
  const n = result.premises.length;
  return (
    <>
      {result.ambiguity === null ? null : (
        <AmbiguityCard ambiguity={result.ambiguity} />
      )}

      <FindingCard
        tone="flagged"
        label="Result: inside a buffer tarrow checked"
        count={count(n)}
        unit={`school ${plural(n, "premises", "premises")} within ${feet(
          result.bufferMeters,
        )} ft`}
        isNot={
          <>
            Ohio counts the <em>land</em>, not the building, so one school can
            appear more than once.
          </>
        }
        coverage={<CoverageLine manifest={result.manifest} />}
        more={plural(n, "The one", "Each one")}
      />

      {result.premises.map((p, i) => (
        <PremisesCard
          key={p.premisesId}
          premises={p}
          index={i + 1}
          total={n}
        />
      ))}

      <LookElsewhereCard premises={result.premises} />

      <ResidenceCard residence={result.residence} />
    </>
  );
}

/**
 * Shape 2: the strongest statement tarrow is permitted to make.
 *
 * The single most dangerous screen in this application. "No results found"
 * reads as good news to a frightened person, so the headline is not that, and
 * the qualification is on the same screen as the finding rather than at the
 * bottom under a heading nobody reads.
 *
 * The count is deliberately drawn as a numeral. Zero is the honest value and
 * the eyebrow says what it is a count OF -- premises inside a buffer tarrow
 * checked -- so the number cannot be read as a verdict about the address.
 */
function OutsideEveryBuffer({
  result,
}: {
  result: Extract<SearchResult, { kind: "outside-every-buffer-we-checked" }>;
}) {
  return (
    <>
      {result.ambiguity === null ? null : (
        <AmbiguityCard ambiguity={result.ambiguity} />
      )}

      <FindingCard
        tone="measured"
        label="Result: outside every buffer we checked"
        count="0"
        unit={`of the schools we hold are within ${feet(
          result.bufferMeters,
        )} ft`}
        isNot={
          <>
            <strong>Smaller than it sounds.</strong> A measurement, not a
            decision.
          </>
        }
        coverage={<CoverageLine manifest={result.manifest} />}
        more="Your next step"
      />

      <SheriffCard
        steps={sheriffStepsFor(result.kind)}
        footer={SHERIFF_FOOTER}
      />

      <ResidenceCard residence={result.residence} />
    </>
  );
}

/**
 * Shape 3: tarrow found the address and refused to measure it.
 *
 * Structurally distinct from shape 4 on purpose: this deck has a "why tarrow
 * stopped" card, no residence, no distance, and a dashed edge. Spec User Story
 * 3 scenario 4 requires the difference to be more than wording.
 */
function Declined({
  result,
}: {
  result: Extract<SearchResult, { kind: "declined" }>;
}) {
  return (
    <>
      <FindingCard
        tone="stopped"
        label="No result: tarrow stopped instead of measuring"
        count="—"
        unit="tarrow will not answer for this address"
        isNot={
          <>
            Not &ldquo;nothing nearby&rdquo;. Nothing was measured at all.
          </>
        }
        more="Why tarrow stopped"
      />

      <Card kind="gap">
        <Eyebrow>Why tarrow stopped</Eyebrow>
        <CardTitle>tarrow knows where this is, and stopped anyway</CardTitle>
        <Prose soft>
          <p>{result.detail}</p>
          <p>
            A number here would have come out <em>too large</em>, which is how
            an address gets treated as outside a buffer when it is not.
          </p>
          <p className="reason">
            <Measured>{result.reason}</Measured>
          </p>
        </Prose>
      </Card>

      <SheriffCard
        steps={sheriffStepsFor(result.kind)}
        footer={
          <>
            That office can answer for an address tarrow will not measure.{" "}
            <a href="/faq">What tarrow is, and what it is not</a>.
          </>
        }
      />
    </>
  );
}

/**
 * Shape 4: tarrow could not resolve the address at all.
 *
 * Never a ZIP centroid, never a street centroid, never a fuzzy match, never a
 * nearby-parcel consolation -- there is no code path that could produce one
 * (spec FR-007). This deck says so, because a reader who does not know that
 * will assume tarrow tried its best and found nothing near.
 */
function CouldNotLocate({
  result,
}: {
  result: Extract<SearchResult, { kind: "could-not-locate" }>;
}) {
  return (
    <>
      <FindingCard
        tone="stopped"
        label="No result: tarrow could not find this address"
        count="—"
        unit="tarrow could not find this address, so it checked nothing"
        isNot={
          <>
            <strong>Not an answer.</strong> Nothing was measured, near or far.
          </>
        }
        more="What to try"
      />

      <Card kind="gap">
        <Eyebrow>What to try</Eyebrow>
        <CardTitle>Three likely reasons</CardTitle>
        <Prose soft>
          <ul>
            <li>It is outside Summit County, Ohio.</li>
            <li>
              The county writes it differently — try it as it appears on a bill:
              road type (RD, ST, AVE), direction (N, W), unit number.
            </li>
            <li>The county has not published a point for it.</li>
          </ul>
          <p>
            tarrow does not correct spelling or fall back to a nearby point. A
            confident answer about the wrong building is worse than none.
          </p>
          <p className="reason">
            <Measured>{result.reason}</Measured>
          </p>
        </Prose>
      </Card>

      <SheriffCard
        steps={sheriffStepsFor(result.kind)}
        footer={
          <>
            That office can answer for an address tarrow could not find.{" "}
            <a href="/faq">What tarrow is, and what it is not</a>.
          </>
        }
      />
    </>
  );
}

/** Shape 5: tarrow broke. */
function SearchFailed({
  result,
}: {
  result: Extract<SearchResult, { kind: "search-failed" }>;
}) {
  return (
    <>
      <FindingCard
        tone="broken"
        label="No result: tarrow failed"
        count="—"
        unit="tarrow broke before it could check anything"
        isNot={
          <>
            A fault here, not a finding about your address. A broken page is
            not a quiet address.
          </>
        }
        more="What went wrong"
      />

      <Card kind="gap">
        <Eyebrow>What went wrong</Eyebrow>
        <CardTitle>A fault in this copy of tarrow</CardTitle>
        <Prose soft>
          <p>{result.detail}</p>
          <p>
            Try again in a few minutes. If it keeps happening, whoever runs this
            copy needs to look at it.
          </p>
          <p className="reason">
            <Measured>{result.reason}</Measured>
          </p>
        </Prose>
      </Card>

      {/* A BROKEN TARROW MUST WITHDRAW ITS COVERAGE CLAIM RATHER THAN GO
          QUIET. Every working answer carries a line saying what was not
          checked; a failure carries none, and a reader who has seen the
          working version could take that silence for "nothing to report".
          This is the one shape where the manifest cannot be read at all, so
          it says so. */}
      {result.manifest.availability === "read-from-data" ? null : (
        <CoverageWithdrawnCard statement={result.manifest.statement} />
      )}

      <SheriffCard
        steps={sheriffStepsFor(result.kind)}
        footer={
          <>
            That office can answer even when tarrow is broken.{" "}
            <a href="/faq">What tarrow is, and what it is not</a>.
          </>
        }
      />
    </>
  );
}

/**
 * Exhaustive over SEARCH_RESULT_KINDS. The `never` branch is a compile-time
 * check: a sixth variant added to the union breaks the build here rather than
 * rendering as a blank page, and a blank page after typing an address reads
 * like a clean answer.
 */
function Shape({ result }: { result: SearchResult }) {
  switch (result.kind) {
    case "premises-within-buffer":
      return <WithinBuffer result={result} />;
    case "outside-every-buffer-we-checked":
      return <OutsideEveryBuffer result={result} />;
    case "declined":
      return <Declined result={result} />;
    case "could-not-locate":
      return <CouldNotLocate result={result} />;
    case "search-failed":
      return <SearchFailed result={result} />;
    default: {
      const unhandled: never = result;
      throw new Error(`unrendered result variant: ${JSON.stringify(unhandled)}`);
    }
  }
}

export { CoverageWithdrawnCard, SheriffCard };

/**
 * THE DECK, AND THE ORDER THAT MAKES IT AN ARGUMENT.
 *
 *   ambiguity (only when the address means several parcels)
 *   THE FINDING          the number, what it is not, and what was not checked
 *   each premises        one screen each, flagged shapes only
 *   the action           call the office, or -- when tarrow found schools --
 *                        look somewhere else instead
 *   measured from        the parcel, and the sentence that can invalidate it
 *   check another        the way out
 *
 * WHAT WAS REMOVED, AND WHY IT IS NOT A LOSS OF DISCLOSURE. The deck used to
 * continue past "measured from" with five full-screen coverage gaps, a card of
 * layer provenance, a card restating that the rule is unverified, and a card
 * explaining that tarrow logs nothing. Every one was true. Together they were
 * eight screens of tarrow talking about itself, arriving after the reader
 * already had their answer, and a reader under a deadline read none of them.
 *
 * That is rule 5 turned on its own remedy: text nobody reads was not
 * delivered, whether it is skipped for being below the fold or for being a
 * wall. So the facts moved to where they are read -- what was not checked is
 * ONE LINE beside the number, on the finding card, where a reader sees it in
 * the same glance as the answer it qualifies. The full ledger, the provenance,
 * the staleness dates, and the privacy account are on /faq, in full, for
 * anyone who wants them.
 *
 * PRINCIPLE II IS SATISFIED ON THE ANSWER, NOT DELEGATED TO A LINK. The line
 * is on the card, rendered from the ledger, and copy.test.ts requires its
 * labels to be present and outside every <details> on every result. Moving
 * that line itself to /faq would be the violation manifest-view.tsx warns
 * about; shortening it is not.
 *
 * WHY THE SHAPE OWNS ITS OWN ACTION CARD. What to do next depends on what
 * tarrow found. A flagged answer recommends looking elsewhere and offers the
 * call; every other shape recommends the call, because tarrow does not know
 * and that office does. The obligation is identical on every shape; only the
 * words differ.
 */
export function ResultPage({ result }: { result: SearchResult }) {
  return (
    <main className="deck">
      <Shape result={result} />
      <CheckAnotherCard />
    </main>
  );
}
