-- Report overlay resolution: getOverlaySourceRefsByStableIds filters
--   items.stable_id = ANY($1) AND items.is_draft = $2
-- Btree (stable_id, is_draft) helps bitmap/merge plans more than stable_id alone.
CREATE INDEX IF NOT EXISTS table_of_contents_items_stable_id_is_draft_idx
  ON public.table_of_contents_items (stable_id, is_draft);

-- Bulk upsert spatial metrics + JSON (report dependencies). Used only from API/worker (admin pool).
-- Do not drop inserted-path rows: see reportsPlugin comment “Optimization note”.
CREATE OR REPLACE FUNCTION public.bulk_upsert_spatial_metrics_and_json(
  p_subject_fragment_ids text[],
  p_subject_geography_ids integer[],
  p_types text[],
  p_overlay_source_urls text[],
  p_parameters jsonb[],
  p_source_processing_job_dependencies text[],
  p_project_ids integer[],
  p_dependency_hashes text[]
)
RETURNS TABLE (ord integer, metric jsonb)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH input AS (
    SELECT *
    FROM unnest(
      p_subject_fragment_ids,
      p_subject_geography_ids,
      p_types,
      p_overlay_source_urls,
      p_parameters,
      p_source_processing_job_dependencies,
      p_project_ids,
      p_dependency_hashes
    ) WITH ORDINALITY AS u(
      subject_fragment_id,
      subject_geography_id,
      type,
      overlay_source_url,
      parameters,
      source_processing_job_dependency,
      project_id,
      dependency_hash,
      ord
    )
  ),
  _ins AS (
    INSERT INTO spatial_metrics (
      subject_fragment_id,
      subject_geography_id,
      type,
      overlay_source_url,
      source_processing_job_dependency,
      project_id,
      parameters,
      dependency_hash
    )
    SELECT
      i.subject_fragment_id,
      i.subject_geography_id,
      i.type::spatial_metric_type,
      i.overlay_source_url,
      i.source_processing_job_dependency,
      i.project_id,
      i.parameters,
      i.dependency_hash
    FROM input i
    LEFT JOIN spatial_metrics sm0 ON
      coalesce(sm0.overlay_source_url, '') = coalesce(i.overlay_source_url, '')
      AND coalesce(sm0.source_processing_job_dependency, '') = coalesce(i.source_processing_job_dependency, '')
      AND coalesce(sm0.subject_fragment_id, '') = coalesce(i.subject_fragment_id, '')
      AND coalesce(sm0.subject_geography_id, -999999) = coalesce(i.subject_geography_id, -999999)
      AND sm0.type = i.type::spatial_metric_type
      AND sm0.parameters = i.parameters
      AND sm0.dependency_hash = i.dependency_hash
    WHERE sm0.id IS NULL
    ON CONFLICT (
      COALESCE(overlay_source_url, ''::text),
      COALESCE(source_processing_job_dependency, ''::text),
      COALESCE(subject_fragment_id, ''::text),
      COALESCE(subject_geography_id, '-999999'::integer),
      type,
      parameters,
      dependency_hash
    ) DO NOTHING
    RETURNING
      id,
      type,
      updated_at,
      created_at,
      value,
      state,
      error_message,
      progress_percentage,
      overlay_source_url,
      parameters,
      job_key,
      subject_fragment_id,
      subject_geography_id,
      source_processing_job_dependency,
      eta,
      started_at,
      duration,
      dependency_hash
  ),
  inserted AS (
    SELECT
      i.ord,
      ins.id,
      ins.type,
      ins.updated_at,
      ins.created_at,
      ins.value,
      ins.state,
      ins.error_message,
      ins.progress_percentage,
      ins.overlay_source_url,
      ins.parameters,
      ins.job_key,
      ins.subject_fragment_id,
      ins.subject_geography_id,
      ins.source_processing_job_dependency,
      ins.eta,
      ins.started_at,
      ins.duration,
      ins.dependency_hash
    FROM input i
    INNER JOIN _ins ins ON
      coalesce(ins.overlay_source_url, '') = coalesce(i.overlay_source_url, '')
      AND coalesce(ins.source_processing_job_dependency, '') = coalesce(i.source_processing_job_dependency, '')
      AND coalesce(ins.subject_fragment_id, '') = coalesce(i.subject_fragment_id, '')
      AND coalesce(ins.subject_geography_id, -999999) = coalesce(i.subject_geography_id, -999999)
      AND ins.type = i.type::spatial_metric_type
      AND ins.parameters = i.parameters
      AND ins.dependency_hash = i.dependency_hash
  ),
  existing AS (
    SELECT
      i.ord,
      sm.id,
      sm.type,
      sm.updated_at,
      sm.created_at,
      sm.value,
      sm.state,
      sm.error_message,
      sm.progress_percentage,
      sm.overlay_source_url,
      sm.parameters,
      sm.job_key,
      sm.subject_fragment_id,
      sm.subject_geography_id,
      sm.source_processing_job_dependency,
      sm.eta,
      sm.started_at,
      sm.duration,
      sm.dependency_hash
    FROM input i
    INNER JOIN spatial_metrics sm ON
      coalesce(sm.overlay_source_url, '') = coalesce(i.overlay_source_url, '')
      AND coalesce(sm.source_processing_job_dependency, '') = coalesce(i.source_processing_job_dependency, '')
      AND coalesce(sm.subject_fragment_id, '') = coalesce(i.subject_fragment_id, '')
      AND coalesce(sm.subject_geography_id, -999999) = coalesce(i.subject_geography_id, -999999)
      AND sm.type = i.type::spatial_metric_type
      AND sm.parameters = i.parameters
      AND sm.dependency_hash = i.dependency_hash
    LEFT JOIN inserted ins ON ins.ord = i.ord
    WHERE ins.ord IS NULL
  ),
  metric_rows AS (
    SELECT * FROM inserted
    UNION ALL
    SELECT * FROM existing
  ),
  fragment_meta AS (
    SELECT DISTINCT subject_fragment_id AS h
    FROM metric_rows
    WHERE subject_fragment_id IS NOT NULL
  ),
  frag_agg AS (
    SELECT
      sf.fragment_hash AS h,
      array_agg(sf.sketch_id ORDER BY sf.sketch_id) AS sketches
    FROM sketch_fragments sf
    WHERE sf.fragment_hash IN (SELECT h FROM fragment_meta)
    GROUP BY sf.fragment_hash
  ),
  geo_agg AS (
    SELECT
      fg.fragment_hash AS h,
      array_agg(fg.geography_id ORDER BY fg.geography_id) AS geographies
    FROM fragment_geographies fg
    WHERE fg.fragment_hash IN (SELECT h FROM fragment_meta)
    GROUP BY fg.fragment_hash
  )
  SELECT
    mr.ord,
    jsonb_build_object(
      'id', mr.id,
      'type', mr.type,
      'updatedAt', mr.updated_at,
      'createdAt', mr.created_at,
      'value', mr.value,
      'state', mr.state,
      'sourceUrl', mr.overlay_source_url,
      'sourceType', extension_to_source_type(mr.overlay_source_url),
      'parameters', coalesce(mr.parameters, '{}'::jsonb),
      'jobKey', mr.job_key,
      'subject',
        CASE WHEN mr.subject_geography_id IS NOT NULL THEN
          jsonb_build_object('id', mr.subject_geography_id, '__typename', 'GeographySubject')
        ELSE
          jsonb_build_object(
            'hash', mr.subject_fragment_id,
            'sketches', to_jsonb(coalesce(fa.sketches, ARRAY[]::integer[])),
            'geographies', to_jsonb(coalesce(ga.geographies, ARRAY[]::integer[])),
            '__typename', 'FragmentSubject'
          )
        END,
      'errorMessage', mr.error_message,
      'progress', mr.progress_percentage,
      'sourceProcessingJobDependency', mr.source_processing_job_dependency,
      'eta', mr.eta,
      'startedAt', mr.started_at,
      'durationSeconds', extract(epoch FROM mr.duration)::float,
      'dependencyHash', mr.dependency_hash
    ) AS metric
  FROM metric_rows mr
  LEFT JOIN frag_agg fa ON fa.h = mr.subject_fragment_id
  LEFT JOIN geo_agg ga ON ga.h = mr.subject_fragment_id
  ORDER BY mr.ord
$function$;

REVOKE ALL ON FUNCTION public.bulk_upsert_spatial_metrics_and_json(
  text[],
  integer[],
  text[],
  text[],
  jsonb[],
  text[],
  integer[],
  text[]
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.bulk_upsert_spatial_metrics_and_json(
  text[],
  integer[],
  text[],
  text[],
  jsonb[],
  text[],
  integer[],
  text[]
) TO anon;

COMMENT ON FUNCTION public.bulk_upsert_spatial_metrics_and_json(
  text[],
  integer[],
  text[],
  text[],
  jsonb[],
  text[],
  integer[],
  text[]
) IS '@omit';
