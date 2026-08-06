---
name: data-sources
description: The five fetched layers and two derived school layers, why each was chosen so their weaknesses do not coincide, and what each is known not to cover.
kind: concept
sources:
  - app/etl/sources.ts
  - app/etl/fetch.ts
verified_against: b5b247a6cb390ba505c674f0c77af551dd547949
---

# Data sources

`app/etl/sources.ts` is the source enumeration Principle II demands be data rather than
folklore. Redistributability is an entry condition, not a preference: every source is a public
government dataset a self-hoster may fetch and republish, and nothing is licensed per seat,
per query, or per instance.

## How it works

**Summit County GIS** (`scgis.summitoh.net`) provides three layers. `ADDRESS_POINTS`
(`summit_address_points`) is the county addressing authority's list of addressable locations,
maintained separately from the tax roll and feeding 911 dispatch — a typed address resolves
against this layer and not against parcel situs labels. `PARCELS` (`summit_tax_parcels`) is
the geometry both sides of the measurement are made of. `MUNICIPALITIES`
(`summit_jurisdictions`) supplies jurisdiction boundaries, used to derive
`parcels.municipality` and, later, to stack municipal ordinances.

**NCES EDGE** provides two federal school files, public domain and freely redistributable.
`SCHOOLS_PUBLIC_NCES` (2024-25) covers district-operated, community/charter, and STEM schools;
`SCHOOLS_PRIVATE_NCES` (2023-24, the Private School Universe Survey) is where Ohio's chartered
nonpublic schools appear. Both locate a school only by a geocode of its reported mailing
address, so a point can fall in a road right-of-way or on a neighbouring parcel. The private
file stores a 3-digit county code where the public file stores 5-digit state+county — getting
that wrong returns zero rows silently.

Two school layers are **derived from the parcel layer**, not fetched. `SCHOOLS_BOARD_PARCELS`
takes use code 650 (exempt — board of education): surveyed geometry, county-authoritative
ownership, no geocoding step, and the only source reaching ORC 2925.01(S)(b), which extends
school premises to other board-owned parcels. It is over-inclusive by design — bus garages
and vacant board land are flagged too, which Principle I calls recoverable.

`SCHOOLS_NAMED_EXEMPT_PARCELS` was added after the third source proved the second one misses
schools. St. Vincent-St. Mary High School, one of Akron's largest chartered nonpublic schools,
appears nowhere in the federal survey under any spelling, while the county tax roll holds its
131-acre campus. So exempt parcels whose owner of record reads like a school
(`SCHOOL_OWNER_PATTERN`, whole words only so PRESCHOOL and SCHOOLCRAFT do not match) are
ingested as premises, recovering Western Reserve Academy, Cuyahoga Valley Christian Academy,
Lawrence School and others. It is a name heuristic and is stated as one — and it deliberately
does **not** recover St. Vincent-St. Mary itself, whose parcel is held by "SVSM FOUNDATION
PROPERTIES LLC", because tuning a pattern to the one example you happened to check is how a
gap gets hidden instead of closed. That school stays in the ledger by name.

The three school sources are chosen so their weaknesses do not coincide: the federal files
name schools but locate them by geocode; the parcel-derived layers have surveyed geometry and
county-authoritative ownership but no school directory. The private-school leg is the weakest
and has no parcel-side backstop, which is stated in the ledger rather than smoothed over.

`declaredNonUniqueKeys` is the whole exemption mechanism for key assertions — one greppable
line per column, per layer. Deleting an entry turns the audit back into a hard failure, which
is how the assertion is shown to be live rather than decorative.

## Connections

- [[coverage-gap-ledger]] holds `DECLARED_GAPS`, defined in this same file.
- [[ingest-pipeline]] fetches and loads these; [[ingest-assertions]] police the load.
- [[proximity-measurement]] consumes the school geometry; [[address-resolution]] the address
  points.
- [[constitution-and-principles]] Principle VII is why redistributability gates entry.

## Operational notes

Other constants live here too: `BOARD_OF_EDUCATION_USECD` (650), `EXEMPT_USECD_PATTERN`
(`^6[0-9][0-9]$`), and `MINERAL_RIGHTS_USECD_PATTERN` (`^2[0-9][0-9]$`) — the 200-series
subsurface polygons excluded from measurement geometry entirely. Queries page at 1,000–2,000
features ordered by OBJECTID.
