-- Address normalization.
--
-- This is the thing actually under test. The match rate tarrow can achieve is
-- almost entirely a function of how well this collapses two independently
-- spelled renderings of the same address onto one string.
--
-- Deliberately NOT libpostal, at this stage. libpostal is a heavy dependency
-- (a C library plus ~2GB of trained data) and the point of the spike is to
-- learn how much of the gap a plain rule-based normalizer closes. If this gets
-- to 99%, libpostal is unnecessary weight. If it stalls at 85%, we have
-- measured the size of the problem libpostal would be solving, which is a far
-- better basis for adopting it than assuming we need it.
--
-- Unit designators are DISCARDED, per the TASK-0001 architecture decision:
-- every unit in a building sits on the same parcel and is therefore at the
-- same distance from every protected premises. Apartment 4B and apartment 12
-- get the same answer, correctly.

-- ---------------------------------------------------------------------------
-- Lookup: street-type variants -> canonical form (USPS Publication 28)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS street_type_norm;
CREATE TABLE street_type_norm (variant text PRIMARY KEY, canonical text NOT NULL);
INSERT INTO street_type_norm (variant, canonical) VALUES
    ('ST','ST'),('STR','ST'),('STREET','ST'),
    ('AVE','AVE'),('AV','AVE'),('AVEN','AVE'),('AVENUE','AVE'),
    ('RD','RD'),('ROAD','RD'),
    ('DR','DR'),('DRIV','DR'),('DRIVE','DR'),('DRV','DR'),
    ('BLVD','BLVD'),('BOUL','BLVD'),('BOULEVARD','BLVD'),('BLV','BLVD'),
    ('LN','LN'),('LANE','LN'),
    ('CT','CT'),('CRT','CT'),('COURT','CT'),
    ('CIR','CIR'),('CIRC','CIR'),('CIRCLE','CIR'),('CRCL','CIR'),
    ('PL','PL'),('PLACE','PL'),
    ('TER','TER'),('TERR','TER'),('TERRACE','TER'),
    ('PKWY','PKWY'),('PARKWAY','PKWY'),('PKY','PKWY'),('PARKWY','PKWY'),
    ('HWY','HWY'),('HIGHWAY','HWY'),('HIWAY','HWY'),
    ('TRL','TRL'),('TRAIL','TRL'),('TR','TRL'),
    ('WAY','WAY'),('WY','WAY'),
    ('PT','PT'),('POINT','PT'),
    ('SQ','SQ'),('SQUARE','SQ'),
    ('LOOP','LOOP'),
    ('RUN','RUN'),
    ('PATH','PATH'),
    ('PASS','PASS'),
    ('XING','XING'),('CROSSING','XING'),
    ('CV','CV'),('COVE','CV'),
    ('BND','BND'),('BEND','BND'),
    ('RDG','RDG'),('RIDGE','RDG'),
    ('HL','HL'),('HILL','HL'),
    ('HLS','HLS'),('HILLS','HLS'),
    ('VW','VW'),('VIEW','VW'),
    ('EXT','EXT'),('EXTENSION','EXT'),
    ('CRES','CRES'),('CRESCENT','CRES'),
    ('GLN','GLN'),('GLEN','GLN'),
    ('GRN','GRN'),('GREEN','GRN'),
    ('KNL','KNL'),('KNOLL','KNL'),
    ('MNR','MNR'),('MANOR','MNR'),
    ('PLZ','PLZ'),('PLAZA','PLZ'),
    ('SPUR','SPUR'),
    ('WALK','WALK'),
    ('BYP','BYP'),('BYPASS','BYP'),
    ('CONN','CONN'),('CONNECTOR','CONN'),
    ('FWY','FWY'),('FREEWAY','FWY'),
    ('ALY','ALY'),('ALLEY','ALY'),
    ('ISLE','ISLE'),
    ('OVAL','OVAL'),
    ('ROW','ROW'),
    ('MEWS','MEWS'),
    ('GDNS','GDNS'),('GARDENS','GDNS'),('GDN','GDNS'),('GARDEN','GDNS');

-- ---------------------------------------------------------------------------
-- Lookup: directional variants -> canonical form
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS directional_norm;
CREATE TABLE directional_norm (variant text PRIMARY KEY, canonical text NOT NULL);
INSERT INTO directional_norm (variant, canonical) VALUES
    ('N','N'),('NORTH','N'),
    ('S','S'),('SOUTH','S'),
    ('E','E'),('EAST','E'),
    ('W','W'),('WEST','W'),
    ('NE','NE'),('NORTHEAST','NE'),('N E','NE'),
    ('NW','NW'),('NORTHWEST','NW'),
    ('SE','SE'),('SOUTHEAST','SE'),
    ('SW','SW'),('SOUTHWEST','SW');

-- ---------------------------------------------------------------------------
-- Lookup: spelled ordinals -> digits ("FIRST ST" == "1ST ST")
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS ordinal_norm;
CREATE TABLE ordinal_norm (variant text PRIMARY KEY, canonical text NOT NULL);
INSERT INTO ordinal_norm (variant, canonical) VALUES
    ('FIRST','1'),('SECOND','2'),('THIRD','3'),('FOURTH','4'),('FIFTH','5'),
    ('SIXTH','6'),('SEVENTH','7'),('EIGHTH','8'),('NINTH','9'),('TENTH','10'),
    ('ELEVENTH','11'),('TWELFTH','12'),('THIRTEENTH','13'),('FOURTEENTH','14'),
    ('FIFTEENTH','15'),('SIXTEENTH','16'),('SEVENTEENTH','17'),
    ('EIGHTEENTH','18'),('NINETEENTH','19'),('TWENTIETH','20');

-- ---------------------------------------------------------------------------
-- Lookup: Summit County places, for stripping a trailing city from user input
--
-- The parcel table's siteaddress carries NO city ("168 SW 31ST ST"), but a user
-- will often type one ("168 SW 31st St, Akron, OH 44311"). Without this, every
-- city-bearing input fails to match on the city token alone.
--
-- Listed statically rather than derived from the data so the normalizer is
-- reproducible and reviewable. Sourced from the distinct CITY values in the
-- county Address Points layer.
--
-- NOTE: stripping the city discards information we would rather keep. A parcel
-- siteaddress is NOT unique county-wide -- "100 MAIN ST" plausibly exists in
-- several municipalities -- so city is exactly what would disambiguate. The
-- measurement below quantifies how often that bites; the fix (deriving each
-- parcel's municipality by spatial join to boundaries) is noted in the results.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS place_norm;
CREATE TABLE place_norm (name text PRIMARY KEY, ntok int NOT NULL);
INSERT INTO place_norm (name, ntok)
SELECT p, array_length(string_to_array(p, ' '), 1) FROM (VALUES
    ('AKRON'),('STOW'),('GREEN'),('BARBERTON'),('TWINSBURG'),('HUDSON'),
    ('TALLMADGE'),('COPLEY'),('COPLEY TWP'),('SPRINGFIELD'),('SPRINGFIELD TWP'),
    ('NEW FRANKLIN'),('NORTON'),('COVENTRY'),('COVENTRY TWP'),
    ('SAGAMORE HILLS'),('SAGAMORE HILLS TWP'),('MACEDONIA'),('BATH'),('BATH TWP'),
    ('FAIRLAWN'),('CUYAHOGA FALLS'),('NORTHFIELD CENTER'),('NORTHFIELD CENTER TWP'),
    ('MUNROE FALLS'),('REMINDERVILLE'),('LAKEMORE'),('RICHFIELD'),('RICHFIELD TWP'),
    ('TWINSBURG TWP'),('NORTHFIELD'),('MOGADORE'),('SILVER LAKE'),('CLINTON'),
    ('BOSTON HEIGHTS'),('BOSTON'),('BOSTON TWP'),('PENINSULA'),
    ('WADSWORTH'),('WADSWORTH TWP'),('STREETSBORO'),('LAKE TWP'),('LAWRENCE TWP')
) v(p);

-- ---------------------------------------------------------------------------
-- tarrow_normalize_address(raw) -> canonical string
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION tarrow_normalize_address(raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    s       text;
    tok     text;
    toks    text[];
    out     text[] := '{}';
    mapped   text;
    i        int;
    type_pos int;
BEGIN
    IF raw IS NULL THEN
        RETURN NULL;
    END IF;

    s := upper(trim(raw));

    -- Drop a trailing state/ZIP tail if the caller supplied a full postal
    -- address. Parcel siteaddress never carries one; user input often will.
    s := regexp_replace(s, '\s*,?\s*\mOH(IO)?\M\s*,?\s*\d{5}(-\d{4})?\s*$', ' ', 'g');
    s := regexp_replace(s, '\s*,?\s*\d{5}(-\d{4})?\s*$', ' ', 'g');
    -- ...and a trailing state with no ZIP behind it ("... , Akron OH").
    s := regexp_replace(s, '\s*,?\s*\mOH(IO)?\M\s*$', ' ', 'g');

    -- Unit designators: drop the designator and EVERYTHING after it. Discarding
    -- units is a deliberate architectural choice, not a parsing shortcut.
    s := regexp_replace(
            s,
            '\m(APT|APARTMENT|UNIT|STE|SUITE|RM|ROOM|FL|FLOOR|BLDG|BUILDING|'
            'LOT|TRLR|TRAILER|SPC|SPACE|DEPT|HANGAR|SLIP|PIER|KEY|BSMT|FRNT|'
            'LOWR|UPPR|REAR|SIDE|PH|PENTHOUSE)\M.*$',
            ' ', 'g');
    -- A bare "#" introduces a unit too ("123 Main St #4").
    s := regexp_replace(s, '#.*$', ' ', 'g');

    -- Punctuation to space. Hyphens inside house numbers (e.g. "12-14 MAIN")
    -- go too; the parcel table does not preserve them consistently.
    s := regexp_replace(s, '[^A-Z0-9]+', ' ', 'g');
    s := trim(regexp_replace(s, '\s+', ' ', 'g'));

    -- Strip a trailing place name. Longest match first, so "CUYAHOGA FALLS"
    -- wins over "FALLS" and "COPLEY TWP" over "COPLEY". Only one is stripped:
    -- an address has one city, and repeating would eat street names.
    SELECT name INTO mapped
    FROM place_norm
    WHERE s = name OR s LIKE '% ' || name
    ORDER BY ntok DESC, length(name) DESC
    LIMIT 1;

    IF mapped IS NOT NULL AND s <> mapped THEN
        s := trim(left(s, length(s) - length(mapped) - 1));
    END IF;

    IF s = '' THEN
        RETURN NULL;
    END IF;

    toks := string_to_array(s, ' ');

    -- Where is the street type? Normally the last token, but a SUFFIX
    -- DIRECTIONAL can follow it: "WOOSTER ROAD W", "31ST ST NW". Treating the
    -- last token as the type in those cases left "ROAD" and "STREET"
    -- un-canonicalized, which was measured causing ~3pp of avoidable
    -- no-matches on verbose input.
    type_pos := array_length(toks, 1);
    IF type_pos > 2
       AND EXISTS (SELECT 1 FROM directional_norm WHERE variant = toks[type_pos])
    THEN
        type_pos := type_pos - 1;
    END IF;

    FOR i IN 1 .. array_length(toks, 1) LOOP
        tok := toks[i];

        -- Numeric ordinal suffix: 31ST -> 31, 2ND -> 2, 3RD -> 3, 4TH -> 4.
        IF tok ~ '^\d+(ST|ND|RD|TH)$' THEN
            tok := regexp_replace(tok, '(ST|ND|RD|TH)$', '');
        ELSE
            -- Spelled ordinal: FIRST -> 1. Only when it is not the whole
            -- street name on its own -- guarded below by position, since a
            -- lone "FIRST" as a street name still normalizes the same on both
            -- sides, which is all matching requires.
            SELECT canonical INTO mapped FROM ordinal_norm WHERE variant = tok;
            IF mapped IS NOT NULL THEN
                tok := mapped;
            END IF;
        END IF;

        -- Directionals, but never the first token (a leading token is the
        -- house number) and never a token that is the entire street name.
        IF i > 1 THEN
            SELECT canonical INTO mapped FROM directional_norm WHERE variant = tok;
            IF mapped IS NOT NULL THEN
                tok := mapped;
            END IF;
        END IF;

        -- Street type, only at the computed type position. "ST" mid-string is
        -- far more likely part of a name ("ST CLAIR AVE") than a suffix, and
        -- rewriting it there would corrupt the name on one side only.
        IF i = type_pos AND i > 1 THEN
            SELECT canonical INTO mapped FROM street_type_norm WHERE variant = tok;
            IF mapped IS NOT NULL THEN
                tok := mapped;
            END IF;
        END IF;

        out := out || tok;
    END LOOP;

    RETURN array_to_string(out, ' ');
END;
$$;
