// THE WORDS.
//
// This file is the deliverable of Phase 5. The board card for TASK-0002 says
// it plainly: "The hardest part is not the map, it is the language."
//
// Who is reading this. Somebody on a sex offender registry, looking for
// somewhere to live, sometimes against a thirty-day order to move. They are
// not a lawyer. They may be reading on a phone, on a library computer, at the
// end of a long day, frightened. Copy written to cover somap rather than to be
// understood by that person has failed, however defensible it would look in a
// disclaimer.
//
// FOUR RULES THIS FILE IS WRITTEN UNDER
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
    "Not classified — the tax roll does not say whether the owner runs a " +
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
 */
export function SheriffNextStep() {
  return (
    <section className="section">
      <h2 className="section__title">
        Your next step: the sheriff&rsquo;s office you register with
      </h2>
      <div className="prose">
        <p>
          Whatever is above, this is the step that settles it. Call or visit the
          sheriff&rsquo;s office where you register and ask about this exact
          address. That office enforces the distance rule, and it knows the
          local rules somap has not loaded.
        </p>
        <p>Take these with you, so it is one specific question:</p>
        <ul>
          <li>the address, written the way you typed it here;</li>
          <li>
            the name of every school premises listed on this page, if any, and
            the distance somap measured to each;
          </li>
          <li>
            the fact that somap checked school premises only, and checked no
            city or village rules at all.
          </li>
        </ul>
        <p>
          <strong>
            If that office and somap disagree, that office is right and somap is
            wrong.
          </strong>{" "}
          somap is a helper. It is not a court, a sheriff&rsquo;s office, or a
          lawyer, and nothing on this page is advice about the law. It exists to
          make that call shorter, not to replace it.
        </p>
        <p>
          somap wants to know when it is wrong. There is no way to report a
          mistake yet, on purpose: a report has to be built so that it carries
          nothing about what you searched, and that has not been built.
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
 * paragraph. It is long, and it is not a footnote: this release applies the
 * 1,000-foot buffer without the file-authored, human-verified rule record the
 * constitution requires, and the interface must not let a reader think the
 * rule was checked.
 */
export function RuleNotVerified({ rule }: { rule: ManifestRuleContent }) {
  return (
    <section className="section">
      <h2 className="section__title">
        No person has checked the rule somap applied
      </h2>
      <div className="prose">
        <p>
          somap holds itself to showing you where every answer came from. On the
          distance rule itself, it cannot yet, and it says so on every page
          rather than only where it is inconvenient:
        </p>
        <blockquote className="callout">
          <p>{rule.statement}</p>
        </blockquote>
        <p>
          In plain terms: somap read the statute and applied a number. Nobody
          signed their name to that reading inside somap, no citation or
          verification date is attached to it as data, and no court has been
          asked whether the way somap measures is the way the state measures.
          Until that exists, treat every distance here as a reason to make the
          call above.
        </p>
      </div>
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
 * remembering to edit a list. The long enumerations below them are collapsed,
 * and collapsed only: <details> opens with no JavaScript.
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
      <h2 className="section__title">
        What somap checked, what it did not, and how old the data is
      </h2>
      <div className="prose">
        <p>
          <strong>Checked:</strong> school premises in Summit County, Ohio —{" "}
          {count(manifest.premises.measurable)} of{" "}
          {count(manifest.premises.total)} premises somap holds have a real
          parcel boundary and were measured against.{" "}
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
              . somap does not invent a circle around a school it cannot draw.
            </>
          ) : (
            <>
              Every premises somap holds has a real boundary; none was
              approximated by a circle.
            </>
          )}{" "}
          The buffer applied was{" "}
          {metresAndFeet(manifest.bufferMeters)}, measured from the nearest
          point of your parcel to the nearest point of the school&rsquo;s
          parcel.
        </p>
        <p>
          <strong>Not checked at all:</strong>
        </p>
        <ul>
          {headline.map((gap) => (
            <li key={gap.id}>{gap.description}</li>
          ))}
        </ul>
        <p>
          <strong>How old this is.</strong> This somap instance last fetched
          data on {newest ?? "a date it cannot report"}, and its oldest layer
          was fetched on {oldest ?? "a date it cannot report"}. Nothing here has
          been verified by a person — see the table below, where the
          &ldquo;last checked by a person&rdquo; column reads{" "}
          <span className="never">never human-verified</span> for every single
          layer. If you are looking at somebody else&rsquo;s copy of somap,
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
          <table className="grid-table">
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
                  <td>{layer.queried ? "yes" : "no — this layer contributed nothing"}</td>
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
                      ? "nothing — the parcel is not tax-exempt, which a school premises almost always is"
                      : (basis.matchCorroboration ?? "not recorded")}
                  </td>
                  <td>{count(basis.premises)}</td>
                  <td>
                    {basis.uncertaintyMeters === null
                      ? "not measurable — never compared against the buffer"
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
          as the absence of a problem — read it as somap being unable to speak.
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

function Residence({ residence }: { residence: ResolvedResidence }) {
  return (
    <section className="section">
      <h2 className="section__title">The parcel somap measured from</h2>
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
      <div className="callout prose">
        <p>
          somap resolved what you typed against the county&rsquo;s list of
          addresses and then found the parcel that address point sits on. If the
          parcel above is not yours, nothing else on this page applies to you —
          check the address and search again.
        </p>
      </div>
    </section>
  );
}

/**
 * DECISION §4: one typed address can mean several parcels -- up to 505 for a
 * condominium. somap never silently picks one. The ambiguity is declared and
 * the answer shown is the most restrictive candidate.
 */
function Ambiguity({ ambiguity }: { ambiguity: AmbiguityDeclaration }) {
  return (
    <section className="section">
      <h2 className="section__title">
        This address means {count(ambiguity.candidateCount)} different parcels
      </h2>
      <div className="prose">
        <p>
          What you typed matches {count(ambiguity.candidateCount)} separate
          parcels in the county&rsquo;s records — this happens with apartment
          buildings and condominiums, and where the same street address exists
          in two places. somap does not pick one quietly and hope. The answer
          above is the <strong>most restrictive</strong> of them: the one with
          the most school premises inside the buffer, and among ties, the one
          closest to a school.
        </p>
        <p>
          <strong>Which parcel is actually yours matters.</strong> Ask the
          sheriff&rsquo;s office about the specific unit, and tell them the
          county records several parcels under this address.
        </p>
      </div>
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
    </section>
  );
}

function Premises({ premises }: { premises: FlaggedPremises }) {
  const uncorroborated = premises.corroboration === "uncorroborated";
  const slack =
    premises.residenceUncertaintyMeters + premises.premisesUncertaintyMeters;

  return (
    <article className="premises">
      <h3 className="premises__name">{premises.name}</h3>
      <dl className="facts">
        <dt>Kind of school</dt>
        <dd>{schoolType(premises.schoolType)}</dd>
        <dt>Address in the source</dt>
        <dd>
          {[premises.street, premises.city].filter(Boolean).join(", ") ||
            "not published"}
        </dd>
        <dt>Distance somap measured</dt>
        <dd>
          <strong>{metresAndFeet(premises.distanceMeters)}</strong>, from the
          nearest point of your parcel&rsquo;s boundary to the nearest point of
          this premises&rsquo; boundary
        </dd>
        <dt>Slack subtracted</dt>
        <dd>
          {metresAndFeet(slack)} — {metres(premises.residenceUncertaintyMeters)}{" "}
          for your parcel, {metres(premises.premisesUncertaintyMeters)} for this
          premises
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
      {uncorroborated ? (
        <div className="callout prose">
          <p>
            <strong>This boundary may not be the school&rsquo;s.</strong> This
            premises was located by turning a mailing address into a map point,
            and the point landed on a parcel the county does{" "}
            <em>not</em> record as tax-exempt — which a school premises almost
            always is. The boundary somap measured to may belong to a neighbour,
            and the real school property may reach further than it.
          </p>
          <p>
            That is why somap subtracted{" "}
            {metres(premises.premisesUncertaintyMeters)} on this premises&rsquo;
            side. The exact parcel-to-parcel distance is{" "}
            {metresAndFeet(premises.distanceMeters)}; the figure compared
            against the buffer is {metresAndFeet(premises.pessimisticDistanceMeters)}.
            Ask the sheriff&rsquo;s office about this one by name.
          </p>
        </div>
      ) : null}
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
        label="Result — inside a buffer somap checked"
        headline={`${count(n)} school ${plural(
          n,
          "premises is",
          "premises are",
        )} within ${metresAndFeet(result.bufferMeters)} of this address.`}
      >
        <p>
          somap measured from the boundary of the parcel at this address to the
          boundary of every school premises it holds a shape for. The{" "}
          {plural(n, "one below came", "ones below came")} out inside the buffer
          this release applies.
        </p>
        <p>
          Ohio&rsquo;s rule is written about the <em>premises</em> — the parcel
          of land — not the building, so a school that owns several parcels
          appears several times below. Repeated names are not a mistake.
        </p>
      </Banner>

      <section className="section">
        <h2 className="section__title">
          What somap found inside the buffer ({count(n)})
        </h2>
        {result.premises.map((p) => (
          <Premises key={p.premisesId} premises={p} />
        ))}
      </section>

      <Residence residence={result.residence} />
      {result.ambiguity === null ? null : (
        <Ambiguity ambiguity={result.ambiguity} />
      )}

      <section className="section">
        <h2 className="section__title">What this does and does not tell you</h2>
        <div className="prose">
          <p>
            somap is telling you what it measured. It is not telling you what
            you may do, and it is not a decision by anyone with the power to
            make one.
          </p>
          <ul>
            <li>
              The distances above are somap&rsquo;s own measurement, boundary to
              boundary, using county parcel shapes. The state does not say in
              the statute how the thousand feet is to be measured, and somap
              picked the most restrictive reasonable reading. A sheriff&rsquo;s
              office may measure differently.
            </li>
            <li>
              somap checked school premises only. An address it did not flag
              here may still be barred by something it never looked at — see the
              list further down.
            </li>
            <li>
              somap may be missing schools. It names the ones it knows it is
              missing, further down, and it certainly does not know all of them.
            </li>
          </ul>
        </div>
      </section>
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
        label="Result — outside every buffer we checked"
        headline="Outside every buffer we checked."
      >
        <p>
          <strong>
            That is the strongest thing somap will say, and it is
            smaller than it sounds.
          </strong>
        </p>
        <p>
          somap found no school premises <em>that it holds a boundary for</em>{" "}
          within {metresAndFeet(result.bufferMeters)} of the parcel at this
          address. That is the whole of the finding. somap did not look at
          preschools, day-care centres, children&rsquo;s crisis care or
          residential infant care facilities, and it did not look at a single
          city or village rule — and those are real restrictions that apply to
          real addresses in this county.
        </p>
        <p>
          So this is a measurement, not a decision. The decision is not
          somap&rsquo;s to make, and somap will never imply it made one. Read{" "}
          <strong>what was not checked</strong>, below, before you rely on
          anything on this page, and then make the phone call.
        </p>
      </Banner>

      <Residence residence={result.residence} />
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
        label="No result — somap stopped instead of measuring"
        headline="somap will not give an answer for this address."
      >
        <p>
          somap did not measure a single distance here, and it is not going to.
          Nothing on this page is a finding about this address.
        </p>
      </Banner>

      <section className="section">
        <h2 className="section__title">Why somap stopped</h2>
        <div className="prose">
          <p>{result.detail}</p>
          <p>
            somap could have produced a number here. It refused because the
            number would have been wrong in the dangerous direction — it would
            tend to come out <em>too large</em>, and a distance that is too
            large is exactly how an address gets treated as being outside a
            buffer when it is not.
            Being annoying is recoverable. That is not.
          </p>
          <p>
            <small>
              somap records the reason for this as{" "}
              <code>{result.reason}</code>.
            </small>
          </p>
        </div>
      </section>

      <section className="section">
        <h2 className="section__title">What this is not</h2>
        <div className="prose">
          <ul>
            <li>
              <strong>It is not &ldquo;nothing nearby&rdquo;.</strong> somap
              measured no distances at all, so it found nothing either way.
            </li>
            <li>
              <strong>It is not &ldquo;address not found&rdquo;.</strong> somap
              knows where this is. It stopped after that, on purpose.
            </li>
            <li>
              <strong>It is not a reason to give up on the address.</strong>{" "}
              somap cannot measure it; the sheriff&rsquo;s office can answer for
              it.
            </li>
          </ul>
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
        label="No result — somap could not find this address"
        headline="somap could not find this address, so it checked nothing."
      >
        <p>
          This is not an answer. somap does not know where this address is, so
          it measured no distances and found nothing — neither near nor far.
        </p>
      </Banner>

      <section className="section">
        <h2 className="section__title">What somap did with what you typed</h2>
        <div className="prose">
          <p>{result.detail}</p>
          <p>
            somap will not guess. It does not correct spelling, it does not fall
            back to the middle of the street or the centre of the ZIP code or
            the town, and it does not offer you the nearest parcel it happened
            to find instead. A confident answer about the wrong building is more
            dangerous to you than no answer at all.
          </p>
          <p>
            <small>
              somap records the reason for this as{" "}
              <code>{result.reason}</code>.
            </small>
          </p>
        </div>
      </section>

      <section className="section">
        <h2 className="section__title">Why this happens, and what to try</h2>
        <div className="prose">
          <ul>
            <li>
              <strong>The address is not in Summit County, Ohio.</strong> somap
              holds no data for anywhere else, and it cannot tell an
              out-of-county address apart from a misspelled one — both land on
              this page.
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
            Then, whether or not a second attempt works, make the call below.
            The sheriff&rsquo;s office can answer for an address somap cannot
            even find.
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
        label="No result — somap failed"
        headline="somap broke before it could check anything."
      >
        <p>
          This is a fault in this copy of somap, not a finding about your
          address. Nothing was measured and nothing was found.
        </p>
      </Banner>

      <section className="section">
        <h2 className="section__title">What went wrong</h2>
        <div className="prose">
          <p>{result.detail}</p>
          <p>
            somap deliberately keeps no error report that could carry what you
            typed, so there is no record of this failure holding your address
            anywhere — not in a log, not in a crash report, not on the screen.
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

      <section className="section">
        <h2 className="section__title">What to do</h2>
        <div className="prose">
          <ul>
            <li>
              <strong>Do not read this as an answer of any kind.</strong> A
              broken page is not a quiet address.
            </li>
            <li>Try again in a few minutes.</li>
            <li>
              If it keeps happening, this instance of somap is broken and
              whoever runs it needs to look at it. Until then it can tell you
              nothing.
            </li>
          </ul>
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
      <p className="masthead__name">somap</p>
      <p className="masthead__where">
        School-premises distances for Summit County, Ohio. A helper, not an
        authority.
      </p>
    </header>
  );
}

export function PrivacyFootnote({ onHomePage = false }: { onHomePage?: boolean }) {
  return (
    <footer className="footnote">
      <p>
        somap did not write down the address you typed. Not in a log, not in the
        web address of this page, not in a database, and not on its way to
        anywhere else — the address was sent inside the form rather than in the
        link, so it is not in your browser&rsquo;s history either. This page is
        also marked never to be stored by your browser or by anything between
        you and somap, which matters on a shared or library computer. You are
        not asked to take any of that on trust:{" "}
        <code>docs/privacy/verification.md</code> in the source is the procedure
        for checking every part of it yourself, and somap runs entirely on your
        own machine if you would rather not involve anybody at all.
      </p>
      {onHomePage ? null : (
        <p>
          <a href="/">Search another address</a>
        </p>
      )}
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
