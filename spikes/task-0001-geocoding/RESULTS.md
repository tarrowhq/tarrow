# TASK-0001 AC#1 — Summit County address match rate

**Measured 2026-08-04.** Everything below is reproducible with `docker compose up -d`
and the scripts in `sql/`. No host installs (Constitution VII).

## The question

Under the decline-only fallback, every address we fail to resolve is a user sent back to
calling the sheriff. So: **if a user types their address, do we find the right parcel?**

Not "do we find *a* parcel." Under Principle I a confident match to the **wrong** parcel is
the unrecoverable failure — it measures the 1,000-foot buffer from a house that isn't theirs
and can report "outside every buffer" when the real address is inside one.

## Method

Two Summit County datasets, independently maintained, both public and freely
redistributable:

| Dataset | Rows | What it gives us |
|---|---|---|
| [Tax Parcels](https://scgis.summitoh.net/hosted/rest/services/parcels_web_GEODATA_Tax_Parcels/FeatureServer/0) | 261,160 | Polygons + a single freetext `siteaddress`, no city, no ZIP |
| [Address Points](https://scgis.summitoh.net/hosted/rest/services/AddressPoints_DBC/FeatureServer/0) | 258,862 | Structured components, maintained by the county addressing authority |

**Ground truth is spatial, never textual.** A candidate parcel is *correct* when the address
point being queried lies inside it or within 5 m of it. That judgement never consults how
either dataset spells anything, which is what makes this a measurement rather than a
tautology.

**Sample:** deterministic 20% by `ap_uid % 5`, giving 50,635 addresses × 3 typing variants =
151,904 probes. 95% CI on the headline rates is ≈ ±0.2 pp — far tighter than the differences
being decided. Deterministic so the number is reproducible.

**Typing variants**, since users don't type canonical form:

1. `1_canonical` — as the addressing authority composes it (`4718 KRANCZ DR`)
2. `2_verbose` — spelled out, mixed case, full postal tail (`4718 Krancz Drive, Norton, OH 44203`)
3. `3_messy` — lowercase, no punctuation, unit appended (`4718 krancz dr apt 2`)

**Two architectures compared:**

- **A — parcel text.** `user text → parcel.siteaddress → parcel`. The architecture recorded
  on the board.
- **B — address point, then geometry.** `user text → address point → that point's parcel`.
  Never text-matches the parcel table at all; matches the dataset the county maintains *for
  address lookup*, then finds the parcel spatially.

## Results

| Approach | Correct | **Wrong** | Ambiguous | No match |
|---|---:|---:|---:|---:|
| A — parcel text | 69.16% | **3.34%** | 5.33% | 22.18% |
| B — address point → spatial | **96.79%** | **0.20%** | 1.75% | 1.26% |

By variant:

| Approach | Variant | Correct | Wrong | No match |
|---|---|---:|---:|---:|
| A | canonical | 68.15% | 3.25% | 23.71% |
| A | verbose | 69.68% | 3.38% | 21.34% |
| A | messy | 69.65% | 3.38% | 21.48% |
| B | canonical | 98.16% | 0.00% | 0.00% |
| B | verbose | 96.13% | 0.30% | 1.81% |
| B | messy | 96.07% | 0.30% | 1.97% |

**B is ~17× safer on the failure mode that matters** (0.20% vs 3.34% wrong) and ~18× better
on no-match. Both approaches are stable across typing variants, so the normalizer handles
formatting; the gap between them is not about formatting at all.

## Why A fails — and why fuzzy matching would make it worse

The two county datasets genuinely disagree about addresses. Taxonomy of A's no-match cases:

| Cause | Share |
|---|---:|
| **House number differs between datasets** (`4921 FRIAR RD` vs `4932 FRIAR RD`) | 50.1% |
| Street name or type differs (`510 FENN RD` vs `510 FENN ST`) | 41.5% |
| Parcel has no house number — unsplit development land (`GREEN GLEN SPUR`) | 8.4% |

The instinct on seeing a 22% no-match rate is to add fuzzy matching. **That instinct is
dangerous here.** Half of A's failures are house-number disagreements, and fuzzy-matching
`4921` to `4932` returns a confidently wrong house — converting a safe NO_MATCH into an
unsafe UNIQUE_WRONG, which is precisely the direction Principle I forbids. Edit distance
cannot tell a typo from a different building.

## Honest limitations

- **B's numbers are an upper bound.** The probe addresses derive from the same layer B looks
  up, so B is partly being asked to match a dataset against itself. The variants introduce
  real formatting divergence but not *semantic* divergence — a user typing an old street
  name, a nickname, or a genuinely wrong house number. That residual is unmeasurable with
  this data. In production the effect is real but attenuated: a user's address usually comes
  from mail or a lease, which descends from the same addressing authority.
- **Address Points has coverage gaps.** Cuyahoga Falls shows only 3,224 points for a city of
  ~50,000. The sample is therefore biased toward well-covered municipalities.
- **2.15% of address points have no parcel within 5 m** and are excluded from scoring.
- **Ambiguity is real.** One normalized address maps to as many as 505 parcels (condominium
  complexes); `2200 HIGH ST` appears 218 times in the address points. Addresses matching more
  than 20 parcels are reported as `AMBIG_LARGE` rather than resolved, since they are ambiguous
  under any product behaviour.
- **Parcel `siteaddress` is not unique county-wide** — it carries no city. Deriving each
  parcel's municipality by spatial join to boundaries would fix this, and is needed for
  TASK-0007 anyway.

## Four defects found in the method itself

Each would have produced a confident, wrong number. Recorded because the corrections are the
evidence that the final figure means anything.

1. **Strict `ST_Contains` as ground truth** reported 14.6% of addresses as having no parcel.
   ~80% of those sit within 3 m and 97% within 10 m — registration noise between two
   independently digitized layers. It was measuring GIS precision, not address matching.
   Tolerant ground truth moved eligibility to 97.85%.
2. **`::geography` casts defeated the spatial index.** Ground-truth build ran 12+ minutes
   before cancellation; in EPSG:6549 it takes 42 seconds.
3. **Discarding unit numbers made the join quadratic.** A 218-unit building collapses to one
   normalized address, so self-joining went quadratic exactly where people live densely and
   killed the server. Bounded now. *This is a consequence of a deliberate architectural
   choice, not a bug in it.*
4. **`ADDR_ID` is not unique.** 30,426 duplicate rows, including 26,660 with an **empty** id
   and single ids repeated up to 155 times. Every join keyed on it silently inflated counts.
   Caught only because a derived row count failed arithmetic (45,239 × 3 ≠ 161,004). A field
   named `ADDR_ID` in an authoritative government dataset was not an identifier, and nothing
   warned us.

Defect 4 generalizes past this spike: **source data must be validated on ingest, not
trusted.** Uniqueness of any field we key on is an assertion to test at load time.

## One normalizer fix the measurement paid for

`5671 WOOSTER ROAD W` — street type not canonicalized because a *suffix directional* follows
it, so it wasn't the final token. Same for `358 31 STREET NW`. Fixing it cut verbose no-match
from 5.21% to 1.81%. Rule-based normalization got to 96.8% without libpostal; **libpostal is
not currently justified**, and if it is later, this measures exactly what it would need to
beat.

## Recommendation

**Adopt Approach B.** Resolve the user's address against the Address Points layer, then take
that point's parcel geometrically. Keep parcel polygons as the measurement geometry — the
boundary-to-boundary decision is unchanged and correct — but stop using parcel `siteaddress`
as the lookup key.

This is a change to the architecture recorded on TASK-0001, driven by evidence the spike
existed to produce. It does not disturb the decisions around it: parcels remain the geometry,
measurement remains boundary-to-boundary, units remain discarded, and the fallback remains
decline-only. What changes is the lookup path, and it changes toward the safer one.

With B, decline-only costs **~1.3% of searches** rather than ~22%. That is affordable, and it
is what makes decline-only a defensible product decision rather than a punitive one.
