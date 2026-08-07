# The tarrow design system — One Card

**Status:** current
**Established by:** TASK-0022, implementing direction E
**Decision:** `docs/decisions/task-0022-direction-e-one-card.md`
**Specimen:** `docs/design/round2/e-one-card.html`

This note is the contract `app/app/styles.css` is written against. Extend the system; do not
add a one-off rule beside it. If something here is wrong, change it here first and then
change the CSS — a token whose stated meaning and actual use have drifted apart is worse than
no token, because the next editor trusts it.

---

## The signature element: the card

**One idea gets one screen.** That is the whole system, and everything below serves it.

A card is a full-viewport panel that holds exactly one thing the reader must take in: the
finding, or one school, or one gap, or the phone call. Cards are stacked in a scroll
container with CSS scroll-snap, so the reader moves through them one at a time.

Why this, for this product: rule 5 in `app/app/result-view.tsx` says length is a safety
property — disclosure that is scrolled past has not been delivered. A scrolling document
makes every gap compete with the answer and lose. On a card, nothing competes; there is no
below-the-fold to be lost in. Principle II stops depending on the reader's stamina.

**The mechanism is CSS only.** `scroll-snap-type: y proximity` on the container,
`scroll-snap-align: start` on each card. No script, no state, no JS-dependent behaviour. With
scripting off the deck is a long page with big sections, which is the whole answer — the no-JS
requirement satisfied by construction rather than by a fallback.

`proximity`, not `mandatory`: a card whose content is taller than the viewport (a long gap
description at 360 px, or at a large text size) must remain freely scrollable. `mandatory`
fights the reader there and can strand content off-screen. Snapping is an assist, never a
gate on reading.

---

## Colour

**One committed world.** tarrow's surface is dark in every viewer theme. It is not
theme-reactive, and this is the one place the system deliberately ignores
`prefers-color-scheme`.

The reason is the reader: a phone at night, or a library machine with somebody behind them.
A single world means the contrast of every state was verified once and cannot be broken by a
theme the page does not control. Every colour is painted explicitly — nothing borrows a
ground from the host.

### Ground and ink

| Token | Value | Meaning |
|---|---|---|
| `--bg` | `#0e1013` | The deck's ground, behind and between cards |
| `--card` | `#171a1f` | A card's own ground — the default surface |
| `--card-2` | `#1e222a` | A sunk surface inside a card: input wells, bar tracks |
| `--ink` | `#f3f5f8` | Body text, headlines, and the reversed-card ground |
| `--ink-soft` | `#9aa3b2` | Supporting text: eyebrows, captions, units, labels |
| `--ink-invert` | `#0e1013` | Text on a reversed (ink-ground) card |
| `--rule` | `#2c313a` | Hairlines and card edges |
| `--rule-strong` | `#55606f` | Numerals and rules on a reversed card |

### The state accents

There are **two** saturated colours on this surface, and each means exactly one thing. This
is inherited from the previous system and is not a style choice — the reasoning is preserved
verbatim in `styles.css` because it is a safety property.

| Token | Value | Means |
|---|---|---|
| `--flagged` | `#ff6b4a` | Something is inside a buffer tarrow checked |
| `--flagged-sunk` | `#2a1310` | The flagged card's ground |
| `--stopped` | `#f0b429` | tarrow did not answer, or did not check |
| `--stopped-sunk` | `#241b07` | The stopped card's ground |
| `--measured` | `#f3f5f8` | A measurement was made and nothing was flagged |
| `--measured-sunk` | `#1c2027` | The measured card's ground |
| `--broken` | `#c2c6cd` | tarrow failed |
| `--broken-sunk` | `#1b1d22` | The broken card's ground |

**The measured state is ink, not green, and never green.** Green says "go" in a channel the
copy rules never authorised: rule 1 forbids stating or implying permission,
`app/tests/copy.test.ts` scans body text for permission vocabulary, and a colour is not body
text. The strongest sentence tarrow may write is "outside every buffer we checked" — a
measurement, not a verdict — and the page must not say something stronger in a channel no
test can read. Red against green is also the worst available pairing for the two most
consequential states under the commonest colour vision deficiency.

**Colour never carries a distinction alone.** Every state is also told apart by its label,
its headline, its border treatment, and which cards exist at all. Verified in greyscale;
`copy.test.ts` asserts the structural half of it.

---

## Type

Two families, both already on the reader's device. **No webfont, ever** — a font request from
a third-party origin carries the reader's IP address and the referring page to whoever serves
it, on every view, without a script and without consent. For a population on a public
registry that is a record of who read a page about where they are allowed to live, held by
somebody else.

| Token | Stack | Carries |
|---|---|---|
| `--font-sans` | `system-ui, -apple-system, "Segoe UI", Roboto, …` | Every sentence tarrow **writes** |
| `--font-mono` | `ui-monospace, SFMono-Regular, Menlo, Consolas, …` | Every value tarrow **read** |

That division is load-bearing, not decorative: it is the same line the `result-view.tsx`
header draws between what tarrow says and what tarrow found. A distance, a date, a parcel id,
a layer name — the things a reader will say down a phone to a sheriff's office — are mono
with `font-variant-numeric: tabular-nums`, so two distances compare directly down the page
and a digit is never misread.

### The scale

Type is set in a fluid scale so the finding is enormous on a phone without overflowing a
narrow one. `clamp()` throughout; no viewport unit without a floor and a ceiling.

| Token | Value | Used for |
|---|---|---|
| `--t-finding` | `clamp(3.6rem, 19vw, 5.5rem)` | The count on a finding card — the one number |
| `--t-measure` | `clamp(2.6rem, 14vw, 3.6rem)` | A distance on a premises card |
| `--t-card-h` | `clamp(1.375rem, 5.5vw, 1.75rem)` | A card's own headline |
| `--t-lede` | `1.0625rem` | The one sentence under a finding |
| `--t-body` | `0.9375rem` | Card body copy |
| `--t-detail` | `0.875rem` | Provenance, tables, footnotes |
| `--t-eyebrow` | `0.6875rem` | Mono uppercase labels above a card's content |

Weights: `800` for findings and card headlines, `700` for names and emphasis, `400`
otherwise. Tracking tightens as size grows (`--track-tight: -0.03em` on display sizes,
`--track-wide: 0.12em` on mono eyebrows).

---

## Spacing

A four-step rhythm from a `0.25rem` base. Everything on the surface uses one of these; a
value outside the scale is a bug in the system, not a refinement of it.

| Token | Value |
|---|---|
| `--s-1` | `0.35rem` |
| `--s-2` | `0.7rem` |
| `--s-3` | `1.1rem` |
| `--s-4` | `1.75rem` |
| `--s-5` | `2.75rem` |

Card padding is `--s-4` horizontally, with vertical padding that grows on taller viewports so
a card breathes on a desktop without stranding content on a phone.

Radii: `--radius: 0` on everything except the deck's own frame. The surface is drawn with
hairlines and edges, not with rounded chips — a card is a full screen, and a rounded full
screen reads as a modal.

---

## The layer system

`app/app/styles.css` is organised in four stated layers, in this order, and nothing may sit
outside them:

1. **`@theme`** — the two font stacks, overriding Tailwind's defaults so no utility class can
   reintroduce a webfont.
2. **`@layer base`** — the tokens above, plus element defaults: `html`, `body`, links, focus.
3. **`@layer primitives`** — the composable pieces with no knowledge of what they hold: the
   deck, the card, the eyebrow, the measured value, the rule, the disclosure, the field.
4. **`@layer components`** — the named surfaces built from primitives: the finding card, the
   premises card, the gap card, the action card, the provenance card, the ask screen.

A rule that fits no layer does not get an exception; it gets a primitive.

---

## What the system may never do

These are constraints from the constitution and the spec, restated where a designer will read
them.

- **No third-party origin.** No `@font-face`, no `url()` to anywhere, no `@import` surviving
  the build, no preconnect. `scan-external-origins.mjs` fails the image build; `style-src
  'self'` is the runtime backstop.
- **No inline style.** `style-src 'self'` admits no `style=` attribute and no inline
  `<style>`. Anything needing a computed value uses **SVG presentation attributes**, which are
  not CSS and not covered by the policy — see the distance scale in `result-view.tsx`.
- **Nothing load-bearing behind script.** The answer, the coverage manifest, and the sheriff
  step are in the served document on every shape (FR-015). Progressive disclosure is
  `<details>`/`<summary>`, which opens natively.
- **Page order is fixed.** answer → sheriff step → coverage manifest → unverified rule →
  privacy footnote. Cards render that order; they do not license reordering it.
- **The collapse rule holds.** What tarrow did not check stays visible on its own cards. How
  tarrow knows what it checked collapses into `<details>` on the provenance cards.
- **Motion is optional.** The only animation on the surface is the scroll hint, and it stops
  entirely under `prefers-reduced-motion: reduce`, as does smooth scrolling.
- **360 px is the floor.** Every card is readable and every control reachable at 360 px wide,
  and focus is visible on every interactive element.
