# TASK-0022 — Direction E (One Card) is the tarrow web surface

**Status:** decided
**Date:** 2026-08-07
**Decided by:** operator selection among round-2 design artifacts
**Artifacts the decision was made against:**
`docs/design/round2/d-survey.html`, `docs/design/round2/e-one-card.html`,
`docs/design/round2/f-worksheet.html`

---

## The decision

**E — One Card** is the direction implemented as tarrow's real web surface.

The page stops being a scrolling document and becomes a **deck**: the finding owns one full
screen with nothing else on it, and every subsequent idea — each flagged premises, each
coverage gap, the sheriff step, the provenance, the privacy note — gets its own full screen.
The mechanism is CSS scroll-snap. No script, no JS-dependent state; with scripting off it
degrades to a long page with large sections, which is the no-JS requirement satisfied by
construction rather than by a fallback.

Two directions are **preserved, not built**:

- **D — The Survey**, carded as TASK-0023, to be rebuilt on a real map engine rather than
  the hand-drawn SVG plat of the demo. See the origin constraint below.
- **F — The Worksheet**, carded as TASK-0024. The operator's assessment, recorded verbatim
  because it is the reason it is not being built now: *"I DO like the F (worksheet) style and
  see how it adheres to our purpose. BUT it does too much for a V1 MVP."* F is a whole
  interaction model — a first-person document with authored blanks, each captioned with who
  must fill it — not a restyle. It is the strongest expression of Principle II found so far
  and it is preserved for exactly that reason.

## Why E

Round 1 (A/B/C) was rejected wholesale: *"They are all the same basic UI same basic structure
same basic everything."* That was correct — they differed in paint, not in shape. Round 2
varied structure, and E's variation answers the specific failure TASK-0017 already named.

Rule 5 in `app/app/result-view.tsx` says length is a safety property: disclosure that is
scrolled past has not been delivered. TASK-0017 attacked that by cutting length. E attacks it
structurally — nothing competes for attention, so there is no "below the fold" to be lost in.
The gaps are not a section the reader may skim past on the way to the end; each one is a
screen the reader must move through. Principle II stops depending on the reader's stamina.

The unflagged answer is the case that matters most. "Outside every buffer we checked" is the
most dangerous screen tarrow renders, and in a scrolling document its qualification competes
with everything below it. On a card it is alone with the sentence that says the finding is
smaller than it sounds, and the three not-checked screens come after it by construction.

## What the decision does not license

- **Page order is unchanged.** answer → sheriff step → coverage manifest → unverified rule →
  privacy footnote. Cards are the rendering of that order, not a licence to reorder it.
- **The collapse rule survives.** What tarrow did not check stays visible (its own cards);
  how tarrow knows what it checked stays in `<details>` (the provenance cards).
- **Nothing load-bearing moves behind script.** Scroll-snap is a progressive enhancement over
  a document that is already complete. FR-015 is unchanged.
- **The five copy rules survive verbatim.** No card may state or imply permission, and the
  greyscale distinguishability of refusal / flagged / measured is carried by label, headline,
  border and structure — never by the dark world's accents alone.

## The origin constraint, and why D is MapLibre and not Mapbox

The operator asked for D to be rebuilt with "an actual mapping system such as mapbox".
Mapbox cannot be used, and the reason is the same one that governs the whole product.

**Mapbox is a third-party origin.** Its GL JS bundle, its style JSON, its glyphs, and every
map tile are fetched from `api.mapbox.com` at runtime, with an access token identifying the
account. Each tile request's path *is* the map coordinate being viewed. For tarrow, that
coordinate is the address somebody on a registry just typed. It would hand Mapbox — on every
answer, without a script the reader could inspect, without consent — the reader's IP address,
the referring page, and the location they were asking about. That is precisely the record
FR-026 and Principle III exist to prevent, and it is worse than the webfont hazard
`app/app/styles.css` is written against, because the leaked value is the query itself rather
than merely the fact of a visit.

`app/scripts/scan-external-origins.mjs` would fail the image build, and `default-src`/
`connect-src` in the CSP would refuse the requests at runtime. The constraint is enforced,
not aspirational.

**The real mapping system that is available:** MapLibre GL JS — the open fork of Mapbox GL
JS, MIT-licensed, vendored and served from tarrow's own origin — reading vector tiles from a
self-hosted PMTiles archive built at ingest from data tarrow already holds (county parcels,
school premises) plus an OpenStreetMap-derived basemap extract, served by tarrow's own
server. Every byte comes from tarrow's origin; no token, no third party, nothing that leaves.
This is a genuine map engine — real projection, real vector tiles, pan and zoom — and it
gives up nothing D was reaching for. It is a substantial piece of work, which is why it is a
card rather than part of this one.

D also has a property worth keeping in view when it is built: the demo fetched *nothing*,
because the geometry was already in Postgres. Whatever D becomes must stay on that side of
the line.

## Consequences

- TASK-0022 implements E: `styles.css` restructured into a stated layer system,
  `result-view.tsx` decomposed into per-card components, the token system written down.
- TASK-0023 (D, MapLibre + self-hosted PMTiles) and TASK-0024 (F, worksheet) are on the
  board, each citing its preserved artifact in `docs/design/round2/`.
- The round-2 artifacts stay tracked. They are the evidence this decision was made against,
  and for D and F they are the specification of what to build.
