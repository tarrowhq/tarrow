# TASK-0001 — Decision: geocoding and distance stack

**Status:** decided 2026-08-04. Evidence: [RESULTS.md](RESULTS.md).
**Constitution:** v1.2.0. Governs under Principles I, II, III, V, VI, VII.

---

## 1. Geocoding: address points, then geometry

**A typed address resolves against the county Address Points layer; the parcel is then
found geometrically.**

```
typed address → normalize → Address Points match → that point's parcel polygon
```

tarrow does **not** match typed addresses against `parcel.siteaddress`. Measured on 151,904
probes over real Summit County addresses:

| Approach | Correct | **Wrong** | Ambiguous | No match |
|---|---:|---:|---:|---:|
| parcel `siteaddress` text match | 69.16% | **3.34%** | 5.33% | 22.18% |
| **Address Points → spatial** | **96.79%** | **0.20%** | 1.75% | 1.26% |

The reason is not string handling, it is that the two datasets answer different questions. A
parcel is a unit of **ownership and taxation**; its `siteaddress` is a situs label on a tax
record. An address point is a unit of **addressable location**, maintained by the office that
assigns addresses and feeds 911 dispatch. They coincide only for a detached single-family
home — 26.8% of parcels have no address point at all, and 5.5% have several. One parcel's tax
record reads `1338 TERRIER DR` while all 377 homes standing on it are addressed on Vale Dr.
Neither is wrong.

Asking each dataset only what it is authoritative for is what produces the 17× reduction in
wrong answers.

**No commercial geocoder is used, ever.** Disqualified twice over: it would send the searched
address to a third party (Principle III), and its index cannot be redistributed, which would
make tarrow un-self-hostable (Principle VII).

**libpostal is not adopted.** Rule-based normalization reached 96.8% alone. If libpostal is
proposed later, RESULTS.md is the bar it must beat.

## 2. Distance: nearest boundary to nearest boundary

**Distance is measured from the nearest point of the residence parcel to the nearest point of
the protected premises parcel.** Never centroid to centroid, never point to point.

ORC 2950.034 defines protected premises as *"the parcel of real property on which [the
facility] is situated"* — explicit for preschool/child-care, children's crisis care, and
residential infant care; school premises is incorporated by reference. The statute does
**not** state how the 1,000 feet is measured.

We do not need to resolve that ambiguity to act safely. Nearest-boundary distance is always
≤ centroid distance, so the boundary reading flags a **strict superset** of addresses. If the
property-line reading is legally correct we are right; if a laxer reading is permitted we were
over-restrictive, which Principle I classifies as recoverable and a disclosure item. TASK-0003
verifies the legal basis and may tighten this.

The magnitude is not academic. The buffer is **304.8 m**; measured parcel extents:

| Parcel size | Median extent | p95 |
|---|---:|---:|
| <0.25 ac (dense urban lot) | 36 m | 70 m |
| 0.25–0.5 ac (typical suburban) | 53 m | 126 m |
| 0.5–2 ac | 114 m | 147 m |
| 2–10 ac | 180 m | 315 m |
| **10+ ac (school campus)** | **578 m** | **1,575 m** |

A campus-sized parcel's extent is **nearly twice the entire buffer**. Point-based measurement
against a school is not an approximation of the legal standard; it is a different calculation
that is wrong by more than the thing being measured.

All spatial work happens in **EPSG:6549** (NAD83(2011) Ohio North, metres). Geography casts
defeat the spatial index and are not used for bulk work.

## 3. When parcel boundaries are unavailable

The two sides of the measurement have **opposite** failure directions, so they get opposite
rules. This is the most important part of this document.

### Residence side — decline

A point lies inside its parcel, so `d(point, premises) ≥ d(parcel, premises)`. **Measuring
from a bare point therefore OVERSTATES the distance, which under-restricts** — the
unrecoverable error.

Making it safe would mean subtracting an assumed parcel reach, and that reach is unbounded:
p95 is 1,575 m for large parcels. Subtracting that would flag everything within ~1.9 km of any
facility, which is not an answer.

**So: if a resolved address has no parcel within 5 m, tarrow declines.** This affects **2.15%**
of address points and is consistent with the decline-only fallback (§4).

### Premises side — inflate, generously

A missing or undersized premises silently shrinks a buffer and produces a false *"outside
every buffer"*. Here over-restriction is the safe direction, so an assumed premises radius is
applied per facility class, drawn from the measured extents above:

| Facility class known only by point | Assumed premises radius |
|---|---:|
| Licensed home / Type B day-care (residential lot) | 126 m |
| Child-care centre, preschool (small commercial lot) | 150 m |
| **School** | **not permitted — see below** |

**A school known only by a point is a coverage gap, not a distance to estimate.** At a p95
extent of 1,575 m, no defensible radius exists: an honest one flags most of a city, and a
convenient one under-restricts. Schools must carry real parcel geometry, and a school without
it is declared absent under Principle II rather than approximated.

### Uncertainty is arithmetic

Every geometry carries an uncertainty radius. Comparisons use the pessimistic bound:

```
d_min = d(a, b) − r_a − r_b        flag when d_min < buffer
```

Principle I as a formula rather than a judgement call, and renderable per Principle II
("parcel boundary to parcel boundary, exact" vs "assumed 150 m premises around a licensed
address").

## 4. Failure behaviour: decline, explicitly

An address that cannot be confidently resolved returns an **explicit could-not-locate**. Never
a low-confidence coordinate, never a ZIP or street centroid, never a nearby-parcel
consolation.

This is structural, not a policy: the only thing the pipeline can return is a matched address
point or nothing. There is no coarse-fallback code path to accidentally take.

**Fuzzy matching is rejected**, and this is a safety decision rather than a quality one. 50.1%
of the parcel-text approach's failures are *house-number* disagreements between county
datasets (`4921` vs `4932 FRIAR RD`). Fuzzy matching converts a safe `NO_MATCH` into a
confident `UNIQUE_WRONG` on exactly those — edit distance cannot distinguish a typo from a
different building. Any future proposal to relax matching must show it does not increase the
wrong-match rate.

**Ambiguity is declared, not guessed.** One normalized address maps to as many as 505 parcels
(condominiums); `2200 HIGH ST` appears 218 times. Where candidates disagree, tarrow resolves to
the most restrictive or asks — it never silently picks one.

With Approach B, declining costs **~1.3%** of searches rather than ~22%. That is what makes
decline-only a defensible product decision rather than a punitive one.

## 5. Privacy: nothing leaves, and it is demonstrable

**No user-entered address reaches any third party, because the query path makes no outbound
network call at all.** Both the address index and the parcel geometry are local. This is
demonstrable rather than promised — a reviewer can read the composition and observe there is
no egress in the query path.

Delivery is hybrid, one engine, two modes:

- **Precomputed index** — the query is run over every parcel at build time and the index
  shipped to the client. No network request is made, so privacy is structural rather than
  policy.
- **Server query endpoint** — conventional, no-log, for anyone who prefers it or falls outside
  a precomputed jurisdiction.

**PostGIS is the only thing that ever computes an answer.** The shipped index is a *projection*
of it, generated by it — the same shape Principle IV sets for rules (files → ETL → database →
index). Everything downstream of the source is derived, disposable, and rebuilt in full, so
the fast path cannot disagree with the slow path.

Self-hosting (Principle VII) is what makes the server mode acceptable: "trust us not to log"
becomes "or run it yourself and trust no one." Every input is public and redistributable,
which is precisely what a commercial geocoder would have destroyed.

## 6. Consequences for other work

- **TASK-0002.02 / TASK-0012** — the Address Points layer becomes a required ingest, not just
  parcels. Mineral-rights parcels (`usecd` 200-series, 1,128 records, 54,573 acres of
  overlapping subsurface polygons) must be excluded from measurement geometry.
- **TASK-0002.03** — the coverage manifest must state *which delivery path answered*, and must
  render the per-geometry uncertainty from §3.
- **TASK-0003** — verify the measurement method against Ohio case law. Also: ORC 2950.034
  conditions preschool/child-care premises on the premises being **properly marked** with
  signage, which is not knowable from GIS data. Principle I says assume marked, and disclose.
- **TASK-0005** — the per-class assumed premises radii in §3 need review against actual
  facility parcels once those are ingested.
- **New** — parcel `siteaddress` is not unique county-wide (no city field). Deriving each
  parcel's municipality by spatial join to boundaries fixes it and is needed for TASK-0007
  anyway.

## 7. Known limitations, stated rather than buried

- **The 96.79% is an upper bound.** Probe addresses derive from the same layer B looks up, so
  formatting divergence is simulated but *semantic* divergence — an old street name, a
  nickname, a genuinely wrong house number — is not. Attenuated in production because a user's
  address usually descends from the same addressing authority, but real.
- **Address Points has coverage gaps.** Cuyahoga Falls shows 3,224 points for a city of
  ~50,000. Measurements are biased toward well-covered municipalities.
- **Summit County only.** Parcel and address-point data are per-county and published in
  thousands of formats nationally. This is excellent for the claimed jurisdiction and
  expensive to scale — accepted deliberately under Principle VI, and stated here so county #4
  does not discover it.
- **`ADDR_ID` is not unique** in the source (30,426 duplicates, 26,660 empty). Any ingest
  keying on it must assert uniqueness at load, not assume it.
