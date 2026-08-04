-- School premises: public, nonpublic, and chartered nonpublic (Phase 2
-- enumerates sources). A school known only as a point gets NO geometry and
-- NO assumed radius here -- DECISION §3 forbids approximating a school
-- premises from a point at any radius, because a campus-sized parcel's
-- extent (p95 1,575 m) can exceed the entire 304.8 m buffer. A school
-- without real parcel geometry is written to coverage_gaps (Phase 2)
-- instead, and stays NULL here.

CREATE TABLE school_premises (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name         text NOT NULL,
    school_type  text NOT NULL,  -- 'public' | 'nonpublic' | 'chartered_nonpublic'
    parcel_id    bigint REFERENCES parcels (id),
    geom         geometry(MultiPolygon, 6549),  -- NULL until real parcel geometry is attached
    layer_id     text NOT NULL REFERENCES layers (id)
);

CREATE INDEX school_premises_geom_idx ON school_premises USING gist (geom);

COMMENT ON COLUMN school_premises.geom IS
    'NULL means: no defensible radius exists for this school (DECISION '
    '§3). It is a declared coverage gap, not a value to estimate -- see '
    'coverage_gaps and Phase 2''s verification that every NULL here has a '
    'matching gap row.';
