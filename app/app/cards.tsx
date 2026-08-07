// THE PRIMITIVES OF THE DECK.
//
// The signature element of tarrow's surface is the CARD: one idea gets one
// screen, and the reader moves through a deck of them. The system is written
// down in docs/design/tarrow-design-system.md and the direction was chosen in
// docs/decisions/task-0022-direction-e-one-card.md. Read those before changing
// anything here.
//
// WHAT LIVES IN THIS FILE, AND WHAT MAY NOT. These are composable pieces that
// do not know what they hold. A `Card` does not know whether it carries a
// finding or a phone number; `Eyebrow` does not know what it labels. Anything
// that knows what tarrow found belongs in result-view.tsx and its neighbours,
// not here.
//
// WHY THIS SEPARATION IS WORTH KEEPING. result-view.tsx was one 1089-line file
// carrying the masthead, five result shapes, the coverage manifest, the
// distance scale, and the sheriff step. Every one of those had a comment
// explaining a safety property, and the properties were impossible to find
// among them. Splitting the file does not make the rules softer -- each rule
// now sits on the component it governs, where somebody editing that component
// will actually read it.
//
// TWO CONSTRAINTS THIS FILE IS WRITTEN UNDER
//
//   1. NO INLINE STYLE, ANYWHERE. `style-src 'self'` admits no `style=`
//      attribute and no inline <style>, and unlike script-src it carries no
//      nonce, so there is nothing to relax. Anything needing a computed value
//      uses SVG PRESENTATION ATTRIBUTES, which are not CSS and are not covered
//      by that policy. `BufferBar` and `DistanceScale` below are the two
//      places that need one, and both are SVG for exactly this reason.
//
//   2. NOTHING LOAD-BEARING BEHIND SCRIPT. The deck is CSS scroll-snap and
//      nothing else. With scripting off it is a long page with big sections,
//      which is the whole answer -- the no-JS requirement satisfied by
//      construction rather than by a fallback (spec FR-015, SC-001).

import type { ReactNode } from "react";

import { bufferFraction } from "./format.ts";

/**
 * The state a card is drawn in.
 *
 * These are the four the result shapes use, and they are NOT interchangeable
 * with a colour: each drives a label, a headline, a border treatment, and
 * which cards exist at all. `app/tests/copy.test.ts` asserts the class this
 * produces, so a restyle cannot quietly erase the non-textual difference
 * between a refusal and a result.
 */
export type CardTone = "flagged" | "measured" | "stopped" | "broken";

/**
 * The deck: the scroll container the cards snap inside.
 *
 * It is the PAGE, not a fixed-height scroller. A nested scroll container traps
 * a reader who scrolls the document instead, and it depends on a viewport
 * height it cannot know.
 */
export function Deck({ children }: { children: ReactNode }) {
  return <main className="deck">{children}</main>;
}

/**
 * One card: a full-viewport panel holding exactly one thing.
 *
 * `tone` paints it as one of the four result states. `kind` names what sort of
 * card it is -- a gap, an action, a detail -- which drives its own treatment.
 * A card takes at most one of each; they are different axes and combining them
 * has never been needed.
 */
export function Card({
  tone,
  kind,
  children,
}: {
  tone?: CardTone;
  kind?: "gap" | "act" | "detail";
  children: ReactNode;
}) {
  const modifier = tone ?? kind;
  const className = modifier === undefined ? "card" : `card card--${modifier}`;
  return (
    <section className={className}>
      <div className="card__body">{children}</div>
    </section>
  );
}

/** The mono uppercase label above a card's content. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

/** A card's own headline. `h1` only on the card that carries the finding. */
export function CardTitle({
  children,
  level = 2,
}: {
  children: ReactNode;
  level?: 1 | 2;
}) {
  const Tag = level === 1 ? "h1" : "h2";
  return <Tag className="card__title">{children}</Tag>;
}

/** Body copy inside a card. `soft` for supporting text. */
export function Prose({
  children,
  soft = false,
}: {
  children: ReactNode;
  soft?: boolean;
}) {
  return <div className={soft ? "prose prose--soft" : "prose"}>{children}</div>;
}

/**
 * A value tarrow READ, as opposed to a sentence tarrow WROTE.
 *
 * Mono with tabular figures: the reader is going to say some of these numbers
 * down a phone to a sheriff's office, and the ones they must not misread are
 * the measured ones. Two distances also compare directly down the page, which
 * is the comparison the reader is actually making.
 */
export function Measured({ children }: { children: ReactNode }) {
  return <span className="measured-value">{children}</span>;
}

/**
 * How tarrow knows what it checked, folded away.
 *
 * THE COLLAPSE RULE, and the half of it this component implements: what tarrow
 * did NOT check stays visible on its own cards and never comes in here. How
 * tarrow knows what it DID check folds in here -- present in the served
 * document always, never absent from it (spec FR-015). <details> opens with no
 * JavaScript, which is why it is the only disclosure mechanism on the surface.
 */
export function Disclosure({
  summary,
  children,
}: {
  summary: ReactNode;
  children: ReactNode;
}) {
  return (
    <details className="disclosure">
      <summary>{summary}</summary>
      {children}
    </details>
  );
}

/**
 * The scroll hint: the only moving thing on the surface.
 *
 * It is a HINT, not a control. Everything below is reachable by ordinary
 * scrolling whether or not this is seen, and it stops entirely under
 * `prefers-reduced-motion: reduce`. `aria-hidden` on the arrow because the
 * words beside it already say the same thing.
 */
export function More({ children }: { children: ReactNode }) {
  return (
    <p className="more">
      <span className="more__arrow" aria-hidden="true" />
      {children}
    </p>
  );
}

/**
 * The measured distance drawn against the buffer it was compared to.
 *
 * WHY A PICTURE AT ALL, on a surface whose first rule is that it never implies
 * permission. Because "127.9 m against a buffer of 304.8 m" is two numbers a
 * frightened reader has to hold in their head and divide, and the thing they
 * are actually asking is "how close". The bar answers that without a word.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. No zone, no "safe" end, no colour that
 * could read as a verdict. The fill is where the measurement fell and the tick
 * is the buffer. This component only ever renders premises the SERVER already
 * flagged, so the drawing makes no comparison of its own and could not become
 * one -- `bufferFraction` positions a mark and concludes nothing.
 *
 * IT IS SVG AND NOT CSS. `style-src 'self'` admits no style attribute, so a
 * CSS custom property cannot carry a computed value into the document. SVG
 * presentation attributes are not CSS and are not covered by that policy.
 * `aria-hidden` because the sentence above it already says the same thing and
 * a screen reader should hear it once.
 */
export function BufferBar({
  distanceMeters,
  bufferMeters,
}: {
  distanceMeters: number;
  bufferMeters: number;
}) {
  const fraction = bufferFraction(distanceMeters, bufferMeters);
  return (
    <svg
      className="bar"
      viewBox="0 0 100 6"
      preserveAspectRatio="none"
      role="presentation"
      aria-hidden="true"
    >
      <rect className="bar__track" x="0" y="0" width="100" height="6" />
      <rect
        className="bar__fill"
        x="0"
        y="0"
        width={fraction * 100}
        height="6"
      />
      <line className="bar__end" x1="99" y1="-1" x2="99" y2="7" />
    </svg>
  );
}

/**
 * The same measurement at detail size, inside a disclosure.
 *
 * Borders and one mark: no fill, no zone, no colour that could read as a
 * verdict. The mark is a LINE, not a filled shape, because the viewBox is
 * 100x10 while the drawn box is much wider and `preserveAspectRatio="none"`
 * squashes it horizontally. A stroke can opt out of that via `vector-effect`;
 * a fill cannot -- a circle here renders as a smear the width of the axis.
 */
export function DistanceScale({
  distanceMeters,
  bufferMeters,
}: {
  distanceMeters: number;
  bufferMeters: number;
}) {
  const x = 2 + bufferFraction(distanceMeters, bufferMeters) * 96;
  return (
    <svg
      className="scale"
      viewBox="0 0 100 10"
      preserveAspectRatio="none"
      role="presentation"
      aria-hidden="true"
    >
      <line x1="2" y1="5" x2="98" y2="5" className="scale__axis" />
      <line x1="2" y1="1.5" x2="2" y2="8.5" className="scale__end" />
      <line x1="98" y1="1.5" x2="98" y2="8.5" className="scale__end" />
      <line x1={x} y1="0.5" x2={x} y2="9.5" className="scale__mark" />
    </svg>
  );
}
