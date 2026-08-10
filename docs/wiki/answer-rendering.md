---
name: answer-rendering
description: How a search result becomes a deck of full-screen cards — the five copy rules, the collapse rule that keeps limitations visible while provenance folds away, the one-line coverage statement beside the finding, and the prohibition on the renderer computing anything.
kind: component
sources:
  - app/app/result-view.tsx
  - app/app/cards.tsx
  - app/app/finding-view.tsx
  - app/app/manifest-view.tsx
  - app/app/format.ts
  - app/tests/copy.test.ts
verified_against: ad1085047fbf413d249818b651dcb224725409e3
---

# Answer rendering

`app/app/result-view.tsx` is the words. Its header states the audience plainly: somebody on a
registry looking for somewhere to live, sometimes under a thirty-day order to move, not a
lawyer, possibly reading on a phone or a library computer at the end of a long day. Copy
written to cover tarrow rather than to be understood by that person has failed, however
defensible it would look in a disclaimer.

The answer is a **deck**: one idea per full-viewport card, stepped through with CSS
scroll-snap. See [[web-surface]] for the mechanism; this note is the wording and the
ordering.

## How it works

Five rules govern the file:

1. **Never state or imply permission.** The strongest sentence available is "outside every
   buffer we checked", and it is only honest when the reader can see on the same screen what
   was not checked. `app/tests/copy.test.ts` scans the raw response body of every result
   shape for permission vocabulary and fails on it.
2. **An absence of flags is not good news.** "No results found" reads as good news, so that
   phrasing does not appear. The unflagged answer is headed with what it actually is, and the
   sentence directly under the headline — "Smaller than it sounds. A measurement, not a
   decision." — is on the same card, not below a fold.
3. **A refusal and a result must be unmistakable apart** — by label, headline, border (dashed
   for anything that is not an answer), and structurally: no refusal renders a residence card
   or a premises card, because there is none.
4. **The action is the recommended next step, not a disclaimer.** It appears on every shape,
   including the ones where tarrow failed, and it is the only card drawn in reversed ink.
5. **Length is a safety property.** The page once ran the answer then six full-length
   sections of qualification, every one true; a reader under a deadline read the first
   screen. Disclosure scrolled past has not been delivered.

Rule 5 produced the collapse rule a future editor should apply rather than reverse: **what
tarrow did not check stays visible; how tarrow knows what it checked collapses.** The gap
statement and the flagged premises with their distances are unfolded always. Per-premises
arithmetic and parcel resolution are one click away in a `<details>` — present in the served
HTML, never absent from it. Provenance that belongs to no particular answer — the layer
registry, the fetch dates, the full gap ledger — lives on `/faq`.

The file also names the mistake it exists to prevent: moving the coverage statement *itself*
to `/faq` would be a Principle II violation dressed as an information-architecture
improvement, because a link is not a statement. Shortening it is not that mistake; removing
it from the answer would be.

### The deck, in order

`ResultPage` renders the shape's own cards and then `CheckAnotherCard`. Each shape composes:

    ambiguity card      only when the address resolves to several parcels
    FINDING CARD        the number, what it is not, and what was not checked
    premises cards      one per flagged premises, flagged shapes only
    action card         look elsewhere (flagged) or call the office (everything else)
    residence card      the parcel measured from
    check another       the way out

The order is the argument. The action comes directly after the finding because it is the one
thing on the surface the reader can *do*. The coverage statement is not a card at all — it
rides **on** the finding card, beside the number it qualifies, because "absence of a flag is
meaningful only against a stated list of what was searched" is only true for a reader who
sees both at once.

### The shapes and the action they recommend

A flagged answer renders `LookElsewhereCard`: tarrow measured a school premises inside the
buffer, so the likely outcome of a call is "no", and the recommendation is to spend the
effort on another address. The call is *offered* rather than instructed — tarrow can be
wrong, the boundary may not be the school's, and the reader is entitled to check. Every other
shape renders `SheriffCard`, because there tarrow does not know and that office does.

That distinction is a recommendation about where to spend effort, never a statement that an
address is barred. The file says so explicitly, so the card cannot harden into a verdict.

**Nothing here computes anything.** Every number comes from the result, every limitation from
the coverage-gap ledger, and the only arithmetic is presentation in `app/format.ts` — unit
conversion, and `bufferFraction`, which places a measured distance on the buffer scale as a
clamped fraction in [0,1]. A renderer that derives "no flags means fine" is the failure the
type gate exists to prevent: it cannot construct a clearance, but it could still write one as
a sentence.

## The drawings

`app/app/cards.tsx` holds the primitives, which do not know what they hold. Two of them draw
a measurement:

`BufferBar` fills a track to the measured fraction with a tick at the buffer, because
"127.9 m against a buffer of 304.8 m" is two numbers a frightened reader has to hold and
divide when the question is really *how close*. `DistanceScale` draws the same fraction as a
bare line inside the disclosure.

Both are deliberately bare: no colour coding, no zones, no "safe" end, and `aria-hidden`,
since the words already say it once. Both are SVG rather than CSS because `style-src 'self'`
admits no `style` attribute, so a custom property could not carry a computed value into the
document; SVG presentation attributes are not CSS and are not covered by that clause. The
clamp is deliberate — a premises measured past the buffer would otherwise push the mark off
the end, and a drawing that runs off its own axis reads as a rendering fault rather than a
distance.

## Where the words live

The file was 1,089 lines carrying every result shape, the manifest, the scale, and the
sheriff step, and the safety properties above were impossible to find among them. It is now
split by responsibility:

- `app/app/cards.tsx` — the deck's primitives: `Card`, `Eyebrow`, `Disclosure`, `Measured`,
  `BufferBar`, `DistanceScale`. They do not know what they hold.
- `app/app/finding-view.tsx` — what tarrow **found**: `FindingCard`, `PremisesCard`,
  `ResidenceCard`, `AmbiguityCard`, `SheriffCard`, `LookElsewhereCard`.
- `app/app/manifest-view.tsx` — what tarrow did **not** check: `CoverageLine`,
  `CoverageWithdrawnCard`, `RuleNotVerifiedLine`.
- `app/app/result-view.tsx` — the five shapes and the order they are assembled in, which is
  the part that carries the argument.

Database codes get plain-language vocabulary in `finding-view.tsx` — `PREMISES_BASIS` and
`RESIDENCE_BASIS` map each measurement basis to a phrase short enough for a table cell,
including `none`: "No boundary held — never measured." The full account is on `/faq`.

## Connections

- [[result-type-gate]] is the compile-time half; this file is the wording half.
- [[coverage-manifest]] and [[coverage-gap-ledger]] supply everything rendered as limitation.
- [[web-surface]] hosts it; [[proximity-measurement]] produces the distances shown.

## Operational notes

`app/format.ts` holds `metres`, `metresAndFeet`, `feet`, `bufferFraction`, `count`, `plural`,
and `day`. `feet` returns the bare figure with no unit, for the one display number on a card
where the unit is set separately and smaller.

`Masthead`, `SheriffCard`, `CoverageWithdrawnCard`, and `CheckAnotherCard` are exported for
reuse by the route-level empty state (`app/app/routes/answer.tsx`) and the root error boundary
(`app/app/root.tsx`), so the guidance survives even a failure that renders no result at all.
