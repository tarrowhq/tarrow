// Every layer this pipeline ingests, its provenance, and -- the part that
// matters most -- what each source is known NOT to cover.
//
// This file is the source enumeration Constitution Principle II demands be
// data rather than folklore. `DECLARED_GAPS` below is written into
// coverage_gaps on every reload, in the shape the coverage manifest renders,
// so that a limitation somebody knew about at ingest time cannot decay into
// a limitation nobody remembers. A gap recorded here is honest; a gap living
// only in a commit message is the thing Principle I calls unrecoverable.
//
// Redistributability (Principle VII) is a precondition for entry, not a
// nice-to-have: every source below is a public government dataset that a
// self-hoster may fetch and republish. Nothing here is licensed per seat,
// per query, or per instance.

import type { LayerQuery } from "./fetch.ts";

export interface LayerSource {
  /** Primary key in the `layers` registry, and the NDJSON basename. */
  readonly id: string;
  readonly description: string;
  readonly sourceUrl: string;
  readonly jurisdiction: string;
  readonly query: LayerQuery;
  readonly notes: string;
  /**
   * Columns whose values this pipeline knows are NOT unique in the source.
   * The loader asserts uniqueness on every key it writes; a column listed
   * here is exempted from the abort, audited instead, and its duplicate and
   * empty counts are written to the gap ledger.
   *
   * This list is the whole exemption mechanism, and it is deliberately one
   * greppable line per column: deleting an entry turns the audit back into a
   * hard failure, which is how the assertion is proved live rather than
   * decorative.
   */
  readonly declaredNonUniqueKeys?: readonly string[];
}

const SUMMIT_GIS = "https://scgis.summitoh.net/hosted/rest/services";
const NCES_EDGE = "https://nces.ed.gov/opengis/rest/services/K12_School_Locations";

export const ADDRESS_POINTS: LayerSource = {
  id: "summit_address_points",
  description:
    "Summit County Address Points -- the county addressing authority's list of " +
    "addressable locations, maintained separately from the tax roll and feeding " +
    "911 dispatch. A typed address resolves against this layer.",
  sourceUrl: `${SUMMIT_GIS}/AddressPoints_DBC/FeatureServer/0`,
  jurisdiction: "Summit County, OH",
  query: {
    url: `${SUMMIT_GIS}/AddressPoints_DBC/FeatureServer/0`,
    where: "1=1",
    outFields:
      "ADDR_ID,ADDR_NUM,PRE_DIR,PRE_TYPE,STR_NAME,STR_TYPE,SUF_DIR," +
      "UNIT_TYPE,UNIT_NUM,CITY,ZIP,LSN",
    orderByFields: "OBJECTID",
    pageSize: 2000,
  },
  notes:
    "Coverage is uneven across municipalities -- Cuyahoga " +
    "Falls showing 3,224 points for a city of ~50,000.",
  // DECISION §7: 30,426 duplicate and 26,660 empty ADDR_ID values exist in
  // the source. Nothing in tarrow keys on ADDR_ID -- address_points has a
  // surrogate identity primary key and Phase 3 resolves on `normalized` --
  // so the rows are preserved rather than collapsed, and the duplication is
  // audited into the gap ledger on every load.
  declaredNonUniqueKeys: ["addr_id"],
};

export const PARCELS: LayerSource = {
  id: "summit_tax_parcels",
  description:
    "Summit County tax parcels. The unit of ownership and taxation, and the " +
    "geometry both sides of the distance measurement are made of: nearest " +
    "boundary to nearest boundary, never centroid to centroid.",
  sourceUrl: `${SUMMIT_GIS}/parcels_web_GEODATA_Tax_Parcels/FeatureServer/0`,
  jurisdiction: "Summit County, OH",
  query: {
    url: `${SUMMIT_GIS}/parcels_web_GEODATA_Tax_Parcels/FeatureServer/0`,
    where: "1=1",
    outFields: "parcelid,siteaddress,usecd,ownernme1",
    orderByFields: "OBJECTID",
    pageSize: 2000,
  },
  notes:
    "usecd 200-series parcels are mineral rights -- overlapping subsurface " +
    "polygons, excluded from measurement geometry. siteaddress " +
    "carries no city and is not unique county-wide; municipality is derived by " +
    "spatial join instead.",
  // Measured 2026-08-04 over all 261,160 published parcels: parcelid has no
  // duplicates, but one parcel carries no identifier at all (and no use code,
  // no owner, a blank address -- just a polygon). Keeping that polygon matters
  // more than tidying the label, so parcel_id is declared a non-key here and
  // made nullable in sql/schema/009_parcel_id_optional.sql. The primary key is
  // a surrogate identity column; nothing keys on parcelid.
  declaredNonUniqueKeys: ["parcel_id"],
};

export const MUNICIPALITIES: LayerSource = {
  id: "summit_jurisdictions",
  description:
    "Summit County jurisdiction boundaries (cities, villages, townships), " +
    "published by the county fiscal office.",
  sourceUrl: `${SUMMIT_GIS}/fiscal/Jurisdictions/MapServer/122`,
  jurisdiction: "Summit County, OH",
  query: {
    url: `${SUMMIT_GIS}/fiscal/Jurisdictions/MapServer/122`,
    where: "1=1",
    outFields: "NAME,TYPE,FIPS_PLACE_CODE",
    orderByFields: "OBJECTID",
    pageSize: 1000,
  },
  notes:
    "Used to derive which municipality a parcel sits in.",
};

// ---------------------------------------------------------------------------
// School premises sources
// ---------------------------------------------------------------------------
//
// ORC 2950.034 bars residence within 1,000 feet of "school premises", which
// ORC 2925.01(S) defines as the PARCEL a school sits on -- plus, in (S)(b),
// any other parcel owned or leased by the board on which school functions
// are conducted. ORC 2925.01(R) defines "school" as a school operated by a
// board of education, a community school (Chapter 3314), a STEM school
// (Chapter 3326), or a nonpublic school for which the state board prescribes
// minimum standards -- Ohio's chartered nonpublic schools.
//
// Three sources are ingested, chosen so their weaknesses do not coincide:
//
//   SCHOOLS_PUBLIC_NCES    names every public school (district-operated,
//                          community/charter, and STEM schools are all
//                          "public" in the federal CCD universe) but locates
//                          each only by a geocoded mailing address.
//
//   SCHOOLS_BOARD_PARCELS  the county's own tax roll: every parcel whose use
//                          code is 650, "exempt -- board of education".
//                          Surveyed geometry, county-authoritative ownership,
//                          no geocoding step at all. This is the only source
//                          that reaches ORC 2925.01(S)(b), and it backstops
//                          any public school the federal file mis-geocodes.
//
//   SCHOOLS_PRIVATE_NCES   nonpublic schools, including Ohio's chartered
//                          nonpublic schools. Point geocodes, and -- see
//                          DECLARED_GAPS -- a voluntary survey with real
//                          nonresponse. This is the weakest leg and it has no
//                          parcel-side backstop; that is stated in the ledger
//                          rather than smoothed over.

export const SCHOOLS_PUBLIC_NCES: LayerSource = {
  id: "nces_public_schools_2425",
  description:
    "NCES EDGE geocoded public school locations, 2024-25, filtered to Summit " +
    "County (FIPS 39153). Covers district-operated, community (charter), and " +
    "STEM schools -- all public in the federal Common Core of Data universe.",
  sourceUrl: `${NCES_EDGE}/EDGE_GEOCODE_PUBLICSCH_2425/MapServer/0`,
  jurisdiction: "Summit County, OH",
  query: {
    url: `${NCES_EDGE}/EDGE_GEOCODE_PUBLICSCH_2425/MapServer/0`,
    where: "CNTY = '39153'",
    outFields: "NCESSCH,LEAID,NAME,STREET,CITY,STATE,ZIP,SCHOOLYEAR",
    orderByFields: "OBJECTID",
    pageSize: 2000,
  },
  notes:
    "Federal, public domain, freely redistributable (Principle VII). Locations " +
    "are geocoded from the reported mailing address, so a point can fall in a " +
    "road right-of-way or on a neighbouring parcel.",
};

export const SCHOOLS_PRIVATE_NCES: LayerSource = {
  id: "nces_private_schools_2324",
  description:
    "NCES EDGE geocoded private school locations, 2023-24 (Private School " +
    "Universe Survey), filtered to Summit County (state FIPS 39, county 153). " +
    "This is where Ohio's chartered nonpublic schools appear.",
  sourceUrl: `${NCES_EDGE}/EDGE_GEOCODE_PRIVATESCH_2324/MapServer/0`,
  jurisdiction: "Summit County, OH",
  query: {
    url: `${NCES_EDGE}/EDGE_GEOCODE_PRIVATESCH_2324/MapServer/0`,
    // The private file stores a 3-digit county code, unlike the public file's
    // 5-digit state+county. Getting this wrong returns zero rows silently.
    where: "STFIP = '39' AND CNTY = '153'",
    outFields: "PPIN,NAME,STREET,CITY,STATE,ZIP,SCHOOLYEAR",
    orderByFields: "OBJECTID",
    pageSize: 2000,
  },
  notes:
    "PSS is a biennial voluntary survey. Nonresponding schools are absent, and " +
    "the file does not distinguish Ohio-chartered from non-chartered nonpublic " +
    "schools -- both are ingested, which over-includes rather than under-includes.",
};

/**
 * Board-of-education parcels are not fetched as their own service: they are
 * a filter over the parcel layer already ingested. Recorded as a layer so
 * the manifest can name it, and so its freshness is the parcel layer's.
 */
export const SCHOOLS_BOARD_PARCELS = {
  id: "summit_board_of_education_parcels",
  description:
    "Summit County tax parcels with use code 650 (exempt -- board of " +
    "education). Surveyed parcel geometry with county-authoritative ownership, " +
    "and the only source reaching ORC 2925.01(S)(b): parcels owned by a board " +
    "beyond the school building itself.",
  sourceUrl: `${SUMMIT_GIS}/parcels_web_GEODATA_Tax_Parcels/FeatureServer/0`,
  jurisdiction: "Summit County, OH",
  notes:
    "Derived from the parcel layer, not fetched separately. Over-inclusive by " +
    "design: board-owned parcels where no school function occurs (vacant land, " +
    "bus garages) are flagged too. Principle I calls that recoverable; the " +
    "opposite error is not.",
} as const;

/**
 * A fourth school source, added after the third one proved the second one
 * misses schools.
 *
 * St. Vincent-St. Mary High School, one of Akron's largest and best-known
 * chartered nonpublic schools, does not appear in the federal Private School
 * Universe Survey at all -- not in the 2023-24 wave, not under any spelling.
 * The county tax roll has its campus (15 N Maple St, use code 670, 131
 * acres). That is a survey nonresponse producing a missing school, which
 * Principle I classifies as the unrecoverable error, and it is not
 * hypothetical: it was found by spot-checking this very ingest.
 *
 * So: exempt parcels whose OWNER READS LIKE A SCHOOL are ingested as
 * premises. County-authoritative ownership, surveyed geometry, no geocoding
 * step, and it recovers schools the federal survey never had -- Western
 * Reserve Academy, Cuyahoga Valley Christian Academy, Lawrence School,
 * Summit Academy's buildings, and others.
 *
 * It is a name heuristic and it is stated as one. It does NOT recover
 * St. Vincent-St. Mary itself, whose parcel is held by "SVSM FOUNDATION
 * PROPERTIES LLC" -- a name no pattern should be tuned to match, because
 * tuning a pattern to the one example you happened to check is how a gap
 * gets hidden instead of closed. That school stays in the gap ledger by
 * name, and closing it properly needs Ohio's own chartered nonpublic
 * directory as an authored source.
 */
export const SCHOOLS_NAMED_EXEMPT_PARCELS = {
  id: "summit_named_school_parcels",
  description:
    "Summit County tax parcels that are tax-exempt and whose owner of record " +
    "reads like a school -- the county's own record of nonpublic and community " +
    "school property, independent of any survey response.",
  sourceUrl: `${SUMMIT_GIS}/parcels_web_GEODATA_Tax_Parcels/FeatureServer/0`,
  jurisdiction: "Summit County, OH",
  notes:
    "Owner-name heuristic over exempt parcels. Deliberately not tuned to any " +
    "individual school. School type is recorded as unclassified: the tax roll " +
    "does not say whether the owner runs a nonpublic school or a community school.",
} as const;

/** Owner-of-record words that make a parcel a school premises candidate.
 *  Whole words only, so PRESCHOOL and SCHOOLCRAFT do not match. */
export const SCHOOL_OWNER_PATTERN =
  "(^|[^A-Z])(SCHOOL|SCHOOLS|ACADEMY|ACADEMIES|MONTESSORI|PREPARATORY)([^A-Z]|$)";

/** The parcel tax use code meaning "exempt -- board of education". */
export const BOARD_OF_EDUCATION_USECD = "650";

/** Tax use codes for exempt property. A school premises is essentially always
 *  exempt, so an exempt parcel corroborates a school point match and a
 *  non-exempt one does not. */
export const EXEMPT_USECD_PATTERN = "^6[0-9][0-9]$";

/** Mineral-rights parcels: usecd 200-series (DECISION §6). Overlapping
 *  subsurface polygons that must never enter measurement geometry. */
export const MINERAL_RIGHTS_USECD_PATTERN = "^2[0-9][0-9]$";

export const FETCHED_LAYERS: readonly LayerSource[] = [
  ADDRESS_POINTS,
  PARCELS,
  MUNICIPALITIES,
  SCHOOLS_PUBLIC_NCES,
  SCHOOLS_PRIVATE_NCES,
];

// ---------------------------------------------------------------------------
// Declared gaps
// ---------------------------------------------------------------------------

export interface DeclaredGap {
  readonly layerId: string | null;
  readonly subjectType: string;
  readonly subjectRef: string | null;
  /**
   * Two or three words, for the person looking up an address.
   *
   * This is what reaches the answer surface. The reader is frightened, often
   * on a deadline, sometimes on a library machine, and they will read a phrase
   * where they will not read a paragraph. "Preschools and day-care" is the
   * whole of what they need to know is missing.
   *
   * NOT a summary of `description`, and never a sentence. If a label needs a
   * clause to make sense, the gap has not been understood well enough to
   * state.
   */
  readonly label: string;
  /**
   * The full record: why the gap exists, what it means for an answer, what a
   * self-hoster should know. Read by /faq and by anyone auditing the instance.
   * Never rendered on the answer surface.
   *
   * NO ISSUE NUMBERS, NO INTERNAL TASK IDS, NO "NOT YET BUILT". This text is
   * shipped to a member of the public who has no idea what our tracker is and
   * should not be made to care. State what tarrow does not check, not what we
   * plan to do about it: a gap is a fact about this instance's coverage, and
   * it stays true whether or not anybody ever files a ticket.
   */
  readonly description: string;
}

/**
 * Gaps known at authoring time, written to `coverage_gaps` on every reload.
 * Per-row gaps discovered during a load (a school with no parcel, a dropped
 * geometry) are appended by the loader; these are the ones no run will
 * discover on its own because they are absences in the sources themselves.
 */
export const DECLARED_GAPS: readonly DeclaredGap[] = [
  // The gap in OUR OWN work, declared in the same ledger and the same shape as
  // the gaps in the county's data. Principle II applied to tarrow rather than
  // only to its sources.
  //
  // The manifest builder REQUIRES this row: server/manifest.ts refuses to
  // produce a manifest when no `rule_content` gap is present, so deleting it
  // fails every search loudly instead of quietly removing a disclosure. That
  // is what keeps the honesty a gate rather than a habit.
  {
    layerId: null,
    subjectType: "rule_content",
    subjectRef: "orc_2950_034_buffer_unverified",
    label: "The rule itself",
    description:
      "The 1,000-foot (304.8 m) buffer this release applies is NOT verified rule " +
      "data. Every rule should carry, as data, its citation, a resolvable source " +
      "URL, its effective date, the date a person last verified it, and who " +
      "verified it. No such record exists here. The buffer is applied from a " +
      "reading of ORC 2950.034 that no person has signed off inside tarrow, and the " +
      "measurement method (nearest parcel boundary to nearest parcel boundary) is " +
      "tarrow's own over-restrictive reading of a statute that does not say how the " +
      "1,000 feet is measured. Neither has been checked against Ohio case law. " +
      "Treat every distance here as a reason to call the registering sheriff's " +
      "office, never as a legal conclusion.",
  },
  {
    layerId: SCHOOLS_PRIVATE_NCES.id,
    subjectType: "school_premises",
    subjectRef: "known_missing:st_vincent_st_mary_high_school",
    label: "One known missing school",
    description:
      "St. Vincent-St. Mary High School, 15 N Maple St, Akron, is absent from " +
      "the federal survey this release draws nonpublic schools from, and its " +
      "county parcel is held under a name no source identifies as a school. It " +
      "is therefore NOT checked: an address near it will not be flagged for it. " +
      "This is a confirmed miss, found by spot-checking, and it is evidence that " +
      "other nonpublic schools are missing too.",
  },
  {
    layerId: SCHOOLS_NAMED_EXEMPT_PARCELS.id,
    subjectType: "source_coverage",
    subjectRef: "owner_name_heuristic",
    label: "Schools held under another name",
    description:
      "Some school premises are found by reading the tax roll's owner-of-record " +
      "for school words. A school whose property is held by a foundation, a " +
      "diocese, or a holding company named after neither the school nor its " +
      "purpose is not found this way.",
  },
  {
    layerId: SCHOOLS_PRIVATE_NCES.id,
    subjectType: "source_coverage",
    subjectRef: "chartered_nonpublic_authoritative_list",
    label: "Some private schools",
    description:
      "Nonpublic schools come from the federal Private School Universe Survey, " +
      "a biennial voluntary survey. Ohio's authoritative list -- the Department " +
      "of Education and Workforce chartered nonpublic school directory -- is " +
      "published only as spreadsheets and has not been cross-referenced. A " +
      "chartered nonpublic school that did not respond to the federal survey is " +
      "absent from this release.",
  },
  {
    layerId: SCHOOLS_PRIVATE_NCES.id,
    subjectType: "source_coverage",
    subjectRef: "chartering_status_not_distinguished",
    label: "Private school charter status",
    description:
      "The nonpublic source does not record whether a school is chartered by " +
      "the Ohio state board, so tarrow cannot distinguish schools that meet ORC " +
      "2925.01(R) from those that do not. Both are treated as school premises, " +
      "which over-includes rather than under-includes.",
  },
  {
    layerId: SCHOOLS_PUBLIC_NCES.id,
    subjectType: "source_coverage",
    subjectRef: "snapshot_year",
    label: "Schools that recently moved or opened",
    description:
      "Public school locations are the 2024-25 federal snapshot and nonpublic " +
      "locations the 2023-24 snapshot. A school that opened, moved, or changed " +
      "premises since is not reflected.",
  },
  {
    layerId: SCHOOLS_BOARD_PARCELS.id,
    subjectType: "source_coverage",
    subjectRef: "orc_2925_01_S_b_nonpublic",
    label: "Some school-owned land",
    description:
      "ORC 2925.01(S)(b) extends school premises to other parcels owned or " +
      "leased by the school on which school functions occur -- athletic fields, " +
      "administrative buildings, leased annexes. County use code 650 reaches " +
      "these for public school districts only. The equivalent parcels of " +
      "nonpublic schools, and any parcel a school LEASES rather than owns, are " +
      "not enumerated by any source tarrow has.",
  },
  {
    layerId: null,
    subjectType: "facility_class",
    subjectRef: "orc_2950_034_non_school_classes",
    label: "Preschools and day-care",
    description:
      "ORC 2950.034 protects preschools, licensed child day-care centres, " +
      "children's crisis care facilities, and residential infant care " +
      "facilities in addition to schools. This release loads school premises " +
      "only. Those classes are not checked at all.",
  },
  {
    layerId: null,
    subjectType: "jurisdiction",
    subjectRef: "municipal_ordinances",
    label: "City and village rules",
    description:
      "Only the state buffer is applied. Summit County municipalities impose " +
      "their own residency ordinances, none of which are loaded here. " +
      "An address outside every buffer here may still be barred by a local " +
      "ordinance.",
  },
  {
    layerId: null,
    subjectType: "jurisdiction",
    subjectRef: "outside_summit_county",
    label: "Anywhere outside Summit County",
    description:
      "Coverage is Summit County, Ohio only. No parcel, address, or school " +
      "data is loaded for any other county, and an address outside the county " +
      "cannot be answered at all.",
  },
  {
    layerId: ADDRESS_POINTS.id,
    subjectType: "source_coverage",
    subjectRef: "uneven_municipal_coverage",
    label: "Some newer addresses",
    description:
      "Address point coverage is uneven across municipalities -- Cuyahoga " +
      "Falls carries 3,224 points for a city of roughly 50,000. An address the " +
      "county has not published a point for cannot be " +
      "resolved and is declined rather than approximated.",
  },
];
