---
id: TASK-0023
title: Rebuild the survey-plat view (direction D) on a self-hosted map engine
status: To Do
assignee: []
created_date: '2026-08-07 19:54'
labels:
  - 'x:safety'
dependencies: []
priority: medium
ordinal: 39000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Round 2 of TASK-0022 produced direction D, The Survey: the geometric question answered geometrically. The address is a parcel, the buffer is a ring, school premises are hatched parcels, and distances are annotated dimension lines. Zero body copy on the result screen -- prose is drawing labels plus numbered margin notes. The operator's judgement on it: preserve this design, build it later, and build it on an actual mapping system rather than the demo's hand-drawn SVG.

Preserved artifact: docs/design/round2/d-survey.html. Decision record: docs/decisions/task-0022-direction-e-one-card.md.

THE ENGINE IS MAPLIBRE, NOT MAPBOX, AND THE REASON IS THE PRODUCT'S CENTRAL CONSTRAINT.

Mapbox GL JS fetches its bundle, style JSON, glyphs, and every tile from api.mapbox.com with an access token. A tile request's path IS the coordinate being viewed -- which here is the address somebody on a registry just typed. Using it would hand Mapbox the reader's IP address, the referring page, and the location they asked about, on every answer, without a script the reader could inspect and without consent. That is the exact record FR-026 and Principle III exist to prevent, and it is worse than the webfont hazard styles.css is written against because the leaked value is the query itself. scan-external-origins.mjs would fail the image build and the CSP would refuse the requests at runtime.

The available real map engine: MapLibre GL JS (open MIT fork of Mapbox GL JS), vendored and served from tarrow's own origin, reading vector tiles from a self-hosted PMTiles archive built at ingest from geometry tarrow already holds -- county parcels and school premises -- plus an OpenStreetMap-derived basemap extract served by tarrow's own server. Real projection, real vector tiles, pan and zoom, and every byte from tarrow's origin. No token, no third party, nothing that leaves.

Two properties of the demo that must survive the rebuild: it fetched nothing at request time because the geometry was already in Postgres, and it stated no verdict -- the drawing shows what was measured and says nothing about permission. A map that renders a green area, a clear zone, or anything a reader could read as 'you may live here' is a Principle I violation drawn instead of written.

Depends on TASK-0022 landing the E surface first: D is an additional view within that system, not a replacement for it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Direction D is implemented as a real map view using MapLibre GL JS vendored and served from tarrow's own origin, with no Mapbox account, token, or api.mapbox.com request anywhere in the build output or at runtime
- [ ] #2 Vector tiles are served from a self-hosted PMTiles archive built at ingest from geometry tarrow already holds, plus a basemap extract served by tarrow's own server
- [ ] #3 The map view adds no request to any third-party origin: scan-external-origins passes, the CSP is unrelaxed, and the browser suite's off-origin assertion covers the map view
- [ ] #4 The drawing states no verdict -- no zone, no colour, and no label that a reader could take as permission -- and the greyscale distinguishability rule holds on it
- [ ] #5 The map degrades honestly with scripting off: the answer, the coverage manifest, and the sheriff step are complete without it, and what replaces the map is not mistakable for a measurement
- [ ] #6 A premises tarrow holds no boundary for is visibly absent from the drawing rather than drawn as an approximate circle
<!-- AC:END -->
