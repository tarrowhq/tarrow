// THE WORDS.
//
// This file is the deliverable of Phase 5, rewritten for length by TASK-0017.
// The board card for TASK-0002 said it plainly: "The hardest part is not the
// map, it is the language."
//
// Who is reading this. Somebody on a sex offender registry, looking for
// somewhere to live, sometimes against a thirty-day order to move. They are
// not a lawyer. They may be reading on a phone, on a library computer, at the
// end of a long day, frightened. Copy written to cover somap rather than to be
// understood by that person has failed, however defensible it would look in a
// disclaimer.
//
// FIVE RULES THIS FILE IS WRITTEN UNDER
//
//   1. NEVER STATE OR IMPLY PERMISSION. Constitution Principle I: somap never
//      says approved, legal, permitted, or clear. The strongest sentence
//      available is "outside every buffer we checked", and it is only honest
//      when the reader can see, on the same page, what was not checked.
//      app/tests/copy.test.ts scans the raw response body of every result
//      shape for that vocabulary and fails on it.
//
//   2. AN ABSENCE OF FLAGS IS NOT GOOD NEWS. "No results found" reads as good
//      news, so that phrasing does not appear here. The unflagged answer is
//      headed with what it actually is, and the sentence immediately under
//      the headline says the finding is smaller than it sounds -- before the
//      reader has scrolled anywhere.
//
//   3. A REFUSAL AND A RESULT MUST BE UNMISTAKABLE APART. Spec User Story 3
//      requires "more than a sentence's wording". So they differ in the label
//      above the headline, the headline, the border (dashed for every shape
//      that is not an answer), and -- structurally -- in which sections exist
//      at all: no refusal renders a residence, a distance, or a premises list,
//      because there is none.
//
//   4. THE SHERIFF STEP IS THE RECOMMENDED ACTION, NOT A DISCLAIMER. It is
//      written as the next thing to do and as what to take with you, on every
//      shape including the ones where somap failed.
//
//   5. LENGTH IS A SAFETY PROPERTY, NOT A STYLE PREFERENCE (TASK-0017). This
//      page used to run the answer, then six full-length sections of
//      qualification, every one of them true. A reader under a deadline read
//      the first screen. Disclosure that is scrolled past has not been
//      delivered, so Principle II was being satisfied on the wire and failed
//      in the head -- which is the only place it matters.
//
//      The rule that came out of that, and that a future editor should apply
//      rather than reverse: WHAT SOMAP DID NOT CHECK STAYS VISIBLE; HOW SOMAP
//      KNOWS WHAT IT CHECKED COLLAPSES. The gap list, the staleness statement,
//      and the flagged premises with their distances are on the page, unfolded,
//      always. The provenance tables, the per-premises arithmetic, and the
//      parcel resolution are one click away in a <details> -- present in the
//      served HTML, never absent from it (spec FR-015). General explanation
//      that belongs to no particular answer moved to /faq.
//
//      A LINK IS NOT A STATEMENT. Moving the coverage manifest itself to /faq
//      would be a Principle II violation dressed as an information-architecture
//      improvement, and it is the specific mistake this comment exists to stop.
//
// AND ONE RULE ABOUT MECHANISM: nothing in this file computes anything.
// Phase 3's handoff: "A renderer that derives 'no flags means fine' is the
// failure the type gate exists to prevent; it cannot construct a clearance,
// but it can still write one as a sentence." Every number here comes from the
// result; every limitation comes from the coverage-gap ledger; the only
// arithmetic is a unit conversion in app/format.ts.
//
// AND ONE ABOUT DELIVERY: there is no client-side JavaScript (app/root.tsx).
// Progressive disclosure is <details>/<summary>, which opens natively. The
// manifest, the outside-every-buffer phrasing, and the sheriff guidance are
// all in the server-rendered document on every shape (spec FR-015) -- collapsed
// is allowed, absent is not.

import type { ReactNode } from "react";

import { count, day, metres, metresAndFeet, plural } from "./format.ts";
import type {
  AmbiguityDeclaration,
  CoverageManifest,
  FlaggedPremises,
  LoadedCoverageManifest,
  ManifestRuleContent,
  PremisesMeasurementBasis,
  ResidenceMeasurementBasis,
  ResolvedResidence,
  SearchResult,
} from "../server/result.ts";

// ---------------------------------------------------------------------------
// Vocabulary for things the database records as codes
// ---------------------------------------------------------------------------

const PREMISES_BASIS: Record<PremisesMeasurementBasis, string> = {
  board_of_education_parcel:
    "The county tax parcel recorded as exempt board-of-education property. " +
    "A surveyed boundary and the county's own record of who owns it.",
  named_exempt_parcel:
    "A tax-exempt county parcel whose owner of record reads like a school. " +
    "The boundary is surveyed; the reason somap treats it as a school is a " +
    "match on the owner's name, which is a rule of thumb rather than a record.",
  point_in_parcel:
    "A published school location was turned into a map point from its mailing " +
    "address, and that point falls inside this county parcel. The boundary " +
    "measured is the parcel's surveyed boundary.",
  point_near_parcel:
    "A published school location was turned into a map point that falls " +
    "inside no parcel at all. somap measured to the nearest parcel within " +
    "5 m of it and widened the uncertainty to match.",
  none:
    "No boundary. somap holds a name for this premises and no shape for it, " +
    "so it was never measured and was never given a made-up radius.",
};

const RESIDENCE_BASIS: Record<ResidenceMeasurementBasis, string> = {
  point_in_parcel:
    "The county's address point for this address falls inside this parcel.",
  point_near_parcel:
    "The county's address point for this address falls inside no parcel. This " +
    "is the parcel within 5 m of it, and somap widened the uncertainty to match.",
};

const SCHOOL_TYPE: Record<string, string> = {
  public: "Public school (district, community, or STEM)",
  nonpublic: "Nonpublic school",
  unclassified:
    "Not classified: the tax roll does not say whether the owner runs a " +
    "nonpublic school or a community school, and somap will not guess",
};

function schoolType(value: string): string {
  return SCHOOL_TYPE[value] ?? value;
}

// ---------------------------------------------------------------------------
// The furniture every result carries
// ---------------------------------------------------------------------------

/**
 * Spec FR-013 and AC #7: guidance to confirm with the registering sheriff's
 * office on EVERY result, including declines and errors.
 *
 * Written as the next step, not as a disclaimer. The constitution's promise is
 * "three days of guessing into an hour of searching plus one confirming phone
 * call" -- this is that phone call, and the section tells the reader what to
 * carry into it so it is a specific question about a specific parcel.
 *
 * TASK-0017 cut it from four paragraphs to one plus a rule. What went was the
 * restatement that somap is not a court or a lawyer, which /faq now carries in
 * full and which the last line here still delivers as something to act on.
 */
export function SheriffNextStep() {
  return (
    <section className="section">
      <h2 className="section__title">
        Your next step: the sheriff&rsquo;s office where you register
      </h2>
      <div className="prose">
        <p>
          That office enforces the distance rule and knows the local rules somap
          has not loaded. Ask it about this exact address, and take three things
          so that it is one specific question: the address as you typed it here;
          the name of every school premises listed above, if any, with the
          distance somap measured to each; and the fact that somap checked
          school premises only, and no city or village rule at all.
        </p>
        <p>
          <strong>
            If that office and somap disagree, that office is right and somap is
            wrong.
          </strong>{" "}
          <a href="/faq">What somap is, and what it is not</a>.
        </p>
      </div>
    </section>
  );
}

/**
 * Spec FR-015 and Constitution Principle V, rendered from data.
 *
 * `ruleContent.statement` is read out of the coverage-gap ledger, and
 * server/manifest.ts refuses to build a manifest at all if that row is
 * missing -- so every search fails loudly rather than quietly losing this
 * paragraph.
 *
 * The CLAIM is visible; the ledger's full text is one click away. This release
 * applies the 1,000-foot buffer without the file-authored, human-verified rule
 * record the constitution requires, and a reader must not be able to leave this
 * page thinking the rule was checked -- but the two sentences that say so do
 * that better than the ledger's paragraph did, because they are short enough
 * to be read.
 */
export function RuleNotVerified({ rule }: { rule: ManifestRuleContent }) {
  return (
    <section className="section">
      <h2 className="section__title">
        No person has checked the rule somap applied
      </h2>
      <div className="prose">
        <p>
          somap read the statute and applied a number. Nobody has signed their
          name to that reading inside somap, no citation or verification date is
          attached to it as data, and no court has been asked whether the way
          somap measures is the way the state measures.
        </p>
      </div>
      <details className="disclosure">
        <summary>somap&rsquo;s own record of that gap, in full</summary>
        <blockquote className="prose">
          <p>{rule.statement}</p>
        </blockquote>
      </details>
    </section>
  );
}

/**
 * Constitution Principle II: "Every result states what was checked and what
 * was not... Absence of a flag is meaningful only against a stated list of
 * what was searched."
 *
 * The headline absences are ALWAYS VISIBLE -- never behind a <details> -- and
 * they are read out of the coverage-gap ledger rather than written down here,
 * so a limitation somebody records at ingest reaches this page without anyone
 * remembering to edit a list. TASK-0017 moved them to the TOP of this section,
 * ahead of what somap did check: they are the part a reader must not miss, and
 * they were previously the third paragraph.
 *
 * The long enumerations below them are collapsed, and collapsed only:
 * <details> opens with no JavaScript.
 */
export function WhatWasNotChecked({
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
    <section className="section">
      <h2 className="section__title">What somap did not check</h2>
      <div className="prose">
        <ul>
          {headline.map((gap) => (
            <li key={gap.id}>{gap.description}</li>
          ))}
        </ul>
        <p>
          <strong>What it did check:</strong> school premises in Summit County,
          Ohio. {count(manifest.premises.measurable)} of the{" "}
          {count(manifest.premises.total)} premises somap holds have a real
          parcel boundary and were measured against, using a buffer of{" "}
          {metresAndFeet(manifest.bufferMeters)} from the nearest point of one
          parcel to the nearest point of the other.{" "}
          {manifest.premises.notMeasurable > 0 ? (
            <>
              {count(manifest.premises.notMeasurable)}{" "}
              {plural(manifest.premises.notMeasurable, "has", "have")} no
              boundary and{" "}
              {plural(
                manifest.premises.notMeasurable,
                "was not measured at all",
                "were not measured at all",
              )}
              ; somap does not invent a circle around a school it cannot draw.
            </>
          ) : (
            <>
              Every premises somap holds has a real boundary; none was
              approximated by a circle.
            </>
          )}
        </p>
        <p>
          <strong>How old this is.</strong> This copy of somap last fetched data
          on {newest ?? "a date it cannot report"}, and its oldest layer was
          fetched on {oldest ?? "a date it cannot report"}. No layer has been
          checked by a person: every one reads{" "}
          <span className="never">never human-verified</span> in the table
          below. If you are looking at somebody else&rsquo;s copy of somap,
          those dates are how you tell whether it has been left to go stale.
        </p>
      </div>

      <details className="disclosure">
        <summary>
          Every limitation somap knows about ({count(manifest.gaps.length)}),
          including {count(headline.length)} listed above
        </summary>
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
      </details>

      <details className="disclosure">
        <summary>
          The data layers this answer was built from ({count(queried.length)}{" "}
          queried of {count(manifest.layers.length)} registered), and when each
          was last touched
        </summary>
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
                  <td>{layer.rowCount === null ? "not recorded" : count(layer.rowCount)}</td>
                  <td>{layer.queried ? "yes" : "no, this layer contributed nothing"}</td>
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
      </details>

      <details className="disclosure">
        <summary>
          How each school premises boundary was established, and how much slack
          somap gave for it
        </summary>
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
                    {PREMISES_BASIS[basis.matchBasis as PremisesMeasurementBasis] ??
                      basis.matchBasis}
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
        <p className="prose">
          Slack is subtracted from every measured distance before it is
          compared against the buffer, never added. That makes a flag more
          likely, not less. It is the direction Principle I requires: a school
          somap flags that turns out not to count costs you a house you could
          have had; a school somap misses could cost you your liberty.
        </p>
      </details>
    </section>
  );
}

/**
 * The manifest when the database could not be read at all. Still mandatory,
 * still on the page, and it says the only true thing available: nothing was
 * checked, and somap cannot even tell you what it would have checked.
 */
function CoverageWithdrawn({ statement }: { statement: string }) {
  return (
    <section className="section">
      <h2 className="section__title">
        somap cannot tell you what it checked, because it checked nothing
      </h2>
      <div className="prose">
        <p>{statement}</p>
        <p>
          Every working somap answer carries a list of which data layers were
          searched, which kinds of place were not searched at all, and how old
          each layer is. This page carries none of that, because somap could not
          read its own record of it. Do not read the absence of a warning here
          as the absence of a problem. Read it as somap being unable to speak.
        </p>
      </div>
    </section>
  );
}

export function CoverageManifestView({ manifest }: { manifest: CoverageManifest }) {
  return manifest.availability === "read-from-data" ? (
    <WhatWasNotChecked manifest={manifest} />
  ) : (
    <CoverageWithdrawn statement={manifest.statement} />
  );
}

// ---------------------------------------------------------------------------
// Pieces shared by the two shapes that actually measured something
// ---------------------------------------------------------------------------

/**
 * Which parcel the distances were measured from. Collapsed, because it answers
 * "how does somap know" rather than "what did somap find" -- but the one fact
 * that can invalidate the entire page (this may not be your parcel) rides in
 * the summary, where it is read without opening anything.
 */
function Residence({ residence }: { residence: ResolvedResidence }) {
  return (
    <details className="disclosure">
      <summary>
        The parcel somap measured from: #{residence.parcelId}
        {residence.siteAddress === null ? null : <>, {residence.siteAddress}</>}.
        If that is not yours, nothing on this page applies to you.
      </summary>
      <dl className="facts">
        <dt>The county&rsquo;s label for this address</dt>
        <dd>{residence.addressLabel ?? "not published by the county"}</dd>
        <dt>The parcel&rsquo;s own situs address</dt>
        <dd>{residence.siteAddress ?? "none recorded on the parcel"}</dd>
        <dt>Jurisdiction</dt>
        <dd>{residence.municipality ?? "not recorded"}</dd>
        <dt>County parcel</dt>
        <dd>#{residence.parcelId}</dd>
        <dt>How the parcel was attached to the address</dt>
        <dd>{RESIDENCE_BASIS[residence.measurementBasis]}</dd>
        <dt>Slack given on this side</dt>
        <dd>{metresAndFeet(residence.uncertaintyMeters)}</dd>
      </dl>
      <p className="prose">
        somap resolved what you typed against the county&rsquo;s list of
        addresses and then found the parcel that address point sits on. If the
        parcel above is not yours, check the address and search again.
      </p>
    </details>
  );
}

/**
 * DECISION §4: one typed address can mean several parcels -- up to 505 for a
 * condominium. somap never silently picks one. The ambiguity is declared and
 * the answer shown is the most restrictive candidate.
 *
 * The declaration stays visible; the candidate table collapses. Which parcel
 * is actually yours changes the answer, so it is not a provenance detail.
 */
function Ambiguity({ ambiguity }: { ambiguity: AmbiguityDeclaration }) {
  return (
    <section className="section">
      <div className="callout prose">
        <p>
          <strong>
            This address means {count(ambiguity.candidateCount)} different
            parcels.
          </strong>{" "}
          Apartment buildings, condominiums, and the same street address
          existing in two places all do this. somap does not pick one quietly:
          the answer above is the <strong>most restrictive</strong> of them,
          the one with the most school premises inside the buffer, and among
          ties, the one closest to a school. Ask the sheriff&rsquo;s office
          about your specific unit, and tell them the county records several
          parcels under this address.
        </p>
      </div>
      <details className="disclosure">
        <summary>
          All {count(ambiguity.candidateCount)} parcels somap considered
        </summary>
        <div className="scroller">
          <table className="grid-table">
            <thead>
              <tr>
                <th scope="col">County parcel</th>
                <th scope="col">Situs address</th>
                <th scope="col">Jurisdiction</th>
                <th scope="col">School premises inside the buffer</th>
                <th scope="col">Closest, after slack</th>
              </tr>
            </thead>
            <tbody>
              {ambiguity.candidates.map((candidate) => (
                <tr key={candidate.parcelId}>
                  <td>#{candidate.parcelId}</td>
                  <td>{candidate.siteAddress ?? "none recorded"}</td>
                  <td>{candidate.municipality ?? "not recorded"}</td>
                  <td>{count(candidate.flaggedPremisesCount)}</td>
                  <td>
                    {candidate.nearestPessimisticDistanceMeters === null
                      ? "nothing somap checked was inside the buffer"
                      : metresAndFeet(candidate.nearestPessimisticDistanceMeters)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

/**
 * One flagged premises: the name, where it is, and how far. That is what the
 * reader came for and what they will read down the phone.
 *
 * The arithmetic behind the number -- measured distance, slack subtracted, how
 * the boundary was established, which layer it came from -- is in the
 * <details>, present in the document. The one exception is a premises whose
 * boundary may not be the school's at all: that changes how far the number can
 * be trusted, so it stays visible.
 */
function Premises({ premises }: { premises: FlaggedPremises }) {
  const uncorroborated = premises.corroboration === "uncorroborated";
  const slack =
    premises.residenceUncertaintyMeters + premises.premisesUncertaintyMeters;
  const where = [premises.street, premises.city].filter(Boolean).join(", ");

  return (
    <article className="premises">
      <h3 className="premises__name">{premises.name}</h3>
      <p className="premises__distance">
        <strong>{metresAndFeet(premises.pessimisticDistanceMeters)}</strong> from
        this address, against a buffer of {metresAndFeet(premises.bufferMeters)}
      </p>
      <p className="premises__where">
        {where === "" ? "Address not published" : where} ·{" "}
        {schoolType(premises.schoolType)}
      </p>

      {uncorroborated ? (
        <div className="callout prose">
          <p>
            <strong>This boundary may not be the school&rsquo;s.</strong> This
            premises was located by turning a mailing address into a map point,
            and the point landed on a parcel the county does <em>not</em> record
            as tax-exempt, which a school premises almost always is. The
            boundary somap measured to may belong to a neighbour, and the real
            school property may reach further than it. Ask the sheriff&rsquo;s
            office about this one by name.
          </p>
        </div>
      ) : null}

      <details className="disclosure">
        <summary>How somap arrived at that distance</summary>
        <dl className="facts">
          <dt>Kind of school</dt>
          <dd>{schoolType(premises.schoolType)}</dd>
          <dt>Address in the source</dt>
          <dd>{where === "" ? "not published" : where}</dd>
          <dt>Distance somap measured</dt>
          <dd>
            <strong>{metresAndFeet(premises.distanceMeters)}</strong>, from the
            nearest point of your parcel&rsquo;s boundary to the nearest point of
            this premises&rsquo; boundary
          </dd>
          <dt>Slack subtracted</dt>
          <dd>
            {metresAndFeet(slack)}: {metres(premises.residenceUncertaintyMeters)}{" "}
            for your parcel, {metres(premises.premisesUncertaintyMeters)} for
            this premises
          </dd>
          <dt>Distance compared against the buffer</dt>
          <dd>
            <strong>{metresAndFeet(premises.pessimisticDistanceMeters)}</strong>,
            against a buffer of {metresAndFeet(premises.bufferMeters)}
          </dd>
          <dt>How this boundary was established</dt>
          <dd>{PREMISES_BASIS[premises.measurementBasis]}</dd>
          <dt>Where this premises came from</dt>
          <dd>{premises.layerId}</dd>
        </dl>
      </details>
    </article>
  );
}

// ---------------------------------------------------------------------------
// The five shapes
// ---------------------------------------------------------------------------

function Banner({
  tone,
  label,
  headline,
  children,
}: {
  tone: "flagged" | "measured" | "stopped" | "broken";
  label: string;
  headline: string;
  children: ReactNode;
}) {
  return (
    <div className={`answer answer--${tone}`}>
      <p className="answer__label">{label}</p>
      <h1 className="answer__headline">{headline}</h1>
      <div className="prose">{children}</div>
    </div>
  );
}

/** Shape 1: at least one school premises is inside the buffer. */
function WithinBuffer({
  result,
}: {
  result: Extract<SearchResult, { kind: "premises-within-buffer" }>;
}) {
  const n = result.premises.length;
  return (
    <>
      <Banner
        tone="flagged"
        label="Result: inside a buffer somap checked"
        headline={`${count(n)} school ${plural(
          n,
          "premises is",
          "premises are",
        )} within ${metresAndFeet(result.bufferMeters)} of this address.`}
      >
        <p>
          Here {plural(n, "it is", "they are")}. Ohio&rsquo;s rule is written
          about the <em>premises</em> (the parcel of land) rather than the
          building, so a school that owns several parcels appears more than
          once. Repeated names are not a mistake.
        </p>
      </Banner>

      <section className="section">
        <h2 className="section__title">
          What somap found inside the buffer ({count(n)})
        </h2>
        {result.premises.map((p) => (
          <Premises key={p.premisesId} premises={p} />
        ))}
        <Residence residence={result.residence} />
      </section>

      {result.ambiguity === null ? null : (
        <Ambiguity ambiguity={result.ambiguity} />
      )}
    </>
  );
}

/**
 * Shape 2: the strongest statement somap is permitted to make.
 *
 * The single most dangerous page in this application. "No results found" reads
 * as good news to a frightened person, so the headline is not that, and the
 * qualification is above the fold rather than at the bottom under a heading
 * nobody reads.
 */
function OutsideEveryBuffer({
  result,
}: {
  result: Extract<SearchResult, { kind: "outside-every-buffer-we-checked" }>;
}) {
  return (
    <>
      <Banner
        tone="measured"
        label="Result: outside every buffer we checked"
        headline="Outside every buffer we checked."
      >
        <p>
          <strong>That is smaller than it sounds.</strong> No school premises{" "}
          <em>that somap holds a boundary for</em> is within{" "}
          {metresAndFeet(result.bufferMeters)} of the parcel at this address.
          That is the whole of the finding: a measurement, not a decision. What
          somap did not look at is listed below. Read it before you rely on
          anything here, and then make the phone call.
        </p>
      </Banner>

      <section className="section">
        <Residence residence={result.residence} />
      </section>

      {result.ambiguity === null ? null : (
        <Ambiguity ambiguity={result.ambiguity} />
      )}
    </>
  );
}

/**
 * Shape 3: somap found the address and refused to measure it.
 *
 * Structurally distinct from shape 4 on purpose: this page has a "why somap
 * stopped" section, no residence, no distance, and a dashed banner. Spec User
 * Story 3 scenario 4 requires the difference to be more than wording.
 */
function Declined({
  result,
}: {
  result: Extract<SearchResult, { kind: "declined" }>;
}) {
  return (
    <>
      <Banner
        tone="stopped"
        label="No result: somap stopped instead of measuring"
        headline="somap will not give an answer for this address."
      >
        <p>
          It measured no distances at all, so nothing here is a finding about
          this address. It is not &ldquo;nothing nearby&rdquo;, and it is not
          &ldquo;address not found&rdquo;.
        </p>
      </Banner>

      <section className="section">
        <h2 className="section__title">Why somap stopped</h2>
        <div className="prose">
          <p>{result.detail}</p>
          <p>
            somap could have produced a number here. It refused because the
            number would have been wrong in the dangerous direction: it would
            tend to come out <em>too large</em>, and a distance that is too
            large is exactly how an address gets treated as being outside a
            buffer when it is not. Being annoying is recoverable; being wrong
            that way is not.
          </p>
          <p>
            somap knows where this is; it stopped after that, on purpose. That
            is not a reason to give up on the address. The sheriff&rsquo;s
            office can answer for one somap will not measure.
          </p>
          <p>
            <small>
              somap records the reason for this as{" "}
              <code>{result.reason}</code>.
            </small>
          </p>
        </div>
      </section>
    </>
  );
}

/**
 * Shape 4: somap could not resolve the address at all.
 *
 * Never a ZIP centroid, never a street centroid, never a fuzzy match, never a
 * nearby-parcel consolation -- there is no code path that could produce one
 * (spec FR-007). This page says so, because a reader who does not know that
 * will assume somap tried its best and found nothing near.
 */
function CouldNotLocate({
  result,
}: {
  result: Extract<SearchResult, { kind: "could-not-locate" }>;
}) {
  return (
    <>
      <Banner
        tone="stopped"
        label="No result: somap could not find this address"
        headline="somap could not find this address, so it checked nothing."
      >
        <p>
          This is not an answer. somap does not know where this address is, so
          it measured no distances and found nothing, neither near nor far.
        </p>
      </Banner>

      <section className="section">
        <h2 className="section__title">Why this happens, and what to try</h2>
        <div className="prose">
          <p>{result.detail}</p>
          <ul>
            <li>
              <strong>The address is not in Summit County, Ohio.</strong> somap
              holds no data for anywhere else, and it cannot tell an
              out-of-county address apart from a misspelled one, so both land
              on this page.
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
              somap says so rather than filling the hole in.
            </li>
          </ul>
          <p>
            somap will not guess: it does not correct spelling, it does not fall
            back to the middle of the street or the centre of the ZIP code, and
            it does not offer the nearest parcel it happened to find instead. A
            confident answer about the wrong building is more dangerous to you
            than no answer at all.
          </p>
          <p>
            <small>
              somap records the reason for this as{" "}
              <code>{result.reason}</code>.
            </small>
          </p>
        </div>
      </section>
    </>
  );
}

/** Shape 5: somap broke. */
function SearchFailed({
  result,
}: {
  result: Extract<SearchResult, { kind: "search-failed" }>;
}) {
  return (
    <>
      <Banner
        tone="broken"
        label="No result: somap failed"
        headline="somap broke before it could check anything."
      >
        <p>
          This is a fault in this copy of somap, not a finding about your
          address. Nothing was measured and nothing was found. A broken page is
          not a quiet address.
        </p>
      </Banner>

      <section className="section">
        <h2 className="section__title">What went wrong</h2>
        <div className="prose">
          <p>{result.detail}</p>
          <p>
            Try again in a few minutes. If it keeps happening, this instance of
            somap is broken and whoever runs it needs to look at it; until then
            it can tell you nothing.
          </p>
          <p>
            somap deliberately keeps no error report that could carry what you
            typed, so there is no record of this failure holding your address
            anywhere: not in a log, not in a crash report, not on the screen.
            That is the trade it makes: a fault here is harder for its
            maintainers to diagnose, and your address is not written down.
          </p>
          <p>
            <small>
              somap records the reason for this as{" "}
              <code>{result.reason}</code>.
            </small>
          </p>
        </div>
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

export function Masthead() {
  return (
    <header className="masthead">
      <p className="masthead__name">
        <a href="/">somap</a>
      </p>
      <p className="masthead__where">
        School-premises distances for Summit County, Ohio. A helper, not an
        authority.
      </p>
    </header>
  );
}

export function PrivacyFootnote() {
  return (
    <footer className="footnote">
      <p>
        somap did not write down the address you typed: not in a log, not in
        this page&rsquo;s web address, not in a database, and not on its way
        anywhere else. This page is also marked never to be stored by your
        browser, which matters on a shared or library computer. You are not
        asked to take that on trust:{" "}
        <a href="/faq">the procedure for checking it yourself</a>.
      </p>
      <p>
        <a href="/">Check another address</a>
      </p>
    </footer>
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

/**
 * Every result page, whatever its shape, carries: the answer, the coverage
 * manifest, the unverified-rule disclosure, and the sheriff step. In that
 * order, all server-rendered, none of it behind JavaScript (spec FR-015).
 */
export function ResultPage({ result }: { result: SearchResult }) {
  return (
    <main className="page">
      <Masthead />
      <Shape result={result} />
      <CoverageManifestView manifest={result.manifest} />
      <RuleNotVerified rule={result.manifest.ruleContent} />
      <SheriffNextStep />
      <PrivacyFootnote />
    </main>
  );
}
