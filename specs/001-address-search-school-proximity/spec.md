# Feature Specification: Address search returns school proximity with a coverage manifest

**Feature Branch**: `task-0002-walking-skeleton`

**Created**: 2026-08-04

**Status**: Draft

**Board task**: TASK-0002 (subtasks .01–.04 are internal breakdown; they ride this branch)

**Runbook**: `docs/design/task-0002-walking-skeleton-runbook.md`

**Input**: TASK-0002 — "The walking skeleton, shipped end to end: a user enters an address
and sees which school premises fall within the state buffer, alongside an explicit
statement of what was and was not checked."

---

## User Scenarios & Testing *(mandatory)*

The user is a person on a sex offender registry looking for housing in Summit County,
Ohio. They are trying to answer one question — *"Am I allowed to live here?"* — and today
the only way to get an answer is to call a sheriff's office about one address at a time.

Two things about this user shape every scenario below, and both come from Principle III:
they are **paranoid for good reason**, and they need to *know* their data is private
rather than be *told* it is. A scenario that works only with JavaScript enabled, or that
sends the searched address anywhere, has failed them regardless of what it renders.

### User Story 1 — Get a proximity answer for an address (Priority: P1)

The user types an address in Summit County. They get back which school premises fall
within the 1,000-foot state buffer of that address, measured parcel boundary to parcel
boundary, together with a statement of exactly what was checked and what was not.

**Why this priority**: This is the product. Everything else in this feature exists to make
this answer honest.

**Independent Test**: Enter a known address near a known school and observe the flag and
the manifest; enter a known address far from every school and observe the
outside-every-buffer statement and the same manifest.

**Acceptance Scenarios**:

1. **Given** a Summit County address that resolves to an address point with a parcel,
   **When** the user submits it, **Then** the system returns every school premises whose
   parcel is within 304.8 m of the residence parcel, each with the measured distance and
   the basis of that measurement.
2. **Given** a Summit County address with no school premises within 304.8 m, **When** the
   user submits it, **Then** the system states that the address is **outside every buffer
   we checked** — and never that it is approved, legal, permitted, or clear.
3. **Given** any result whatsoever, **When** it is rendered, **Then** it carries the
   coverage manifest and the guidance to confirm with the registering sheriff's office.

---

### User Story 2 — Know what was not checked (Priority: P1)

Every answer states which rule sources are loaded, which point-of-interest layers were
queried, which are absent, and when each was last verified.

**Why this priority**: Equal to P1 above, and not separable from it. Principle II:
absence of a flag is meaningful only against a stated list of what was searched. This
release loads **schools only** out of the several protected classes ORC 2950.034 names —
which is safe to ship *precisely because the manifest says so*, and unsafe to ship
otherwise.

**Independent Test**: Read any result and enumerate the absent layers from the rendered
page alone, without reading code or documentation.

**Acceptance Scenarios**:

1. **Given** a result with no flags, **When** the user reads it, **Then** the layers this
   release does **not** load — licensed child care, preschools, children's crisis care,
   residential infant care, and every municipal ordinance — are named on the page as
   absent, not merely omitted.
2. **Given** a school premises the county publishes without parcel geometry, **When** a
   query runs, **Then** that school is reported as a **coverage gap** in the manifest and
   is never approximated by a radius around a point.
3. **Given** any loaded layer, **When** it appears in the manifest, **Then** it carries
   the date its data was last refreshed.

---

### User Story 3 — Be told plainly when we cannot answer (Priority: P1)

An address the system cannot confidently resolve produces an explicit could-not-locate
that no user could mistake for a clean result.

**Why this priority**: This is Principle I's whole thesis in one interaction. A
low-confidence coordinate rendered as an answer is an under-restriction defect, and
under-restriction is the unrecoverable error.

**Independent Test**: Submit a malformed address, an out-of-county address, and an address
whose resolved point has no parcel. Each must read as *we could not answer*, visually and
textually distinct from *we answered and found nothing*.

**Acceptance Scenarios**:

1. **Given** an address that matches no address point, **When** submitted, **Then** the
   system returns could-not-locate — never a ZIP centroid, a street centroid, a fuzzy
   match, or a nearby-parcel consolation.
2. **Given** an address whose resolved point has no parcel within 5 m, **When** submitted,
   **Then** the system **declines**, because measuring from a bare point overstates
   distance and therefore under-restricts.
3. **Given** an address that normalizes to several parcels (a condominium), **When**
   submitted, **Then** the system declares the ambiguity and resolves to the most
   restrictive candidate or asks — never silently picking one.
4. **Given** any decline or could-not-locate, **When** rendered, **Then** it is
   distinguishable from a located address with no nearby facilities by more than a
   sentence's wording.

---

### User Story 4 — Verify the privacy claim rather than trust it (Priority: P1)

A competent outsider can check, from network traffic and the published composition, that
the searched address goes nowhere and is recorded nowhere.

**Why this priority**: Principle III is non-negotiable, and this is the first build that
could leak anything. Shipping a version that logs addresses and fixing it later is exactly
the retrofit the principle forbids.

**Independent Test**: Load the page with devtools open. Observe every request goes to the
application's own origin. Submit a search. Then read every log stream the composition
produces and find neither the address nor the client IP.

**Acceptance Scenarios**:

1. **Given** a search is submitted, **When** every log stream in the composition is read
   (application, HTTP server, PostgreSQL, container stdout/stderr), **Then** neither the
   searched address nor the client IP appears in any of them.
2. **Given** the page is loaded, **When** the network panel is read, **Then** every
   request targets the application's own origin, and the response carries a
   Content-Security-Policy that makes any other origin unloadable.
3. **Given** a request that errors, **When** the error surfaces in logs or in an error
   report, **Then** it carries no query context.
4. **Given** the client has JavaScript disabled entirely, **When** the user submits an
   address, **Then** they receive the full result including the manifest and the sheriff
   guidance.

---

### Edge Cases

- **A school with no parcel geometry.** Declared a coverage gap. Never approximated — at a
  p95 campus extent of 1,575 m against a 304.8 m buffer, no defensible radius exists
  (DECISION §3).
- **A residence point with no parcel.** Decline. Affects ~2.15% of address points.
- **One normalized address, many parcels.** Up to 505 for a condominium; `2200 HIGH ST`
  appears 218 times. Declare, do not guess.
- **`ADDR_ID` is not unique in the source** (30,426 duplicates, 26,660 empty). Any ingest
  keying on it must assert uniqueness at load and fail rather than silently collapse rows.
- **Mineral-rights parcels** (`usecd` 200-series, 1,128 records) overlap surface parcels
  and must be excluded from measurement geometry.
- **An address outside Summit County.** Out of claimed coverage entirely: decline with the
  reason, per Principle VI — tarrow declines rather than guesses where it has no verified
  rules.
- **The database has never been loaded.** The system must say its data is absent rather
  than return an empty, confident-looking result.
- **A user hits the result page with the browser back button.** No stale answer may render
  without its manifest.

## Requirements *(mandatory)*

### Functional Requirements

**Resolution and measurement**

- **FR-001**: The system MUST resolve a typed address against the county Address Points
  layer, then find that point's parcel geometrically. It MUST NOT match typed addresses
  against `parcel.siteaddress` (3.34% wrong vs 0.20%, DECISION §1).
- **FR-002**: The system MUST measure distance from the nearest point of the residence
  parcel to the nearest point of the protected premises parcel — never centroid to
  centroid, never point to point.
- **FR-003**: All spatial computation MUST occur in EPSG:6549 (NAD83(2011) Ohio North,
  metres). Geography casts MUST NOT be used, as they defeat the spatial index.
- **FR-004**: The buffer MUST be 304.8 m (1,000 feet).
- **FR-005**: Every geometry MUST carry an uncertainty radius, and comparisons MUST use
  the pessimistic bound `d_min = d(a,b) − r_a − r_b`, flagging when `d_min < buffer`.
- **FR-006**: The system MUST decline when a resolved address point has no parcel within
  5 m.
- **FR-007**: The system MUST NOT perform fuzzy address matching, and MUST NOT return a
  coarse fallback coordinate of any kind. There MUST be no code path that can.
- **FR-008**: Where one normalized address maps to several candidate parcels, the system
  MUST declare the ambiguity and resolve to the most restrictive candidate rather than
  silently selecting one.

**Coverage and honesty**

- **FR-009**: Every result MUST carry a machine-readable coverage manifest naming layers
  queried, layers absent, and the verification/refresh date of each.
- **FR-010**: The result type MUST have no field, enum value, or state meaning approved,
  legal, permitted, or clear. An unqualified clearance MUST be structurally inexpressible,
  not merely absent from the current rendering.
- **FR-011**: The manifest MUST state which delivery path answered and the per-geometry
  measurement basis (e.g. "parcel boundary to parcel boundary, exact" vs an assumed
  premises radius).
- **FR-012**: A school premises without parcel geometry MUST be reported as a coverage gap
  and MUST NOT be approximated by an assumed radius.
- **FR-013**: The system MUST render guidance to confirm with the registering sheriff's
  office on every result, including declines.
- **FR-014**: No rendered copy may state or imply permission. This MUST be verified by a
  test over the rendered result strings.
- **FR-015**: The coverage manifest, the outside-every-buffer phrasing, and the sheriff
  guidance MUST be present in the server-rendered document. They MAY be visually collapsed
  but MUST NOT require JavaScript to reveal.

**Data**

- **FR-016**: The system MUST ingest Summit County Address Points and tax parcels, and
  MUST ingest school premises covering public, nonpublic, and chartered nonpublic schools.
- **FR-017**: Ingest MUST exclude mineral-rights parcels (`usecd` 200-series) from
  measurement geometry.
- **FR-018**: Ingest MUST assert `ADDR_ID` uniqueness at load rather than assume it, and
  fail loudly when the assertion breaks.
- **FR-019**: Every ingested record MUST carry provenance (source, fetch date) and every
  known source gap MUST be recorded as data that the manifest can render.
- **FR-020**: Each parcel's municipality MUST be derived by spatial join to municipal
  boundaries, because `siteaddress` is not unique county-wide.
- **FR-021**: Derived tables MUST be rebuilt by truncate-and-full-reload. No incremental
  sync, no reconciliation logic, no upsert path.
- **FR-022**: The application's database role MUST hold no write privilege on derived
  tables, enforced by grant rather than by convention.

**Privacy**

- **FR-023**: No searched address and no client IP may be recorded in any log stream —
  application, HTTP server, PostgreSQL, or container output.
- **FR-024**: The query path MUST make no outbound network call.
- **FR-025**: Every response MUST carry a Content-Security-Policy that permits only the
  application's own origin, making a third-party load structurally impossible at runtime.
- **FR-026**: No third-party origin may load in the client. Enforced by CSP at runtime and
  a scan of built output at build time. Fonts MUST be self-hosted or a system stack.
- **FR-027**: Error handling MUST NOT carry query context into logs or reports.
- **FR-028**: The system MUST publish a procedure by which an outsider verifies FR-023
  through FR-026 from network traffic and the composition alone.

**Packaging**

- **FR-029**: `docker compose up --build` from a clean clone MUST stand up the system and
  serve the full flow. Nothing may be installed on a host.
- **FR-030**: Images MUST be pinned and MUST build on both `linux/amd64` and `linux/arm64`.
- **FR-031**: The system MUST surface the build date of its data and the verification
  dates of its rules, so a stale self-hosted instance cannot hide its age.
- **FR-032**: `spikes/task-0001-geocoding` MUST keep reproducing its published numbers.

### Key Entities

- **Address point** — a unit of addressable location, maintained by the office that
  assigns addresses. The thing a typed address resolves against.
- **Parcel** — a unit of ownership and taxation, carrying surface geometry. The thing
  distance is measured between. Coincides with an address point only for a detached
  single-family home; 26.8% of parcels have no address point and 5.5% have several.
- **Protected premises** — a facility plus the parcel of real property on which it is
  situated. In this release, school premises only.
- **Coverage manifest** — the record of what was checked, what was absent, and when each
  was last verified. Data rendered to the user, never an assumption baked into code.
- **Layer freshness** — per-layer fetch/verification dates, carried into every manifest.
- **Coverage gap** — a known-missing or geometry-less record, recorded as data at ingest
  so the manifest can name it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from typing a Summit County address to a rendered proximity
  answer in a single form submission, with no JavaScript enabled.
- **SC-002**: 100% of rendered results — flagged, unflagged, declined, and errored —
  contain the coverage manifest and the sheriff-confirmation guidance in the server-
  rendered HTML, verified by a test over raw response bodies.
- **SC-003**: 0 occurrences of a searched address or client IP across every log stream the
  composition produces during a full end-to-end run, verified by an automated grep of
  captured output.
- **SC-004**: 0 requests to any origin other than the application's own during a full page
  load and search, and a CSP header present on every response.
- **SC-005**: 0 rendered strings matching the permission vocabulary (approved, legal,
  permitted, clear, allowed, OK to live), verified by a test over result strings.
- **SC-006**: A clean clone reaches a working end-to-end flow with `docker compose up
  --build` and the documented ingest commands, on both amd64 and arm64.
- **SC-007**: Every school premises loaded either carries real parcel geometry or appears
  in the manifest as a coverage gap. No school is represented by an assumed radius.

## Assumptions

- **"Deployed and working end to end" (AC #8) means the container composition**, not a
  public internet deployment. Ruling R3 in the runbook; m-0 states this release is not
  promoted to real users, and publishing would create the edge-logging surface this
  feature must forbid, with no provider chosen. A public deployment is carded separately.
- **Schools are the only protected class in this release.** Every other ORC 2950.034 class
  is absent and says so. This is deliberate narrowing of coverage, never of honesty.
- **The measurement method is settled by DECISION §2** and is not re-derived here.
  TASK-0003 verifies its legal basis against Ohio case law and may tighten it.
- **Rule content is not yet data.** ORC 2950.034's 1,000-foot buffer is applied in this
  release without the file-authored rule records Principle IV requires; TASK-0003 builds
  that pipeline. This release therefore cannot yet show citations and verification dates
  for the *rule* (only for the *layers*), and the manifest must say so rather than imply
  the rule was verified.
- **The precomputed client-side index described in DECISION §5 is out of scope.** This
  release ships the server query path only; the manifest states which path answered so the
  field exists from the start.
- **Users' own devices are trusted.** Browser-local state is permitted; server-side
  storage of user attributes is not.
