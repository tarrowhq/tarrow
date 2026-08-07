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
import { count, metres, metresAndFeet } from "./format.ts";
import type {
  AmbiguityDeclaration,
  FlaggedPremises,
  PremisesMeasurementBasis,
  ResidenceMeasurementBasis,
  ResolvedResidence,
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

const RESIDENCE_BASIS: Record<ResidenceMeasurementBasis, string> = {
  point_in_parcel:
    "The county's address point for this address falls inside this parcel.",
  point_near_parcel:
    "The county's address point for this address falls inside no parcel. This " +
    "is the parcel within 5 m of it, and tarrow widened the uncertainty to match.",
};

const SCHOOL_TYPE: Record<string, string> = {
  public: "Public school (district, community, or STEM)",
  nonpublic: "Nonpublic school",
  unclassified:
    "Not classified: the tax roll does not say whether the owner runs a " +
    "nonpublic school or a community school, and tarrow will not guess",
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
  more,
}: {
  tone: CardTone;
  label: string;
  count: string;
  unit: string;
  isNot: ReactNode;
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
        Premises {index} of {count(total)}
      </Eyebrow>
      <p className="premises__distance">
        {metresAndFeet(premises.pessimisticDistanceMeters)}
      </p>
      <p className="premises__alt">
        from this address · boundary to boundary · against a buffer of{" "}
        {metresAndFeet(premises.bufferMeters)}
      </p>
      <h2 className="premises__name">{premises.name}</h2>
      <p className="premises__where">
        {where === "" ? "Address not published" : where} ·{" "}
        {schoolType(premises.schoolType)}
      </p>

      <BufferBar
        distanceMeters={premises.pessimisticDistanceMeters}
        bufferMeters={premises.bufferMeters}
      />
      <p className="bar__labels">
        <span>this address</span>
        <span>{metresAndFeet(premises.bufferMeters)}</span>
      </p>

      {uncorroborated ? (
        <div className="callout">
          <p>
            <strong>This boundary may not be the school&rsquo;s.</strong> This
            premises was located by turning a mailing address into a map point,
            and the point landed on a parcel the county does <em>not</em> record
            as tax-exempt, which a school premises almost always is. The
            boundary tarrow measured to may belong to a neighbour, and the real
            school property may reach further than it. Ask the sheriff&rsquo;s
            office about this one by name.
          </p>
        </div>
      ) : null}

      <Disclosure summary="How tarrow arrived at that distance">
        <DistanceScale
          distanceMeters={premises.pessimisticDistanceMeters}
          bufferMeters={premises.bufferMeters}
        />
        <dl className="facts">
          <dt>Kind of school</dt>
          <dd>{schoolType(premises.schoolType)}</dd>
          <dt>Address in the source</dt>
          <dd>{where === "" ? "not published" : where}</dd>
          <dt>Distance tarrow measured</dt>
          <dd>
            <Measured>{metresAndFeet(premises.distanceMeters)}</Measured>, from
            the nearest point of your parcel&rsquo;s boundary to the nearest
            point of this premises&rsquo; boundary
          </dd>
          <dt>Slack subtracted</dt>
          <dd>
            <Measured>{metresAndFeet(slack)}</Measured>:{" "}
            <Measured>{metres(premises.residenceUncertaintyMeters)}</Measured>{" "}
            for your parcel,{" "}
            <Measured>{metres(premises.premisesUncertaintyMeters)}</Measured>{" "}
            for this premises
          </dd>
          <dt>Distance compared against the buffer</dt>
          <dd>
            <Measured>
              {metresAndFeet(premises.pessimisticDistanceMeters)}
            </Measured>
            , against a buffer of{" "}
            <Measured>{metresAndFeet(premises.bufferMeters)}</Measured>
          </dd>
          <dt>How this boundary was established</dt>
          <dd>{PREMISES_BASIS[premises.measurementBasis]}</dd>
          <dt>Where this premises came from</dt>
          <dd>
            <Measured>{premises.layerId}</Measured>
          </dd>
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
      <Eyebrow>What was measured from</Eyebrow>
      <CardTitle>
        Parcel #{residence.parcelId}
        {residence.siteAddress === null ? null : <>, {residence.siteAddress}</>}
      </CardTitle>
      <Prose soft>
        <p>
          <strong>If that is not yours, nothing here applies to you.</strong>{" "}
          tarrow resolved what you typed against the county&rsquo;s list of
          addresses and then found the parcel that address point sits on. If the
          parcel above is not yours, check the address and search again.
        </p>
      </Prose>
      <Disclosure summary="The parcel tarrow measured from, in full">
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
      <Eyebrow>Read this before the rest</Eyebrow>
      <CardTitle>
        This address means {count(ambiguity.candidateCount)} different parcels
      </CardTitle>
      <Prose soft>
        <p>
          Apartment buildings, condominiums, and the same street address
          existing in two places all do this. tarrow does not pick one quietly:
          the answer here is the <strong>most restrictive</strong> of them, the
          one with the most school premises inside the buffer, and among ties,
          the one closest to a school. Ask the sheriff&rsquo;s office about your
          specific unit, and tell them the county records several parcels under
          this address.
        </p>
      </Prose>
      <Disclosure
        summary={<>All {count(ambiguity.candidateCount)} parcels tarrow considered</>}
      >
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
                      ? "nothing tarrow checked was inside the buffer"
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
 * THE ACTION CARD: the one thing on this surface the reader can DO.
 *
 * Spec FR-013 and AC #7: guidance to confirm with the registering sheriff's
 * office on EVERY result, including declines and errors. Written as the next
 * step, not as a disclaimer -- the constitution's promise is "three days of
 * guessing into an hour of searching plus one confirming phone call", and this
 * is that phone call.
 *
 * `steps` is what to carry into it, so it is one specific question about one
 * specific parcel. The caller supplies them because what to say depends on what
 * tarrow found, and this component states nothing of its own about any address.
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

/** The steps every shape shares, whatever tarrow found. */
export const SHERIFF_FOOTER = (
  <>
    If that office and tarrow disagree, that office is right and tarrow is
    wrong. <a href="/faq">What tarrow is, and what it is not</a>.
  </>
);

export function flaggedSteps(premises: readonly FlaggedPremises[]): string[] {
  const named = premises
    .map((p) => `${p.name} at ${metresAndFeet(p.pessimisticDistanceMeters)}`)
    .join("; ");
  return [
    "Give the address exactly as you typed it.",
    `Read out the ${count(premises.length)} tarrow found: ${named}.`,
    "Say tarrow checked school premises only, and no city or village rule at all.",
  ];
}
