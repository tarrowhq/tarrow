---
id: TASK-0001
title: 'Spike: choose a geocoding and distance stack that does not leak user addresses'
status: To Do
assignee: []
created_date: '2026-08-04 15:58'
labels:
  - 'area:geo'
  - 'kind:spike'
  - 'x:privacy'
milestone: m-0
dependencies: []
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decide how somap turns a typed address into coordinates, and how it measures distance, WITHOUT sending the user's searched address to a third party.

This is the first real collision between the product and Constitution Principle III, and it is likely the highest-risk unknown in the project. A commercial geocoder (Google, Mapbox) is the easy path and is disqualifying on its face: the searched address is exactly the future-intent datum the constitution says must never leave the user's control, and handing it to an ad company is worse than logging it ourselves.

Evaluate self-hosted options (Nominatim, Pelias, libpostal plus a local address dataset) against coverage quality for Summit County, operational cost, and update cadence. Address coverage quality is a safety concern, not just a UX one: a geocoder that silently resolves an unknown address to a ZIP centroid produces a confidently wrong distance, which is the under-restriction failure of Principle I.

Ships a decision document. The application is untouched, so this satisfies the deployability rule trivially.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Candidate geocoders evaluated against Summit County addresses with a documented accuracy sample
- [ ] #2 Chosen stack sends no user-entered address to any third party, and this is demonstrable
- [ ] #3 Failure behavior specified: an address that cannot be confidently geocoded returns an explicit could-not-locate, never a low-confidence coordinate
- [ ] #4 Distance measurement method documented, including what geometry is used when parcel boundaries are unavailable
- [ ] #5 Decision and rationale committed to the repo
<!-- AC:END -->
