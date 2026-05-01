--! Previous: sha1:2c372078e9271ffbd876d95b0a0cfa2b6b6f87c3
--! Hash: sha1:afaedb19e94bd0ccbf421a1cbc58e3f7f54ca702
--! Message: batch spatial metric worker jobs

-- Report overlay resolution: getOverlaySourceRefsByStableIds filters
--   items.stable_id = ANY($1) AND items.is_draft = $2 (and project_id when provided).
-- Trusted path uses report_overlay_source_refs_by_stable_ids (SECURITY DEFINER).
-- Btree (stable_id, is_draft) helps bitmap/merge plans more than stable_id alone.
--
-- Cleanup legacy overloaded functions that break PostGraphile field generation.
-- PostGraphile cannot expose overloaded functions that would map to the same
-- GraphQL field name (e.g. `addReportCard`), so we must keep a single overload.
DROP FUNCTION IF EXISTS public.add_report_card(integer, jsonb, text, jsonb);

-- (touch) ensure graphile-migrate watch reruns current.sql

CREATE INDEX IF NOT EXISTS table_of_contents_items_stable_id_is_draft_idx
  ON public.table_of_contents_items (stable_id, is_draft);

-- Queue a single graphile-worker batch job for spatial metric ids (calculateSpatialMetricsBatch).
-- De-duplicates ids; only enqueues rows still in queueable states.
CREATE OR REPLACE FUNCTION public.queue_spatial_metrics_calculation(p_metric_ids bigint[])
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_eligible bigint[];
BEGIN
  IF p_metric_ids IS NULL OR cardinality(p_metric_ids) = 0 THEN
    RETURN;
  END IF;

  SELECT coalesce(array_agg(sm.id ORDER BY sm.id), ARRAY[]::bigint[])
  INTO v_eligible
  FROM (
    SELECT DISTINCT unnest(p_metric_ids) AS id
  ) u
  INNER JOIN spatial_metrics sm ON sm.id = u.id
  WHERE sm.state IN (
    'queued'::spatial_metric_state,
    'dependency_not_ready'::spatial_metric_state
  );

  IF v_eligible IS NULL OR cardinality(v_eligible) = 0 THEN
    RETURN;
  END IF;

  PERFORM graphile_worker.add_job(
    'calculateSpatialMetricsBatch',
    json_build_object(
      'metricIds',
      (SELECT to_jsonb(array_agg(x ORDER BY x)) FROM unnest(v_eligible) AS t(x))
    ),
    max_attempts := 1,
    job_key := 'calculateSpatialMetricsBatch:' || md5(array_to_string(v_eligible, ',')),
    job_key_mode := 'replace'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.queue_spatial_metrics_calculation(bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.queue_spatial_metrics_calculation(bigint[]) TO anon;

COMMENT ON FUNCTION public.queue_spatial_metrics_calculation(bigint[]) IS '@omit';

DROP FUNCTION IF EXISTS public.queue_spatial_metric_calculation(bigint);

-- Remove trigger-driven queueing; callers use queue_spatial_metric_calculation explicitly.
DROP TRIGGER IF EXISTS queue_calculate_spatial_metric_task_trigger ON public.spatial_metrics;
DROP FUNCTION IF EXISTS public.queue_calculate_spatial_metric_task();

-- Batch resolve spatial metrics + JSON (report dependencies). Reads cache first, inserts
-- missing rows with ON CONFLICT DO NOTHING, queues new queued metrics explicitly (no insert trigger).
CREATE OR REPLACE FUNCTION public.resolve_spatial_metrics_batch(
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
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  new_metric_ids bigint[];
BEGIN
  -- Insert missing metrics only; queue one batch job for all newly inserted rows.
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
  existing AS (
    SELECT
      i.ord,
      sm.id
    FROM input i
    INNER JOIN spatial_metrics sm ON
      coalesce(sm.overlay_source_url, '') = coalesce(i.overlay_source_url, '')
      AND coalesce(sm.source_processing_job_dependency, '') = coalesce(i.source_processing_job_dependency, '')
      AND coalesce(sm.subject_fragment_id, '') = coalesce(i.subject_fragment_id, '')
      AND coalesce(sm.subject_geography_id, -999999) = coalesce(i.subject_geography_id, -999999)
      AND sm.type = i.type::spatial_metric_type
      AND sm.parameters = i.parameters
      AND sm.dependency_hash = i.dependency_hash
  ),
  missing_input AS (
    SELECT i.*
    FROM input i
    LEFT JOIN existing e ON e.ord = i.ord
    WHERE e.ord IS NULL
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
    FROM missing_input i
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
  inserted_pairs AS (
    SELECT
      i.ord,
      ins.id
    FROM missing_input i
    INNER JOIN _ins ins ON
      coalesce(ins.overlay_source_url, '') = coalesce(i.overlay_source_url, '')
      AND coalesce(ins.source_processing_job_dependency, '') = coalesce(i.source_processing_job_dependency, '')
      AND coalesce(ins.subject_fragment_id, '') = coalesce(i.subject_fragment_id, '')
      AND coalesce(ins.subject_geography_id, -999999) = coalesce(i.subject_geography_id, -999999)
      AND ins.type = i.type::spatial_metric_type
      AND ins.parameters = i.parameters
      AND ins.dependency_hash = i.dependency_hash
  )
  SELECT coalesce(array_agg(inserted_pairs.id ORDER BY inserted_pairs.id), ARRAY[]::bigint[])
  INTO new_metric_ids
  FROM inserted_pairs;

  IF new_metric_ids IS NOT NULL AND cardinality(new_metric_ids) > 0 THEN
    PERFORM queue_spatial_metrics_calculation(new_metric_ids);
  END IF;

  RETURN QUERY
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
  metric_rows AS (
    SELECT
      i.ord::integer AS ord,
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
  ),
  fragment_meta AS MATERIALIZED (
    SELECT DISTINCT subject_fragment_id AS h
    FROM metric_rows
    WHERE subject_fragment_id IS NOT NULL
  ),
  frag_agg AS MATERIALIZED (
    SELECT
      sf.fragment_hash AS h,
      array_agg(sf.sketch_id ORDER BY sf.sketch_id) AS sketches
    FROM sketch_fragments sf
    WHERE sf.fragment_hash IN (SELECT h FROM fragment_meta)
    GROUP BY sf.fragment_hash
  ),
  geo_agg AS MATERIALIZED (
    SELECT
      fg.fragment_hash AS h,
      array_agg(fg.geography_id ORDER BY fg.geography_id) AS geographies
    FROM fragment_geographies fg
    WHERE fg.fragment_hash IN (SELECT h FROM fragment_meta)
    GROUP BY fg.fragment_hash
  ),
  fragment_subject_map AS MATERIALIZED (
    SELECT
      coalesce(
        jsonb_object_agg(
          fm.h,
          jsonb_build_object(
            'hash', fm.h,
            'sketches', to_jsonb(coalesce(fa.sketches, ARRAY[]::integer[])),
            'geographies', to_jsonb(coalesce(ga.geographies, ARRAY[]::integer[])),
            '__typename', 'FragmentSubject'
          )
        ),
        '{}'::jsonb
      ) AS subjects
    FROM fragment_meta fm
    LEFT JOIN frag_agg fa ON fa.h = fm.h
    LEFT JOIN geo_agg ga ON ga.h = fm.h
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
          fsm.subjects -> mr.subject_fragment_id
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
  CROSS JOIN fragment_subject_map fsm
  ORDER BY 1;
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_spatial_metrics_batch(
  text[],
  integer[],
  text[],
  text[],
  jsonb[],
  text[],
  integer[],
  text[]
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.resolve_spatial_metrics_batch(
  text[],
  integer[],
  text[],
  text[],
  jsonb[],
  text[],
  integer[],
  text[]
) TO anon;

COMMENT ON FUNCTION public.resolve_spatial_metrics_batch(
  text[],
  integer[],
  text[],
  text[],
  jsonb[],
  text[],
  integer[],
  text[]
) IS '@omit';

DROP FUNCTION IF EXISTS public.bulk_upsert_spatial_metrics_and_json(
  text[],
  integer[],
  text[],
  text[],
  jsonb[],
  text[],
  integer[],
  text[]
);

-- Single-row resolver: queue explicitly after successful insert (trigger removed).
CREATE OR REPLACE FUNCTION public.get_or_create_spatial_metric(
  p_subject_fragment_id text,
  p_subject_geography_id integer,
  p_type public.spatial_metric_type,
  p_overlay_source_url text,
  p_parameters jsonb,
  p_source_processing_job_dependency text,
  p_project_id integer,
  p_dependency_hash text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  metric_id bigint;
BEGIN
  IF p_subject_fragment_id IS NOT NULL AND p_subject_geography_id IS NOT NULL THEN
    RAISE EXCEPTION 'Exactly one of subject_fragment_id or subject_geography_id must be provided';
  END IF;
  IF p_subject_fragment_id IS NULL AND p_subject_geography_id IS NULL THEN
    RAISE EXCEPTION 'Exactly one of subject_fragment_id or subject_geography_id must be provided';
  END IF;
  IF p_type IS NULL THEN
    RAISE EXCEPTION 'type parameter is required';
  END IF;
  IF (p_overlay_source_url IS NULL AND p_source_processing_job_dependency IS NULL) AND p_type != 'total_area' THEN
    RAISE EXCEPTION 'overlay_source_url or source_processing_job_dependency parameter is required for non-total_area metrics';
  END IF;

  INSERT INTO spatial_metrics (
    subject_fragment_id,
    subject_geography_id,
    type,
    overlay_source_url,
    source_processing_job_dependency,
    project_id,
    parameters,
    dependency_hash
  ) VALUES (
    p_subject_fragment_id,
    p_subject_geography_id,
    p_type,
    p_overlay_source_url,
    p_source_processing_job_dependency,
    p_project_id,
    p_parameters,
    p_dependency_hash
  )
  ON CONFLICT (
    COALESCE(overlay_source_url, ''),
    COALESCE(source_processing_job_dependency, ''),
    COALESCE(subject_fragment_id, ''),
    COALESCE(subject_geography_id, -999999),
    type,
    parameters,
    dependency_hash
  ) DO NOTHING
  RETURNING id INTO metric_id;

  IF metric_id IS NOT NULL THEN
    PERFORM queue_spatial_metrics_calculation(ARRAY[metric_id]);
  END IF;

  IF metric_id IS NULL THEN
    SELECT id INTO metric_id
    FROM spatial_metrics
    WHERE COALESCE(overlay_source_url, '') = COALESCE(p_overlay_source_url, '')
      AND COALESCE(source_processing_job_dependency, '') = COALESCE(p_source_processing_job_dependency, '')
      AND COALESCE(subject_fragment_id, '') = COALESCE(p_subject_fragment_id, '')
      AND COALESCE(subject_geography_id, -999999) = COALESCE(p_subject_geography_id, -999999)
      AND type = p_type
      AND parameters = p_parameters
      AND dependency_hash = p_dependency_hash;
  END IF;

  RETURN get_spatial_metric(metric_id);
END;
$$;

COMMENT ON FUNCTION public.get_or_create_spatial_metric(
  text,
  integer,
  public.spatial_metric_type,
  text,
  jsonb,
  text,
  integer,
  text
) IS '@omit';

REVOKE ALL ON FUNCTION public.get_or_create_spatial_metric(
  text,
  integer,
  public.spatial_metric_type,
  text,
  jsonb,
  text,
  integer,
  text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_or_create_spatial_metric(
  text,
  integer,
  public.spatial_metric_type,
  text,
  jsonb,
  text,
  integer,
  text
) TO anon;

-- Fragment hash lookup without per-sketch RLS probe (caller must enforce access, e.g.
-- assertSessionCanLoadReportDependencies + session_can_access_sketch).
CREATE OR REPLACE FUNCTION public.get_fragment_hashes_for_sketch_trusted(p_sketch_id integer)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  fragment_hashes text[];
  sketch_ids integer[];
BEGIN
  sketch_ids := ARRAY[]::integer[];
  sketch_ids := array_append(sketch_ids, p_sketch_id);
  sketch_ids := array_cat(
    sketch_ids,
    coalesce((
      SELECT security_definer_get_child_sketches_recursive(p_sketch_id, 'sketch')
    ), ARRAY[]::integer[])
  );
  SELECT array_agg(sf.fragment_hash) INTO fragment_hashes
  FROM sketch_fragments sf
  INNER JOIN fragments f ON sf.fragment_hash = f.hash
  WHERE sf.sketch_id = ANY(sketch_ids);
  RETURN coalesce(fragment_hashes, ARRAY[]::text[]);
END;
$function$;

COMMENT ON FUNCTION public.get_fragment_hashes_for_sketch_trusted(integer) IS '@omit';

REVOKE ALL ON FUNCTION public.get_fragment_hashes_for_sketch_trusted(integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_fragment_hashes_for_sketch_trusted(integer) TO anon;

-- Overlay refs for report dependency resolution: bypasses TOC/layer/source RLS.
-- Scoped by project_id; caller must enforce session access to that project/sketch.
CREATE OR REPLACE FUNCTION public.report_overlay_source_refs_by_stable_ids(
  p_project_id integer,
  p_stable_ids text[],
  p_is_draft boolean
)
RETURNS TABLE (
  table_of_contents_item_id integer,
  stable_id text,
  source_url text,
  source_processing_job_id text,
  output_id integer,
  contains_overlapping_features boolean,
  raster_band_count integer,
  vector_geometry_type text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT DISTINCT ON (items.stable_id)
    items.id,
    items.stable_id,
    reporting_output.url,
    coalesce(reporting_output.source_processing_job_key, jobs.job_key),
    reporting_output.id,
    reporting_output.contains_overlapping_features,
    sources.raster_band_count,
    sources.vector_geometry_type
  FROM table_of_contents_items items
  JOIN data_layers layers ON layers.id = items.data_layer_id
  JOIN data_sources sources ON sources.id = layers.data_source_id
  LEFT JOIN LATERAL table_of_contents_items_reporting_output(items.*) AS reporting_output ON true
  LEFT JOIN LATERAL (
    SELECT spj.job_key
    FROM source_processing_jobs spj
    WHERE spj.data_source_id = sources.id
    ORDER BY spj.created_at DESC
    LIMIT 1
  ) jobs ON true
  WHERE
    items.stable_id = ANY(p_stable_ids)
    AND items.is_draft = p_is_draft
    AND items.project_id = p_project_id
  ORDER BY
    items.stable_id,
    coalesce(reporting_output.id, 0) DESC;
$function$;

COMMENT ON FUNCTION public.report_overlay_source_refs_by_stable_ids(
  integer,
  text[],
  boolean
) IS '@omit';

REVOKE ALL ON FUNCTION public.report_overlay_source_refs_by_stable_ids(
  integer,
  text[],
  boolean
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.report_overlay_source_refs_by_stable_ids(
  integer,
  text[],
  boolean
) TO anon;

-- ---------------------------------------------------------------------------
-- spatial_metrics vs failed overlay preprocessing jobs
--
-- `trigger_queue_spatial_metrics_on_source_complete` (AFTER UPDATE on
-- source_processing_jobs) only marks dependents when the job *transitions*
-- into `error`. Metrics created *after* the job is already errored never see
-- that transition, so they must be marked on INSERT via
-- `before_insert_spatial_metrics_check_dependency_error`.
--
-- If that BEFORE INSERT trigger is missing, rows stay `queued` forever while
-- the overlay row shows error (see ReportMetricsProgressDetails).
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS before_insert_spatial_metrics_check_dependency_error_trigger
  ON public.spatial_metrics;

CREATE TRIGGER before_insert_spatial_metrics_check_dependency_error_trigger
  BEFORE INSERT ON public.spatial_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.before_insert_spatial_metrics_check_dependency_error();

-- Heal rows created while the trigger was missing (or any other drift).
UPDATE spatial_metrics sm
SET
  state = 'error',
  error_message = 'Error processing source dependency.'
FROM source_processing_jobs j
WHERE
  sm.source_processing_job_dependency = j.job_key
  AND j.state = 'error'
  AND sm.state IS DISTINCT FROM 'error'
  AND sm.state IS DISTINCT FROM 'complete';

-- Source preprocessing completed: update dependents and enqueue one calculateSpatialMetricsBatch job.
CREATE OR REPLACE FUNCTION public.trigger_queue_spatial_metrics_on_source_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  completed_source_url text;
  dependent_ids bigint[];
BEGIN
  IF NEW.state = 'complete' AND (OLD.state IS NULL OR OLD.state != 'complete') THEN
    SELECT url INTO completed_source_url
    FROM data_upload_outputs
    WHERE is_reporting_type(type) AND data_source_id = NEW.data_source_id
    LIMIT 1;
    IF completed_source_url IS NULL THEN
      RAISE EXCEPTION 'Completed source url not found';
    END IF;
    WITH updated AS (
      UPDATE spatial_metrics
      SET
        overlay_source_url = completed_source_url,
        state = 'queued'::spatial_metric_state
      WHERE source_processing_job_dependency = NEW.job_key
      RETURNING id
    )
    SELECT coalesce(array_agg(id ORDER BY id), ARRAY[]::bigint[])
    INTO dependent_ids
    FROM updated;

    IF dependent_ids IS NOT NULL AND cardinality(dependent_ids) > 0 THEN
      PERFORM queue_spatial_metrics_calculation(dependent_ids);
    END IF;
  END IF;
  IF NEW.state = 'error' AND (OLD.state IS NULL OR OLD.state != 'error') THEN
    UPDATE spatial_metrics
    SET
      state = 'error',
      error_message = 'Error processing source dependency.'
    WHERE source_processing_job_dependency = NEW.job_key;
  END IF;

  RETURN NEW;
END;
$$;

-- Retry failed metrics: batch enqueue after resetting rows to queued.
CREATE OR REPLACE FUNCTION public.retry_failed_spatial_metrics(metric_ids bigint[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  metric_id bigint;
  updated_metric_id bigint;
  job_dep text;
  existing_job_state spatial_metric_state;
  queued_ids bigint[] := ARRAY[]::bigint[];
BEGIN
  IF metric_ids IS NULL OR cardinality(metric_ids) = 0 THEN
    RETURN true;
  END IF;
  FOREACH metric_id IN ARRAY metric_ids LOOP
    UPDATE spatial_metrics
    SET
      state = 'queued'::spatial_metric_state,
      error_message = NULL,
      updated_at = now(),
      created_at = now(),
      progress_percentage = 0,
      job_key = gen_random_uuid()::text
    WHERE id = metric_id
    RETURNING id INTO updated_metric_id;
    IF updated_metric_id IS NOT NULL THEN
      queued_ids := array_append(queued_ids, updated_metric_id);
      SELECT source_processing_job_dependency INTO job_dep FROM spatial_metrics WHERE id = updated_metric_id;
      IF job_dep IS NOT NULL THEN
        SELECT state INTO existing_job_state FROM source_processing_jobs WHERE job_key = job_dep;
        IF existing_job_state = 'error' THEN
          PERFORM retry_failed_source_processing_job(job_dep);
        END IF;
      END IF;
    END IF;
  END LOOP;

  IF queued_ids IS NOT NULL AND cardinality(queued_ids) > 0 THEN
    PERFORM queue_spatial_metrics_calculation(queued_ids);
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.retry_failed_spatial_metrics(bigint[]) TO anon;
