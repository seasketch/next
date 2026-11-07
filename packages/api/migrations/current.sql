-- Enter migration here

CREATE OR REPLACE FUNCTION public.publish_report_snapshot(p_draft_report_id integer) RETURNS public.sketch_classes
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  published_sketch_class public.sketch_classes;
  new_report public.reports;
  draft_report_id int;
  project_id int;
  draft_report_version int;
  draft_lineage_parent_id int;
  draft_sketch_class_id int;
  new_report_id int;
  old_tab_id int;
  new_tab_id int;
  referenced_stable_ids text[];
  pending_source_id int;
  pending_job_state public.spatial_metric_state;
  pending_job_key text;
  stable_ids_missing_outputs text[];
  sid text;
  max_lineage_version int;
begin
  draft_report_id := p_draft_report_id;

  select
    r.project_id,
    r.version,
    r.draft_id,
    r.sketch_class_id
  into
    project_id,
    draft_report_version,
    draft_lineage_parent_id,
    draft_sketch_class_id
  from public.reports r
  where r.id = draft_report_id;

  if project_id is null then
    raise exception 'Report not found';
  end if;

  if draft_report_version != 0 or draft_lineage_parent_id is not null then
    raise exception 'Only draft reports can be published';
  end if;

  select coalesce(max(version), 0)
  into max_lineage_version
  from public.reports r
  where r.id = draft_report_id or r.draft_id = draft_report_id;

  referenced_stable_ids := public.get_referenced_stable_ids_for_report(draft_report_id);
  if array_length(referenced_stable_ids, 1) > 0 then
    if (
      select count(*) from public.table_of_contents_items
      where stable_id = any(referenced_stable_ids) and is_draft = false
    ) < array_length(referenced_stable_ids, 1) then
      raise exception 'This report references data layers that have not yet been published. Please publish the layer list first.';
    end if;

    -- Each referenced layer's draft source must also be the published one.
    -- Published copies keep the draft source's url.
    if exists (
      select 1
      from public.table_of_contents_items draft_item
      join public.data_layers draft_layer on draft_layer.id = draft_item.data_layer_id
      join public.data_sources draft_source on draft_source.id = draft_layer.data_source_id
      where draft_item.stable_id = any(referenced_stable_ids)
        and draft_item.is_draft = true
        and not exists (
          select 1
          from public.table_of_contents_items published_item
          join public.data_layers published_layer on published_layer.id = published_item.data_layer_id
          join public.data_sources published_source on published_source.id = published_layer.data_source_id
          where published_item.stable_id = draft_item.stable_id
            and published_item.is_draft = false
            and published_source.url is not distinct from draft_source.url
        )
    ) then
      raise exception 'This report references updated versions of data sources which have not yet been published. Please publish the data sources first.';
    end if;

    -- Layers still preprocessing don't block publishing. Published reports
    -- wait on the job, and its output reaches the published copies when it
    -- completes (see trigger_queue_spatial_metrics_on_source_complete).
    for pending_source_id, pending_job_state in
      select distinct draft_layer.data_source_id, spj.state
      from public.table_of_contents_items draft_item
      join public.data_layers draft_layer on draft_layer.id = draft_item.data_layer_id
      left join public.source_processing_jobs spj on spj.data_source_id = draft_layer.data_source_id
      where draft_item.stable_id = any(referenced_stable_ids)
        and draft_item.is_draft = true
        and public.table_of_contents_items_reporting_output(draft_item.*) is null
    loop
      if pending_job_state is null then
        insert into public.source_processing_jobs (data_source_id, project_id)
        values (pending_source_id, project_id)
        on conflict do nothing
        returning job_key into pending_job_key;
        if pending_job_key is not null then
          perform graphile_worker.add_job(
            'preprocessSource',
            json_build_object('jobKey', pending_job_key),
            max_attempts := 1
          );
        end if;
      elsif pending_job_state = 'error' then
        raise exception 'This report references data layers that failed processing for reporting. Please review your report for errors and ensure all cards render correctly before publishing.';
      end if;
    end loop;

    stable_ids_missing_outputs := (
      select array_agg(stable_id)
      from public.table_of_contents_items
      where stable_id = any(referenced_stable_ids)
        and is_draft = false
        and public.table_of_contents_items_reporting_output(public.table_of_contents_items.*) is null
    );

    if array_length(stable_ids_missing_outputs, 1) > 0 then
      foreach sid in array stable_ids_missing_outputs loop
        insert into public.data_upload_outputs (
          data_source_id,
          project_id,
          type,
          url,
          remote,
          is_original,
          size,
          filename,
          original_filename,
          is_custom_upload,
          fgb_header_size,
          source_processing_job_key,
          epsg,
          num_features,
          num_invalid_features,
          num_repaired_features,
          was_repaired,
          contains_overlapping_features
        ) select
          (
            select data_source_id
            from public.data_layers
            where id = (
              select data_layer_id
              from public.table_of_contents_items
              where stable_id = sid and is_draft = false
            )
          ),
          d.project_id,
          d.type,
          d.url,
          d.remote,
          d.is_original,
          d.size,
          d.filename,
          d.original_filename,
          d.is_custom_upload,
          d.fgb_header_size,
          d.source_processing_job_key,
          d.epsg,
          d.num_features,
          d.num_invalid_features,
          d.num_repaired_features,
          d.was_repaired,
          d.contains_overlapping_features
        from public.data_upload_outputs d
        where d.data_source_id = (
            select data_source_id
            from public.data_layers
            where id = (
              select data_layer_id
              from public.table_of_contents_items
              where stable_id = sid and is_draft = true
            )
          )
          and public.is_reporting_type(d.type)
        order by d.created_at desc
        limit 1;
      end loop;
    end if;
  end if;

  insert into public.reports (
    project_id,
    sketch_class_id,
    title,
    version,
    draft_id,
    published_at
  )
  select
    r.project_id,
    coalesce(r.sketch_class_id, draft_sketch_class_id),
    coalesce(r.title, 'Untitled Report'),
    max_lineage_version + 1,
    draft_report_id,
    now()
  from public.reports r
  where r.id = draft_report_id
  returning * into new_report;

  new_report_id := new_report.id;

  -- Copy report tabs + cards preserving positions and language settings.
  for old_tab_id in
    select rt.id
    from public.report_tabs rt
    where rt.report_id = draft_report_id
    order by rt.position
  loop
    insert into public.report_tabs (
      report_id,
      title,
      position,
      alternate_language_settings,
      updated_at
    )
    select
      new_report_id,
      rt.title,
      rt.position,
      rt.alternate_language_settings,
      rt.updated_at
    from public.report_tabs rt
    where rt.id = old_tab_id
    returning id into new_tab_id;

    insert into public.report_cards (
      report_tab_id,
      body,
      position,
      alternate_language_settings,
      component_settings,
      updated_at,
      is_draft
    )
    select
      new_tab_id,
      rc.body,
      rc.position,
      rc.alternate_language_settings,
      rc.component_settings,
      rc.updated_at,
      false
    from public.report_cards rc
    where rc.report_tab_id = old_tab_id
    order by rc.position;
  end loop;

  select * into published_sketch_class
  from public.sketch_classes
  where id = draft_sketch_class_id;
  return published_sketch_class;
end;
$$;

-- A published copy of a source keeps the draft source's url, but source
-- processing jobs are not copied on publish. When the layer list is published
-- while a new version is still preprocessing, the copy has neither a reporting
-- output nor a job of its own. This resolves the output (or in-flight job) of
-- the same-url source it was copied from, so published reports wait on that
-- job instead of failing to resolve.
CREATE OR REPLACE FUNCTION public.reporting_ref_from_same_url_source(p_source_id integer)
RETURNS TABLE(output_id integer, url text, contains_overlapping_features boolean, job_key text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT
    o.id,
    o.url,
    o.contains_overlapping_features,
    coalesce(o.source_processing_job_key, spj.job_key)
  FROM data_sources copy
  JOIN data_sources origin
    ON origin.project_id = copy.project_id
   AND origin.url = copy.url
   AND origin.id <> copy.id
  LEFT JOIN LATERAL (
    SELECT d.*
    FROM data_upload_outputs d
    WHERE d.data_source_id = origin.id
      AND is_reporting_type(d.type)
    ORDER BY d.created_at DESC
    LIMIT 1
  ) o ON true
  LEFT JOIN source_processing_jobs spj ON spj.data_source_id = origin.id
  WHERE copy.id = p_source_id
    AND copy.url IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM table_of_contents_items items
      JOIN data_layers layers ON layers.id = items.data_layer_id
      WHERE layers.data_source_id = copy.id
        AND items.is_draft = false
    )
    AND (o.id IS NOT NULL OR spj.job_key IS NOT NULL)
  ORDER BY (o.id IS NOT NULL) DESC, spj.created_at DESC NULLS LAST, origin.id DESC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.reporting_ref_from_same_url_source(integer) IS '@omit';
REVOKE ALL ON FUNCTION public.reporting_ref_from_same_url_source(integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reporting_ref_from_same_url_source(integer) TO anon;

CREATE OR REPLACE FUNCTION public.report_overlay_source_refs_by_stable_ids(p_project_id integer, p_stable_ids text[], p_is_draft boolean) RETURNS TABLE(table_of_contents_item_id integer, stable_id text, source_url text, source_processing_job_id text, output_id integer, contains_overlapping_features boolean, raster_band_count integer, vector_geometry_type text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT DISTINCT ON (items.stable_id)
    items.id,
    items.stable_id,
    coalesce(reporting_output.url, upstream.url),
    coalesce(reporting_output.source_processing_job_key, jobs.job_key, upstream.job_key),
    coalesce(reporting_output.id, upstream.output_id),
    coalesce(reporting_output.contains_overlapping_features, upstream.contains_overlapping_features),
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
  -- OFFSET 0 keeps the gate a one-time filter, so the lookup only runs for
  -- items with neither an output nor a job.
  LEFT JOIN LATERAL (
    SELECT *
    FROM reporting_ref_from_same_url_source(sources.id)
    WHERE reporting_output.id IS NULL AND jobs.job_key IS NULL
    OFFSET 0
  ) upstream ON true
  WHERE
    items.stable_id = ANY(p_stable_ids)
    AND items.is_draft = p_is_draft
    AND items.project_id = p_project_id
  ORDER BY
    items.stable_id,
    coalesce(reporting_output.id, upstream.output_id, 0) DESC;
$$;

-- When preprocessing completes, published copies of the source (same url,
-- published after the job was queued) receive the reporting output too, so
-- they resolve like any other published layer from then on.
CREATE OR REPLACE FUNCTION public.trigger_queue_spatial_metrics_on_source_complete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
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

    INSERT INTO data_upload_outputs (
      data_source_id,
      project_id,
      type,
      url,
      remote,
      is_original,
      size,
      filename,
      original_filename,
      is_custom_upload,
      fgb_header_size,
      source_processing_job_key,
      epsg,
      num_features,
      num_invalid_features,
      num_repaired_features,
      was_repaired,
      contains_overlapping_features
    )
    SELECT
      copy.id,
      o.project_id,
      o.type,
      o.url,
      o.remote,
      o.is_original,
      o.size,
      o.filename,
      o.original_filename,
      o.is_custom_upload,
      o.fgb_header_size,
      o.source_processing_job_key,
      o.epsg,
      o.num_features,
      o.num_invalid_features,
      o.num_repaired_features,
      o.was_repaired,
      o.contains_overlapping_features
    FROM data_sources origin
    JOIN data_sources copy
      ON copy.project_id = origin.project_id
     AND copy.url = origin.url
     AND copy.id <> origin.id
    CROSS JOIN LATERAL (
      SELECT d.*
      FROM data_upload_outputs d
      WHERE d.data_source_id = origin.id
        AND is_reporting_type(d.type)
      ORDER BY d.created_at DESC
      LIMIT 1
    ) o
    WHERE origin.id = NEW.data_source_id
      AND origin.url IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM table_of_contents_items items
        JOIN data_layers layers ON layers.id = items.data_layer_id
        WHERE layers.data_source_id = copy.id
          AND items.is_draft = false
      )
      AND NOT EXISTS (
        SELECT 1
        FROM data_upload_outputs existing
        WHERE existing.data_source_id = copy.id
          AND is_reporting_type(existing.type)
      );

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
