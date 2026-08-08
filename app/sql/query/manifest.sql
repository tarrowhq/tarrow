-- The coverage manifest, read entirely FROM DATA.
--
-- Constitution Principle II: "Every result states what was checked and what was
-- not -- which rule sources are loaded for that jurisdiction, which
-- point-of-interest layers were queried, which are absent, and when each was
-- last verified. Absence of a flag is meaningful only against a stated list of
-- what was searched. Coverage is data rendered to the user, never an assumption
-- baked into the code."
--
-- That last sentence is why this is a query and not a constant. Every field
-- below is read from the layer registry, the coverage-gap ledger, and the
-- premises table themselves. Nothing here enumerates a layer, names a gap, or
-- asserts a date -- so a layer that stops loading, a gap somebody records at
-- ingest, or a table that was never populated all change what the user is told
-- WITHOUT anyone remembering to edit a list. A hardcoded manifest is a manifest
-- that goes stale silently, which is the failure Principle II exists to
-- prevent.
--
-- Takes no parameters: what tarrow covers does not depend on what was asked.
-- Returns exactly one row, and is attached to EVERY result -- flagged,
-- unflagged, declined, could-not-locate, and errored alike.

WITH layer_rows AS (
    SELECT l.id,
           l.description,
           l.source_url,
           l.jurisdiction,
           l.fetched_at,
           -- NULL means no human has ever verified this layer. Rendered as
           -- exactly that, never softened into a fetch date wearing a
           -- verification's name (Principle V).
           l.verified_at,
           l.row_count,
           l.notes,
           -- "Queried" is derived from whether this layer actually contributed
           -- rows a search reads, not from a list of layers somebody expected
           -- to be there. A layer registered but empty reports queried=false
           -- and its row_count of 0, which is the honest thing to render.
           (EXISTS (SELECT 1 FROM school_premises sp WHERE sp.layer_id = l.id)
         OR EXISTS (SELECT 1 FROM parcels        p  WHERE p.layer_id  = l.id)
         OR EXISTS (SELECT 1 FROM address_points a  WHERE a.layer_id  = l.id)
         OR EXISTS (SELECT 1 FROM municipalities m  WHERE m.layer_id  = l.id)
           ) AS queried
      FROM layers l
),
gap_rows AS (
    SELECT g.id,
           g.layer_id,
           g.subject_type,
           g.subject_ref,
           g.label,
           g.description,
           g.discovered_at
      FROM coverage_gaps g
),
-- The per-geometry measurement basis DECISION §3 requires the manifest to
-- render, aggregated over every loaded premises -- so the user can see the
-- quality distribution of what was searched even when nothing flagged.
basis_rows AS (
    SELECT sp.match_basis,
           sp.match_corroboration,
           count(*)                                                   AS premises,
           tarrow_premises_uncertainty_m(sp.match_basis, sp.match_corroboration)
                                                                      AS uncertainty_m
      FROM school_premises sp
     GROUP BY sp.match_basis, sp.match_corroboration
),
premises_counts AS (
    SELECT count(*)                                  AS total,
           count(*) FILTER (WHERE geom IS NOT NULL)   AS measurable,
           -- Premises tarrow holds a name for but no boundary. These are NOT
           -- measured and NOT approximated by a radius (DECISION §3); each one
           -- has a coverage_gaps row and the manifest reports it as not
           -- checked.
           count(*) FILTER (WHERE geom IS NULL)       AS not_measurable
      FROM school_premises
)
SELECT
    (SELECT jsonb_agg(to_jsonb(l) ORDER BY l.id)             FROM layer_rows l) AS layers,
    (SELECT jsonb_agg(to_jsonb(g) ORDER BY g.subject_type, g.subject_ref, g.id)
                                                             FROM gap_rows g)   AS gaps,
    (SELECT jsonb_agg(to_jsonb(b) ORDER BY b.match_basis, b.match_corroboration)
                                                             FROM basis_rows b) AS measurement_bases,
    (SELECT to_jsonb(c) FROM premises_counts c)                                 AS premises,
    -- Row counts of the layers a search actually traverses. The caller refuses
    -- to answer at all when either is zero: an unloaded database must say its
    -- data is absent, never return an empty confident-looking result.
    (SELECT count(*) FROM address_points)                                       AS address_point_count,
    (SELECT count(*) FROM parcels WHERE NOT is_mineral_rights)                  AS measurable_parcel_count,
    -- How old this instance's data is. Principle VII: an instance running
    -- six-month-old data is a hazard unless it announces itself as one, and we
    -- cannot update somebody else's deployment -- only make it incapable of
    -- hiding its age.
    (SELECT max(fetched_at) FROM layers)                                        AS data_fetched_at,
    (SELECT min(fetched_at) FROM layers)                                        AS oldest_layer_fetched_at,
    -- The buffer being applied, from the single definition of it
    -- (sql/schema/013_measurement_uncertainty.sql). The function's name carries
    -- the disclosure: no verified rule record backs this number yet.
    tarrow_unverified_state_buffer_m()                                           AS buffer_m;
