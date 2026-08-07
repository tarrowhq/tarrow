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

import {
  Card,
  CardTitle,
  Disclosure,
  Eyebrow,
  Measured,
  Prose,
} from "./cards.tsx";
import { count, day, metresAndFeet, plural } from "./format.ts";
import type {
  CoverageManifest,
  LoadedCoverageManifest,
  ManifestRuleContent,
  PremisesMeasurementBasis,
} from "../server/result.ts";

const PREMISES_BASIS: Record<PremisesMeasurementBasis, string> = {
  board_of_education_parcel:
    "The county tax parcel recorded as exempt board-of-education property. " +
    "A surveyed boundary and the county's own record of who owns it.",
  named_exempt_parcel:
    "A tax-exempt county parcel whose owner of record reads like a school. " +
    "The boundary is surveyed; the reason tarrow treats it as a school is a " +
    "match on the owner's name, which is a rule of thumb rather than a record.",
  point_in_parcel:
    "A published school location was turned into a map point from its mailing " +
    "address, and that point falls inside this county parcel. The boundary " +
    "measured is the parcel's surveyed boundary.",
  point_near_parcel:
    "A published school location was turned into a map point that falls " +
    "inside no parcel at all. tarrow measured to the nearest parcel within " +
    "5 m of it and widened the uncertainty to match.",
  none:
    "No boundary. tarrow holds a name for this premises and no shape for it, " +
    "so it was never measured and was never given a made-up radius.",
};

/**
 * One coverage gap, alone on a screen.
 *
 * The description is the ledger's own text. This component adds a position in
 * the sequence and nothing else -- it does not summarise, soften, or rank.
 */
function GapCard({
  description,
  index,
  total,
}: {
  description: string;
  index: number;
  total: number;
}) {
  return (
    <Card kind="gap">
      <Eyebrow>
        Not checked · {index} of {count(total)}
      </Eyebrow>
      <CardTitle>{description}</CardTitle>
    </Card>
  );
}

/**
 * The gaps that make an unflagged answer honest: whole classes of facility and
 * whole jurisdictions tarrow did not look at.
 *
 * These are the entries `app/tests/copy.test.ts` requires to be VISIBLE --
 * rendered outside every <details> -- rather than merely present. Each gets a
 * card of its own.
 */
export function CoverageGapCards({
  manifest,
}: {
  manifest: LoadedCoverageManifest;
}) {
  const headline = manifest.gaps.filter(
    (g) => g.subjectType === "facility_class" || g.subjectType === "jurisdiction",
  );
  return (
    <>
      {headline.map((gap, i) => (
        <GapCard
          key={gap.id}
          description={gap.description}
          index={i + 1}
          total={headline.length}
        />
      ))}
    </>
  );
}

/**
 * What tarrow DID check, and how old it is.
 *
 * The claim is on the card; the evidence -- the full ledger, the layer
 * registry, the boundary bases -- folds into disclosures. That is the collapse
 * rule: this card answers "how does tarrow know", which is the half that may
 * fold.
 */
export function CoverageDetailCard({
  manifest,
}: {
  manifest: LoadedCoverageManifest;
}) {
  const headline = manifest.gaps.filter(
    (g) => g.subjectType === "facility_class" || g.subjectType === "jurisdiction",
  );
  const queried = manifest.layers.filter((l) => l.queried);
  const newest = day(manifest.dataFetchedAt);
  const oldest = day(manifest.oldestLayerFetchedAt);

  return (
    <Card kind="detail">
      <Eyebrow>If you want the receipts</Eyebrow>
      <CardTitle>What tarrow did check</CardTitle>
      <Prose soft>
        <p>
          School premises in Summit County, Ohio.{" "}
          <Measured>{count(manifest.premises.measurable)}</Measured> of the{" "}
          <Measured>{count(manifest.premises.total)}</Measured> premises tarrow
          holds have a real parcel boundary and were measured against, using a
          buffer of <Measured>{metresAndFeet(manifest.bufferMeters)}</Measured>{" "}
          from the nearest point of one parcel to the nearest point of the
          other.{" "}
          {manifest.premises.notMeasurable > 0 ? (
            <>
              <Measured>{count(manifest.premises.notMeasurable)}</Measured>{" "}
              {plural(manifest.premises.notMeasurable, "has", "have")} no
              boundary and{" "}
              {plural(
                manifest.premises.notMeasurable,
                "was not measured at all",
                "were not measured at all",
              )}
              ; tarrow does not invent a circle around a school it cannot draw.
            </>
          ) : (
            <>
              Every premises tarrow holds has a real boundary; none was
              approximated by a circle.
            </>
          )}
        </p>
        <p>
          <strong>How old this is.</strong> This copy of tarrow last fetched
          data on {newest ?? "a date it cannot report"}, and its oldest layer
          was fetched on {oldest ?? "a date it cannot report"}. No layer has
          been checked by a person: every one reads{" "}
          <span className="never">never human-verified</span> in the table
          below. If you are looking at somebody else&rsquo;s copy of tarrow,
          those dates are how you tell whether it has been left to go stale.
        </p>
      </Prose>

      <Disclosure
        summary={
          <>
            Every limitation tarrow knows about ({count(manifest.gaps.length)}),
            including the {count(headline.length)} on their own screens
          </>
        }
      >
        <div className="scroller">
          <table className="grid-table">
            <thead>
              <tr>
                <th scope="col">What kind of limit</th>
                <th scope="col">What it is</th>
              </tr>
            </thead>
            <tbody>
              {manifest.gaps.map((gap) => (
                <tr key={gap.id}>
                  <td>
                    {gap.subjectType}
                    {gap.subjectRef === null ? null : (
                      <>
                        <br />
                        <small>{gap.subjectRef}</small>
                      </>
                    )}
                  </td>
                  <td>{gap.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Disclosure>

      <Disclosure
        summary={
          <>
            The data layers this answer was built from ({count(queried.length)}{" "}
            queried of {count(manifest.layers.length)} registered), and when
            each was last touched
          </>
        }
      >
        <div className="scroller">
          {/* `data-table="layers"` is read by app/tests/copy.test.ts, which
              checks that EVERY row of THIS table renders its verification date
              as never-human-verified. A scan over the whole document would
              count the sentence above as if it were a row, and would pass a
              table that had quietly lost one (Principle V). */}
          <table className="grid-table" data-table="layers">
            <thead>
              <tr>
                <th scope="col">Layer</th>
                <th scope="col">Rows</th>
                <th scope="col">Queried for this answer</th>
                <th scope="col">Data last fetched</th>
                <th scope="col">Last checked by a person</th>
              </tr>
            </thead>
            <tbody>
              {manifest.layers.map((layer) => (
                <tr key={layer.id}>
                  <td>
                    <strong>{layer.id}</strong>
                    <br />
                    {layer.description}
                    {layer.notes === null ? null : (
                      <>
                        <br />
                        <small>{layer.notes}</small>
                      </>
                    )}
                    <br />
                    <small>{layer.sourceUrl}</small>
                  </td>
                  <td>
                    {layer.rowCount === null
                      ? "not recorded"
                      : count(layer.rowCount)}
                  </td>
                  <td>
                    {layer.queried ? "yes" : "no, this layer contributed nothing"}
                  </td>
                  <td>{day(layer.fetchedAt) ?? "never loaded"}</td>
                  <td>
                    {layer.verifiedAt === null ? (
                      <span className="never">never human-verified</span>
                    ) : (
                      day(layer.verifiedAt)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Disclosure>

      <Disclosure summary="How each school premises boundary was established, and how much slack tarrow gave for it">
        <div className="scroller">
          <table className="grid-table">
            <thead>
              <tr>
                <th scope="col">How the boundary was established</th>
                <th scope="col">Backed up by</th>
                <th scope="col">Premises</th>
                <th scope="col">Slack given in the school&rsquo;s favour</th>
              </tr>
            </thead>
            <tbody>
              {manifest.measurementBases.map((basis) => (
                <tr key={`${basis.matchBasis}:${basis.matchCorroboration ?? "-"}`}>
                  <td>
                    <strong>{basis.matchBasis}</strong>
                    <br />
                    {PREMISES_BASIS[
                      basis.matchBasis as PremisesMeasurementBasis
                    ] ?? basis.matchBasis}
                  </td>
                  <td>
                    {basis.matchCorroboration === "uncorroborated"
                      ? "nothing: the parcel is not tax-exempt, which a school premises almost always is"
                      : (basis.matchCorroboration ?? "not recorded")}
                  </td>
                  <td>{count(basis.premises)}</td>
                  <td>
                    {basis.uncertaintyMeters === null
                      ? "not measurable, and never compared against the buffer"
                      : metresAndFeet(basis.uncertaintyMeters)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Prose soft>
          <p>
            Slack is subtracted from every measured distance before it is
            compared against the buffer, never added. That makes a flag more
            likely, not less. It is the direction Principle I requires: a school
            tarrow flags that turns out not to count costs you a house you could
            have had; a school tarrow misses could cost you your liberty.
          </p>
        </Prose>
      </Disclosure>
    </Card>
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
export function RuleNotVerifiedCard({ rule }: { rule: ManifestRuleContent }) {
  return (
    <Card kind="gap">
      <Eyebrow>Not checked · the rule itself</Eyebrow>
      <CardTitle>No person has checked the rule tarrow applied</CardTitle>
      <Prose soft>
        <p>
          tarrow read the statute and applied a number. Nobody has signed their
          name to that reading inside tarrow, no citation or verification date
          is attached to it as data, and no court has been asked whether the way
          tarrow measures is the way the state measures.
        </p>
      </Prose>
      <Disclosure summary="tarrow&rsquo;s own record of that gap, in full">
        <blockquote className="prose prose--soft">
          <p>{rule.statement}</p>
        </blockquote>
      </Disclosure>
    </Card>
  );
}

/** Every card the coverage manifest contributes, in order. */
export function CoverageCards({ manifest }: { manifest: CoverageManifest }) {
  if (manifest.availability !== "read-from-data") {
    return <CoverageWithdrawnCard statement={manifest.statement} />;
  }
  return (
    <>
      <CoverageGapCards manifest={manifest} />
      <CoverageDetailCard manifest={manifest} />
    </>
  );
}
