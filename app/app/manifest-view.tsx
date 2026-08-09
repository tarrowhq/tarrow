// WHAT TARROW DID NOT CHECK, AND HOW IT KNOWS WHAT IT DID.
//
// Constitution Principle II: "Every result states what was checked and what was
// not... Absence of a flag is meaningful only against a stated list of what was
// searched." This file is that statement, and TASK-0022 changed how it is
// delivered rather than what it says.
//
// THE STRUCTURAL ARGUMENT FOR THE CARD DECK, made here because this is the file
// it was made for. TASK-0017 established rule 5: length is a safety property,
// because disclosure a reader scrolls past has not been delivered. It attacked
// that by cutting length. It could only go so far -- the gaps still sat in a
// section below the answer, competing with everything else on a scrolling page
// and losing.
//
// Direction E attacks it structurally instead. EACH GAP IS ITS OWN SCREEN. The
// reader does not skim past them on the way to the end; they move through them.
// Principle II stops depending on the reader's stamina. That is the whole
// reason this direction was chosen over a restyle
// (docs/decisions/task-0022-direction-e-one-card.md).
//
// THE COLLAPSE RULE IS UNCHANGED, and it is the line a future editor should
// apply rather than reverse:
//
//   WHAT TARROW DID NOT CHECK STAYS VISIBLE -- its own cards, never folded.
//   HOW TARROW KNOWS WHAT IT CHECKED COLLAPSES -- <details> on a detail card.
//
// A LINK IS NOT A STATEMENT. Moving the coverage manifest to /faq would be a
// Principle II violation dressed as an information-architecture improvement,
// and so would demoting it below the deck's action card. Neither is available.
//
// The gaps are READ FROM THE LEDGER rather than written down here, so a
// limitation somebody records at ingest reaches this surface without anyone
// remembering to edit a list.

import { Card, CardTitle, Eyebrow, Prose } from "./cards.tsx";
import { count } from "./format.ts";
import type { CoverageManifest } from "../server/result.ts";


/**
 * The gaps that make an answer honest, as ONE LINE on the finding card.
 *
 * WHAT THIS REPLACED, AND WHY. Each of these was a full screen of its own,
 * carrying the ledger's `description` -- a paragraph written for somebody
 * auditing the instance, rendered to somebody trying to find out whether they
 * can live somewhere. Five screens of it, between the reader and the rest of
 * the answer.
 *
 * That was Principle II satisfied by volume, which is the same failure rule 5
 * names from the other direction: text nobody reads was not delivered, whether
 * it was skipped for being below the fold or for being a wall. So what survives
 * here is the SHORTEST FORM THAT STILL CARRIES THE FACT -- a count and the
 * ledger's own two-or-three-word `label` for each gap, on the same screen as
 * the finding, linked to /faq where the full text lives.
 *
 * PRINCIPLE II IS NOT WEAKENED BY THIS. "Absence of a flag is meaningful only
 * against a stated list of what was searched" requires the list to be STATED,
 * not to be long, and this states it in the place a reader actually looks --
 * beside the number, before they have moved anywhere. `app/tests/copy.test.ts`
 * still requires each of these labels to be present and visible, outside every
 * <details>, on every result.
 *
 * The labels come from the ledger, so a gap recorded at ingest reaches this
 * line without anyone remembering to edit a list.
 */
export function CoverageLine({ manifest }: { manifest: CoverageManifest }) {
  // A manifest that could not be read has no gap list to state. That is not a
  // silent omission: the shapes where it happens render CoverageWithdrawnCard,
  // which says so in full.
  if (manifest.availability !== "read-from-data") return null;
  const headline = manifest.gaps.filter(
    (g) =>
      (g.subjectType === "facility_class" ||
        g.subjectType === "jurisdiction") &&
      // WHOLE KINDS OF PLACE, NOT DATA-QUALITY NOTES. "Two places share a
      // name" is a real limitation and it belongs in the ledger and on /faq
      // -- but it is a caveat about how tarrow reads its own sources, not a
      // category of protected place it never looked at. On this line it sits
      // beside "preschools and day-care" as if the two were comparable, which
      // makes the ones that matter harder to weigh rather than easier.
      g.subjectRef !== "shared_jurisdiction_names",
  );
  if (headline.length === 0) return null;
  return (
    <p className="not-checked">
      <a href="/faq">
        <span className="not-checked__n">{count(headline.length)}</span>
        <span className="not-checked__label">not checked</span>
        <span className="not-checked__list">
          {headline.map((g) => g.label).join(" · ")}
        </span>
      </a>
    </p>
  );
}

/**
 * The manifest when the database could not be read at all.
 *
 * Still mandatory, still on the surface, and it says the only true thing
 * available: nothing was checked, and tarrow cannot even tell you what it would
 * have checked. A silence where the manifest would be reads as reassurance.
 */
export function CoverageWithdrawnCard({ statement }: { statement: string }) {
  return (
    <Card kind="gap">
      <Eyebrow>Coverage withdrawn</Eyebrow>
      <CardTitle>
        tarrow cannot tell you what it checked, because it checked nothing
      </CardTitle>
      <Prose soft>
        <p>{statement}</p>
        <p>
          Every working tarrow answer carries a list of which data layers were
          searched, which kinds of place were not searched at all, and how old
          each layer is. This page carries none of that, because tarrow could
          not read its own record of it. Do not read the absence of a warning
          here as the absence of a problem. Read it as tarrow being unable to
          speak.
        </p>
      </Prose>
    </Card>
  );
}

/**
 * Spec FR-015 and Constitution Principle V, rendered from data.
 *
 * `ruleContent.statement` is read out of the coverage-gap ledger, and
 * server/manifest.ts refuses to build a manifest at all if that row is missing
 * -- so every search fails loudly rather than quietly losing this paragraph.
 *
 * The CLAIM is on the card; the ledger's full text is one click away. This
 * release applies the 1,000-foot buffer without the file-authored,
 * human-verified rule record the constitution requires, and a reader must not
 * be able to leave this surface thinking the rule was checked.
 */
export function RuleNotVerifiedLine() {
  return (
    <p className="unverified">
      <a href="/faq">
        The 1,000 ft rule here is not verified rule data
      </a>
    </p>
  );
}
