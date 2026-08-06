---
name: answer-rendering
description: How a search result becomes a page — the five copy rules, the collapse rule that keeps limitations visible while provenance folds away, and the prohibition on the renderer computing anything.
kind: component
sources:
  - app/app/result-view.tsx
  - app/app/format.ts
  - app/tests/copy.test.ts
verified_against: b5b247a6cb390ba505c674f0c77af551dd547949
---

# Answer rendering

`app/app/result-view.tsx` is the words. Its header states the audience plainly: somebody on a
registry looking for somewhere to live, sometimes under a thirty-day order to move, not a
lawyer, possibly reading on a phone or a library computer at the end of a long day. Copy
written to cover tarrow rather than to be understood by that person has failed, however
defensible it would look in a disclaimer.

## How it works

Five rules govern the file:

1. **Never state or imply permission.** The strongest sentence available is "outside every
   buffer we checked", and it is only honest when the reader can see on the same page what
   was not checked. `app/tests/copy.test.ts` scans the raw response body of every result
   shape for permission vocabulary and fails on it.
2. **An absence of flags is not good news.** "No results found" reads as good news, so that
   phrasing does not appear. The unflagged answer is headed with what it actually is, and the
   sentence under the headline says the finding is smaller than it sounds before the reader
   scrolls.
3. **A refusal and a result must be unmistakable apart** — by label, headline, border (dashed
   for anything that is not an answer), and structurally: no refusal renders a residence, a
   distance, or a premises list, because there is none.
4. **The sheriff step is the recommended action, not a disclaimer.** It appears on every
   shape, including the ones where tarrow failed.
5. **Length is a safety property.** The page once ran the answer then six full-length
   sections of qualification, every one true; a reader under a deadline read the first
   screen. Disclosure scrolled past has not been delivered.

Rule 5 produced the collapse rule a future editor should apply rather than reverse: **what
tarrow did not check stays visible; how tarrow knows what it checked collapses.** The gap
list, the staleness statement, and the flagged premises with distances are unfolded always.
Provenance tables, per-premises arithmetic, and parcel resolution are one click away in a
`<details>` — present in the served HTML, never absent from it. The file also names the
mistake it exists to prevent: moving the coverage manifest itself to `/faq` would be a
Principle II violation dressed as an information-architecture improvement, because a link is
not a statement.

**Nothing here computes anything.** Every number comes from the result, every limitation from
the coverage-gap ledger, and the only arithmetic is a unit conversion in `app/format.ts`. A
renderer that derives "no flags means fine" is the failure the type gate exists to prevent:
it cannot construct a clearance, but it could still write one as a sentence.

Database codes get plain-language vocabulary here — `PREMISES_BASIS` and `RESIDENCE_BASIS`
map each measurement basis to a sentence, including `none`: "tarrow holds a name for this
premises and no shape for it, so it was never measured and was never given a made-up radius."

## Connections

- [[result-type-gate]] is the compile-time half; this file is the wording half.
- [[coverage-manifest]] and [[coverage-gap-ledger]] supply everything rendered as limitation.
- [[web-surface]] hosts it; [[proximity-measurement]] produces the distances shown.

## Operational notes

`app/format.ts` holds `metres`, `metresAndFeet`, `count`, `plural`, and `day`. Shared
components — `Masthead`, `SheriffNextStep`, `PrivacyFootnote` — are exported for reuse by the
route-level empty state and the root error boundary, so the sheriff guidance survives even a
failure that renders no result at all.
