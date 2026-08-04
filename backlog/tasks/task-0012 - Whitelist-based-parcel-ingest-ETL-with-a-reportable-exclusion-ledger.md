---
id: TASK-0012
title: Whitelist-based parcel ingest ETL with a reportable exclusion ledger
status: To Do
assignee: []
created_date: '2026-08-04 20:07'
updated_date: '2026-08-04 20:08'
labels:
  - 'x:safety'
  - 'area:etl'
  - 'kind:feature'
milestone: m-0
dependencies: []
priority: high
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the parcel ingest as a reject-by-default ETL: whitelist the categories we
intend to consume, exclude everything else, and make every exclusion counted and
reportable rather than silent.

WHY NOW. TASK-0001 found 1,128 MINERAL RIGHTS parcels in the Summit County tax
parcel layer (usecd '240', classcd 'O'). These are SUBSURFACE rights polygons
overlaying real surface property -- 173 of them alone cover 54,573 acres against
a county of roughly 264,000. One is 920 acres and geometrically "contains" 1,117
addressed homes.

Used unfiltered as measurement geometry, a 920-acre polygon that corresponds to
no real premises sits closer to everything than the real parcels do, and the
resulting boundary-to-boundary distance is wrong in an unpredictable direction.

FILTER ON CODES, NOT ON TEXT. The mineral rights records are spelled like real
addresses -- "2356  MINERAL RIGHTS", "1008  MINERAL RIGHTS" -- with leading
numbers that read as house numbers. A heuristic on the address string misses
them. usecd='240' and siteaddress LIKE '%MINERAL%' select the identical 1,128
rows, so the structured code is both reliable and honest. The junk is shaped
like the signal; do not sniff text.

THE ASYMMETRY -- THIS IS THE SAFETY-CRITICAL PART. The parcel layer feeds two
consumers whose failure modes are OPPOSITE:

  user's residence lookup  -- exclusion => address not locatable => decline.
                              SAFE. An honest failure.
  protected premises geom  -- exclusion => buffer silently missing => a false
                              "outside every buffer". UNRECOVERABLE (Principle I).

A single blanket whitelist over the layer is therefore a machine for producing
exactly the error the constitution forbids. Drop one school parcel because its
use code was not on the list and somap confidently clears an address 400 feet
from a school.

Split into TWO filters asking different questions:

  1. IS THIS A REAL SURFACE PROPERTY POLYGON? A geometry-validity question,
     orthogonal to facility class. Mineral rights (Ohio DTE 200-series) fail it
     and can never be a school, so excluding them is safe for BOTH consumers.
     This filter is the aggressive whitelist.

  2. WHAT IS THIS SURFACE PARCEL FOR? Residence vs protected premises. Must be
     conservative in OPPOSITE directions per consumer: restrictive about what
     counts as a residence, INCLUSIVE about what might be a protected facility.

Filter 1 is where the whitelist instinct belongs. Filter 2 is where it inverts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Ingest is reject-by-default: a whitelist names the categories consumed, everything else is excluded
- [ ] #2 Surface-property filter is separate from purpose filter, and each is applied per consumer with its own safety direction documented
- [ ] #3 Mineral rights (usecd 200-series) excluded from measurement geometry, verified against the 1,128 known Summit County records
- [ ] #4 Filtering is by structured code, never by pattern-matching the address string
- [ ] #5 Every excluded record is counted by reason and retained as a queryable exclusion ledger, not a log line
- [ ] #6 An unrecognized category fails the build as a review event rather than being silently dropped
- [ ] #7 Exclusion counts are exposed as data the coverage manifest can render (Principle II)
- [ ] #8 No protected-facility parcel can be removed by the whitelist without surfacing as an explicit coverage gap
<!-- AC:END -->
