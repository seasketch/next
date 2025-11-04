-- Enter migration here
CREATE OR REPLACE FUNCTION public.get_or_create_spatial_metric(p_subject_fragment_id text, p_subject_geography_id integer, p_type public.spatial_metric_type, p_overlay_source_url text, p_overlay_group_by text, p_included_properties text[], p_source_processing_job_dependency text, p_project_id integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    metric_id bigint;
  begin
    if p_subject_fragment_id is not null and p_subject_geography_id is not null then
      raise exception 'Exactly one of subject_fragment_id or subject_geography_id must be provided';
    end if;
    if p_subject_fragment_id is null and p_subject_geography_id is null then
      raise exception 'Exactly one of subject_fragment_id or subject_geography_id must be provided';
    end if;
    if p_type is null then
      raise exception 'type parameter is required';
    end if;
    if (p_overlay_source_url is null and p_source_processing_job_dependency is null) and p_type != 'total_area' then
      raise exception 'overlay_source_url or source_processing_job_dependency parameter is required for non-total_area metrics';
    end if;
    
    -- Insert or get existing metric
    if p_subject_fragment_id is not null then
      -- Use ON CONFLICT to handle the unique index on fragment metrics
      insert into spatial_metrics (
        subject_fragment_id, 
        subject_geography_id, 
        type, 
        overlay_source_url, 
        overlay_group_by, 
        included_properties, 
        source_processing_job_dependency,
        project_id
      ) values (
        p_subject_fragment_id, 
        p_subject_geography_id, 
        p_type, 
        p_overlay_source_url, 
        p_overlay_group_by, 
        p_included_properties, 
        p_source_processing_job_dependency,
        p_project_id
      )
      on conflict (subject_fragment_id, type, 
        (COALESCE(overlay_source_url, '')), 
        (COALESCE(overlay_group_by, '')))
      where subject_fragment_id is not null and subject_geography_id is null
      do update set project_id = spatial_metrics.project_id -- no-op update to return existing row
      returning id into metric_id;
    else
      -- For geography metrics, try to find existing first, then insert if not found
      select id into metric_id from spatial_metrics
      where subject_geography_id = p_subject_geography_id
        and subject_fragment_id is null
        and type = p_type
        and coalesce(overlay_source_url, '') = coalesce(p_overlay_source_url, '')
        and coalesce(overlay_group_by, '') = coalesce(p_overlay_group_by, '');
      
      if metric_id is null then
        insert into spatial_metrics (
          subject_fragment_id, 
          subject_geography_id, 
          type, 
          overlay_source_url, 
          overlay_group_by, 
          included_properties, 
          source_processing_job_dependency,
          project_id
        ) values (
          p_subject_fragment_id, 
          p_subject_geography_id, 
          p_type, 
          p_overlay_source_url, 
          p_overlay_group_by, 
          p_included_properties, 
          p_source_processing_job_dependency,
          p_project_id
        ) 
        returning id into metric_id;
      end if;
    end if;
    
    return (select get_spatial_metric(metric_id));
  end;
$$;


-- If a spatial_metric depends on a source_processing_job that already errored,
-- mark the metric as failed immediately on insert
CREATE OR REPLACE FUNCTION public.before_insert_spatial_metrics_check_dependency_error() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    dep_state public.spatial_metric_state;
  begin
    if NEW.source_processing_job_dependency is not null then
      select state into dep_state from source_processing_jobs where job_key = NEW.source_processing_job_dependency;
      if dep_state = 'error' then
        NEW.state := 'error';
        NEW.error_message := 'Related overlay did not complete processing.';
      end if;
    end if;
    return NEW;
  end;
  $$;


CREATE OR REPLACE FUNCTION public.trigger_queue_preprocess_source_on_rcl() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  DECLARE
    existing_output_id integer;
    ds_id integer;
    source_processing_job_key text;
  BEGIN
    -- Determine data source id for the referenced TOC item
    SELECT data_source_id INTO ds_id
    FROM data_layers
    WHERE id = (
      SELECT data_layer_id
      FROM table_of_contents_items
      WHERE id = NEW.table_of_contents_item_id
    );

    -- If we can't resolve a data source, do nothing
    IF ds_id IS NULL THEN
      raise exception 'No data source found for table of contents item %', NEW.table_of_contents_item_id;
      RETURN NEW;
    END IF;

    
    
    -- If no existing source processing job exists, enqueue a preprocess job for this data source
    IF (SELECT COUNT(*) FROM source_processing_jobs WHERE data_source_id = ds_id) = 0 THEN
      insert into source_processing_jobs (data_source_id, project_id) values (ds_id, (select project_id from data_sources where id = ds_id)) returning job_key into source_processing_job_key;
      PERFORM graphile_worker.add_job(
        'preprocessSource',
        json_build_object('jobKey', source_processing_job_key),
        max_attempts := 1
      );
    END IF;
    return new;
  END;
  $$;
