// THE FINDING, AND THE THINGS THE READER CARRIES TO THE PHONE CALL.
//
// The cards on which tarrow says what it found: the finding itself, one card
// per flagged premises, the parcel it measured from, and the ambiguity
// declaration. The five copy rules that govern every word here are stated in
// full at the top of result-view.tsx and are not repeated -- but two of them
// bind this file specifically and are restated where they apply below.
//
// NOTHING IN THIS FILE COMPUTES ANYTHING. Phase 3's handoff: "A renderer that
// derives 'no flags means fine' is the failure the type gate exists to prevent;
// it cannot construct a clearance, but it can still write one as a sentence."
// Every number here comes from the result; the only arithmetic is a unit
// conversion in app/format.ts and a fraction that positions a mark.

import type { ReactNode } from "react";

import {
  BufferBar,
  Card,
  CardTitle,
  DistanceScale,
  Disclosure,
  Eyebrow,
  Measured,
  More,
  Prose,
  type CardTone,
} from "./cards.tsx";
import { count, feet, metresAndFeet, plural } from "./format.ts";
import type {
  AmbiguityDeclaration,
  FlaggedPremises,
  PremisesMeasurementBasis,
  ResidenceMeasurementBasis,
  ResolvedResidence,
} from "../server/result.ts";

// HOW THE BOUNDARY WAS ESTABLISHED, IN A PHRASE EACH.
//
// These were paragraphs -- three or four sentences apiece, explaining the
// provenance of a shape to somebody who wanted to know how far away a school
// was. They now say the same thing in the length a table cell can hold, which
// is the length a reader will actually read. The full account is on /faq.
const PREMISES_BASIS: Record<PremisesMeasurementBasis, string> = {
  board_of_education_parcel: "County tax parcel, school-board owned",
  named_exempt_parcel: "Tax-exempt parcel, owner name reads as a school",
  point_in_parcel: "Mailing address geocoded into this parcel",
  point_near_parcel: "Geocoded near this parcel, within 5 m",
  none: "No boundary held — never measured",
};

const RESIDENCE_BASIS: Record<ResidenceMeasurementBasis, string> = {
  point_in_parcel: "County address point falls inside this parcel",
  point_near_parcel: "County address point within 5 m of this parcel",
};

const SCHOOL_TYPE: Record<string, string> = {
  public: "Public",
  nonpublic: "Nonpublic",
  unclassified: "Not classified",
};

function schoolType(value: string): string {
  return SCHOOL_TYPE[value] ?? value;
}

/**
 * THE FINDING CARD: the answer, alone on a screen, with nothing competing.
 *
 * `label` is the one string that names this shape, and it is REQUIRED TO BE
 * DISTINCT across every shape tarrow renders -- `app/tests/copy.test.ts` reads
 * it off `data-answer-label` and fails if two shapes share one. That is the
 * textual half of "a refusal and a result must be unmistakable apart"; the
 * `tone` modifier carries the non-textual half, drawing the two no-answer
 * shapes with a dashed edge rather than a solid one.
 *
 * `isNot` is the sentence that says what the finding is NOT, and it is on this
 * screen rather than below it. Rule 2: an absence of flags is not good news,
 * and the sentence saying so may not be somewhere the reader has to scroll to.
 */
export function FindingCard({
  tone,
  label,
  count: countText,
  unit,
  isNot,
  coverage,
  more,
}: {
  tone: CardTone;
  label: string;
  count: string;
  unit: string;
  isNot: ReactNode;
  /**
   * What was NOT checked, as one line (see CoverageLine in manifest-view.tsx).
   *
   * It is ON THIS CARD, beside the number, and that placement is the whole of
   * Principle II's delivery on the answer surface: "absence of a flag is
   * meaningful only against a stated list of what was searched" is only true
   * for a reader who sees both at once. Absent on the shapes where tarrow
   * measured nothing at all, because there is no finding for it to qualify.
   */
  coverage?: ReactNode;
  more: string;
}) {
  return (
    <Card tone={tone}>
      <p className="eyebrow" data-answer-label={label}>
        {label}
      </p>
      <p className="finding__count">{countText}</p>
      <h1 className="finding__unit">{unit}</h1>
      <div className="finding__is-not">{isNot}</div>
      {coverage}
      <More>{more}</More>
    </Card>
  );
}

/**
 * One flagged premises, alone on a screen.
 *
 * The distance is the largest thing on the card because it is what the reader
 * came for and what they will read down the phone. It is the PESSIMISTIC
 * distance -- the one actually compared against the buffer -- never the raw
 * measurement.
 *
 * The arithmetic behind it folds into the disclosure. The one exception is a
 * premises whose boundary may not be the school's at all: that changes how far
 * the number can be trusted, so it stays on the card.
 */
export function PremisesCard({
  premises,
  index,
  total,
}: {
  premises: FlaggedPremises;
  index: number;
  total: number;
}) {
  const uncorroborated = premises.corroboration === "uncorroborated";
  const slack =
    premises.residenceUncertaintyMeters + premises.premisesUncertaintyMeters;
  const where = [premises.street, premises.city].filter(Boolean).join(", ");

  return (
    <Card>
      <Eyebrow>
        {index} / {count(total)}
      </Eyebrow>
      <p className="premises__distance">
        {feet(premises.pessimisticDistanceMeters)}
        <span className="premises__unit">ft</span>
      </p>
      <h2 className="premises__name">{premises.name}</h2>
      <p className="premises__where">
        {where === "" ? "Address not published" : where}
      </p>

      <BufferBar
        distanceMeters={premises.pessimisticDistanceMeters}
        bufferMeters={premises.bufferMeters}
      />
      {/* The bar's own scale, as two figures. The left end is the address, the
          right end is the rule -- that is the entire comparison, and it does
          not need a sentence to say so. */}
      <p className="bar__labels">
        <span>here</span>
        <span>{feet(premises.bufferMeters)} ft limit</span>
      </p>

      {/* THE ONE THING THAT STAYS ON THE CARD IN WORDS. It is not a caveat
          about tarrow -- it changes what this number means, and a reader who
          acts on the distance without it is acting on a boundary that may
          belong to somebody else. */}
      {uncorroborated ? (
        <div className="callout">
          <p>
            <strong>This boundary may not be the school&rsquo;s.</strong> The
            real school land may reach further. Ask about this one by name.
          </p>
        </div>
      ) : null}

      {/* WHAT IS INSIDE THE FOLD IS USABLE, NOT STORED. Each row answers a
          question a reader might actually put to the sheriff's office: how far
          exactly, measured how, how much slack, from which source. That is why
          it is a table of values rather than the paragraphs that used to be
          here -- a disclosure nobody can act on is not disclosure, it is
          length. */}
      <Disclosure summary="The measurement">
        <DistanceScale
          distanceMeters={premises.pessimisticDistanceMeters}
          bufferMeters={premises.bufferMeters}
        />
        <dl className="facts">
          <dt>Measured</dt>
          <dd>
            <Measured>{metresAndFeet(premises.distanceMeters)}</Measured>
          </dd>
          <dt>Slack subtracted</dt>
          <dd>
            <Measured>{metresAndFeet(slack)}</Measured>
          </dd>
          <dt>Compared against</dt>
          <dd>
            <Measured>
              {metresAndFeet(premises.pessimisticDistanceMeters)}
            </Measured>{" "}
            vs <Measured>{metresAndFeet(premises.bufferMeters)}</Measured>
          </dd>
          <dt>Boundary from</dt>
          <dd>{PREMISES_BASIS[premises.measurementBasis]}</dd>
          <dt>Kind</dt>
          <dd>{schoolType(premises.schoolType)}</dd>
        </dl>
      </Disclosure>
    </Card>
  );
}

/**
 * Which parcel the distances were measured from.
 *
 * The one fact that can invalidate the entire answer -- this may not be your
 * parcel -- is the card's headline, where it is read without opening anything.
 * The rest answers "how does tarrow know" and folds.
 */
export function ResidenceCard({ residence }: { residence: ResolvedResidence }) {
  return (
    <Card kind="detail">
      <Eyebrow>Measured from</Eyebrow>
      <CardTitle>
        {residence.siteAddress ?? `Parcel #${residence.parcelId}`}
      </CardTitle>
      {/* The one sentence that can invalidate everything above it, and the
          reason this card exists at all rather than folding entirely. */}
      <p className="residence__check">Not your property? The answer is not yours either.</p>
      <Disclosure summary="This parcel">
        <dl className="facts">
          <dt>Parcel</dt>
          <dd>
            <Measured>#{residence.parcelId}</Measured>
          </dd>
          <dt>County label</dt>
          <dd>{residence.addressLabel ?? "not published"}</dd>
          <dt>Jurisdiction</dt>
          <dd>{residence.municipality ?? "not recorded"}</dd>
          <dt>Matched by</dt>
          <dd>{RESIDENCE_BASIS[residence.measurementBasis]}</dd>
          <dt>Slack this side</dt>
          <dd>
            <Measured>{metresAndFeet(residence.uncertaintyMeters)}</Measured>
          </dd>
        </dl>
      </Disclosure>
    </Card>
  );
}

/**
 * DECISION §4: one typed address can mean several parcels -- up to 505 for a
 * condominium. tarrow never silently picks one. The ambiguity is declared and
 * the answer shown is the most restrictive candidate.
 *
 * Which parcel is actually yours changes the answer, so this is not a
 * provenance detail and does not fold. The candidate table does.
 */
export function AmbiguityCard({
  ambiguity,
}: {
  ambiguity: AmbiguityDeclaration;
}) {
  return (
    <Card kind="gap">
      <Eyebrow>Read this first</Eyebrow>
      <p className="finding__count">{count(ambiguity.candidateCount)}</p>
      <CardTitle>parcels share this address</CardTitle>
      <Prose soft>
        <p>
          Common in apartment buildings and condominiums. The answer here is
          the <strong>most restrictive</strong> of them. Give the
          sheriff&rsquo;s office your specific unit.
        </p>
      </Prose>
      <Disclosure summary="All of them">
        <div className="scroller">
          <table className="grid-table">
            <thead>
              <tr>
                <th scope="col">Parcel</th>
                <th scope="col">Address</th>
                <th scope="col">Jurisdiction</th>
                <th scope="col">Inside</th>
                <th scope="col">Closest</th>
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
                      ? "—"
                      : metresAndFeet(
                          candidate.nearestPessimisticDistanceMeters,
                        )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Disclosure>
    </Card>
  );
}

/**
 * THE ACTION CARD, for the shapes where tarrow measured nothing inside a
 * buffer -- an unflagged answer, a refusal, a failure.
 *
 * Spec FR-013 and AC #7: guidance to confirm with the registering sheriff's
 * office. Written as the next step, not as a disclaimer -- the constitution's
 * promise is "three days of guessing into an hour of searching plus one
 * confirming phone call", and this is that phone call.
 *
 * `steps` is what to carry into it, so it is one specific question about one
 * specific parcel. The caller supplies them because what to say depends on
 * what tarrow found, and this component states nothing of its own about any
 * address.
 *
 * IT IS DRAWN REVERSED -- ink ground, dark text -- so it reads as the
 * instruction rather than as another disclosure. It is the only card on the
 * surface treated that way.
 */
export function SheriffCard({
  steps,
  footer,
}: {
  steps: readonly string[];
  footer: ReactNode;
}) {
  return (
    <Card kind="act">
      <Eyebrow>Your next step</Eyebrow>
      <CardTitle>Call the sheriff&rsquo;s office where you register</CardTitle>
      <ul className="say">
        {steps.map((step, i) => (
          <li key={step}>
            <span className="say__n" aria-hidden="true">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ul>
      <p className="act__footer">{footer}</p>
    </Card>
  );
}

/**
 * THE ACTION CARD FOR A FLAGGED ADDRESS, AND WHY IT IS A DIFFERENT ACTION.
 *
 * Every other shape sends the reader to the sheriff's office, because tarrow
 * does not know the answer and that office does. This shape is the one case
 * where tarrow has measured something concrete: a school premises, with a
 * surveyed boundary, inside the buffer. The likely outcome of a call is "no".
 *
 * Sending somebody to make that call anyway costs them a day and costs the
 * office a call, to be told what this screen already showed them. So the
 * recommended action here is to LOOK SOMEWHERE ELSE, and the phone call is
 * offered rather than instructed -- available to anyone who wants it, not
 * presented as the thing to do next.
 *
 * WHAT THIS CARD MAY NOT BECOME. "Look elsewhere" is a recommendation about
 * where to spend effort. It is not a statement that the address is barred,
 * and it must never harden into one: tarrow measures and does not decide
 * (rule 1), the boundary may be wrong, and the reader is entitled to check.
 * That is why the call stays on the card, in the reader's own hands.
 */
export function LookElsewhereCard({
  premises,
}: {
  premises: readonly FlaggedPremises[];
}) {
  const nearest = premises.reduce(
    (a, b) =>
      b.pessimisticDistanceMeters < a.pessimisticDistanceMeters ? b : a,
    premises[0]!,
  );
  return (
    <Card kind="act">
      <Eyebrow>Your next step</Eyebrow>
      <CardTitle>Try a different address</CardTitle>
      <Prose>
        <p>
          Nearest is <strong>{nearest.name}</strong>, at{" "}
          {feet(nearest.pessimisticDistanceMeters)} ft. Another address is
          likely a better use of your time than asking about this one.
        </p>
      </Prose>
      <p className="act__footer">
        tarrow can be wrong, and you can still ask. Call the sheriff&rsquo;s
        office where you register and read them the{" "}
        {plural(premises.length, "school", "schools")} above.{" "}
        <a href="/faq">What tarrow is, and what it is not</a>.
      </p>
    </Card>
  );
}

/** The steps every shape shares, whatever tarrow found. */
export const SHERIFF_FOOTER = (
  <>
    If that office and tarrow disagree, that office is right and tarrow is
    wrong. <a href="/faq">What tarrow is, and what it is not</a>.
  </>
);
