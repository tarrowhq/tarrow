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

import { Card, CardTitle, Eyebrow, More, Prose } from "./cards.tsx";
import {
  AmbiguityCard,
  FindingCard,
  PremisesCard,
  ResidenceCard,
  SHERIFF_FOOTER,
  SheriffCard,
  flaggedSteps,
} from "./finding-view.tsx";
import { count, metresAndFeet, plural } from "./format.ts";
import {
  CoverageCards,
  CoverageWithdrawnCard,
  RuleNotVerifiedCard,
} from "./manifest-view.tsx";
import type { CoverageManifest, SearchResult } from "../server/result.ts";

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
 * The last card: what tarrow kept, which is nothing.
 *
 * On a shared or library computer this is not a footnote in the legal sense --
 * it is the answer to "will the next person at this machine see what I typed".
 */
export function PrivacyCard() {
  return (
    <Card kind="detail">
      <Eyebrow>Before you go</Eyebrow>
      <CardTitle>tarrow kept nothing</CardTitle>
      <Prose soft>
        <p>
          tarrow did not write down the address you typed: not in a log, not in
          this page&rsquo;s web address, not in a database, and not on its way
          anywhere else. This page is also marked never to be stored by your
          browser, which matters on a shared or library computer.
        </p>
        <p>
          You are not asked to take that on trust:{" "}
          <a href="/faq">the procedure for checking it yourself</a>.
        </p>
        <p>
          <a href="/">Check another address</a>
        </p>
      </Prose>
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
      <FindingCard
        tone="flagged"
        label="Result: inside a buffer tarrow checked"
        count={count(n)}
        unit={`school ${plural(
          n,
          "premises is",
          "premises are",
        )} within ${metresAndFeet(result.bufferMeters)} of this address`}
        isNot={
          <>
            Ohio&rsquo;s rule is written about the <em>premises</em> (the parcel
            of land) rather than the building, so a school that owns several
            parcels appears more than once. Repeated names are not a mistake.
          </>
        }
        more={plural(n, "The one tarrow found", "Each one tarrow found")}
      />

      {result.premises.map((p, i) => (
        <PremisesCard
          key={p.premisesId}
          premises={p}
          index={i + 1}
          total={n}
        />
      ))}

      <SheriffCard
        steps={flaggedSteps(result.premises)}
        footer={SHERIFF_FOOTER}
      />

      <ResidenceCard residence={result.residence} />

      {result.ambiguity === null ? null : (
        <AmbiguityCard ambiguity={result.ambiguity} />
      )}
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
      <FindingCard
        tone="measured"
        label="Result: outside every buffer we checked"
        count="0"
        unit={`school premises within ${metresAndFeet(
          result.bufferMeters,
        )} — of the ones tarrow holds a boundary for`}
        isNot={
          <>
            <strong>That is smaller than it sounds.</strong> It is a
            measurement, not a decision. Whole categories of place were never
            checked at all — they are the next screens, and you should read
            them before you rely on anything here.
          </>
        }
        more="What tarrow did not check"
      />

      <SheriffCard
        steps={sheriffStepsFor(result.kind)}
        footer={SHERIFF_FOOTER}
      />

      <ResidenceCard residence={result.residence} />

      {result.ambiguity === null ? null : (
        <AmbiguityCard ambiguity={result.ambiguity} />
      )}
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
        unit="tarrow will not give an answer for this address"
        isNot={
          <>
            It measured no distances at all, so nothing here is a finding about
            this address. It is not &ldquo;nothing nearby&rdquo;, and it is not
            &ldquo;address not found&rdquo;.
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
            tarrow could have produced a number here. It refused because the
            number would have been wrong in the dangerous direction: it would
            tend to come out <em>too large</em>, and a distance that is too
            large is exactly how an address gets treated as being outside a
            buffer when it is not. Being annoying is recoverable; being wrong
            that way is not.
          </p>
          <p>
            That is not a reason to give up on the address. The sheriff&rsquo;s
            office can answer for one tarrow will not measure.
          </p>
          <p>
            <small>
              tarrow records the reason for this as <code>{result.reason}</code>.
            </small>
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
            <strong>This is not an answer.</strong> tarrow does not know where
            this address is, so it measured no distances and found nothing,
            neither near nor far.
          </>
        }
        more="Why this happens, and what to try"
      />

      <Card kind="gap">
        <Eyebrow>Why this happens, and what to try</Eyebrow>
        <CardTitle>Three likely reasons</CardTitle>
        <Prose soft>
          <p>{result.detail}</p>
          <ul>
            <li>
              <strong>The address is not in Summit County, Ohio.</strong> tarrow
              holds no data for anywhere else, and it cannot tell an
              out-of-county address apart from a misspelled one, so both land
              here.
            </li>
            <li>
              <strong>The county writes it differently.</strong> Try it as it
              appears on a tax bill, a utility bill, or a lease: the road type
              (RD, ST, AVE), a direction (N, W), or a unit number can all be the
              difference.
            </li>
            <li>
              <strong>The county has not published a point for it.</strong> New
              addresses, and some municipalities generally, are thinly covered.
              tarrow says so rather than filling the hole in.
            </li>
          </ul>
          <p>
            tarrow will not guess: it does not correct spelling, it does not
            fall back to the middle of the street or the centre of the ZIP code,
            and it does not offer the nearest parcel it happened to find
            instead. A confident answer about the wrong building is more
            dangerous to you than no answer at all.
          </p>
          <p>
            <small>
              tarrow records the reason for this as <code>{result.reason}</code>.
            </small>
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
            This is a fault in this copy of tarrow, not a finding about your
            address. Nothing was measured and nothing was found. A broken page
            is not a quiet address.
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
            Try again in a few minutes. If it keeps happening, this instance of
            tarrow is broken and whoever runs it needs to look at it; until then
            it can tell you nothing.
          </p>
          <p>
            tarrow deliberately keeps no error report that could carry what you
            typed, so there is no record of this failure holding your address
            anywhere: not in a log, not in a crash report, not on the screen.
            That is the trade it makes: a fault here is harder for its
            maintainers to diagnose, and your address is not written down.
          </p>
          <p>
            <small>
              tarrow records the reason for this as <code>{result.reason}</code>.
            </small>
          </p>
        </Prose>
      </Card>

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

/** The coverage manifest's cards, whichever way it came back. */
export function CoverageManifestView({
  manifest,
}: {
  manifest: CoverageManifest;
}) {
  return <CoverageCards manifest={manifest} />;
}

export { CoverageWithdrawnCard, RuleNotVerifiedCard, SheriffCard };

/**
 * Every result deck, whatever its shape, carries: the answer, the sheriff
 * step, the coverage manifest, and the unverified-rule disclosure. All
 * server-rendered, none of it behind JavaScript (spec FR-015).
 *
 * THE ORDER IS THE ARGUMENT, and TASK-0022 did not change it.
 *
 * The sheriff step comes second, immediately after the finding. It used to sit
 * fourth, below the manifest and the rule disclosure. But it is the one thing
 * on this surface the reader can DO -- rule 4 calls it the recommended action
 * rather than a disclaimer, the constitution's promise is "an hour of searching
 * plus one confirming phone call", and TASK-0008 AC #4 asks for the registering
 * agency to be identified and easy to reach.
 *
 * What did NOT move is the manifest. It follows the action directly, because
 * Principle II binds every result to state what was not checked. The comment on
 * manifest-view.tsx names moving it to /faq as the specific mistake to avoid;
 * demoting it to the end of the deck would be the same mistake by a slower
 * route.
 *
 * WHY THE SHAPE OWNS ITS OWN SHERIFF CARD. Each shape renders one, positioned
 * within its own cards, because what to carry into the phone call depends on
 * what tarrow found -- a flagged deck reads out the premises by name, and a
 * refusal says tarrow measured nothing. The obligation is identical on every
 * shape; only the words differ.
 */
export function ResultPage({ result }: { result: SearchResult }) {
  return (
    <main className="deck">
      <Shape result={result} />
      <CoverageManifestView manifest={result.manifest} />
      <RuleNotVerifiedCard rule={result.manifest.ruleContent} />
      <PrivacyCard />
    </main>
  );
}
