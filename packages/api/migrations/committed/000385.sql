--! Previous: sha1:69a6d3e69a22a45e5d358ad0a952fca16bd86fe1
--! Hash: sha1:992256faa3b5cfd830573830483a411da59c10f9

-- Enter migration here

-- Drop the old unique index that doesn't include type
DROP INDEX IF EXISTS spatial_metrics_unique_metric;

-- Create the new unique index that includes type
CREATE UNIQUE INDEX spatial_metrics_unique_metric ON spatial_metrics (
  COALESCE(overlay_source_url, ''),
  COALESCE(source_processing_job_dependency, ''),
  COALESCE(subject_fragment_id, ''),
  COALESCE(subject_geography_id, -999999),
  type,
  parameters
);

CREATE OR REPLACE FUNCTION public.get_or_create_spatial_metric(p_subject_fragment_id text, p_subject_geography_id integer, p_type public.spatial_metric_type, p_overlay_source_url text, p_overlay_group_by text, p_included_properties text[], p_source_processing_job_dependency text, p_project_id integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    metric_id bigint;
    metric_parameters jsonb;
  begin
    -- Validation
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
    
    -- Build parameters jsonb from group_by
    if p_overlay_group_by is not null then
      metric_parameters := jsonb_build_object('groupBy', p_overlay_group_by);
    else
      metric_parameters := '{}'::jsonb;
    end if;
    
    -- Try to get existing metric first (matching the unique index logic)
    select id into metric_id
    from spatial_metrics
    where coalesce(overlay_source_url, '') = coalesce(p_overlay_source_url, '')
      and coalesce(source_processing_job_dependency, '') = coalesce(p_source_processing_job_dependency, '')
      and coalesce(subject_fragment_id, '') = coalesce(p_subject_fragment_id, '')
      and coalesce(subject_geography_id, -999999) = coalesce(p_subject_geography_id, -999999)
      and type = p_type
      and parameters = metric_parameters;
    
    -- If not found, insert new metric
    if metric_id is null then
      insert into spatial_metrics (
        subject_fragment_id,
        subject_geography_id,
        type,
        overlay_source_url,
        source_processing_job_dependency,
        project_id,
        parameters
      ) values (
        p_subject_fragment_id,
        p_subject_geography_id,
        p_type,
        p_overlay_source_url,
        p_source_processing_job_dependency,
        p_project_id,
        metric_parameters
      )
      returning id into metric_id;
    end if;
    
    return get_spatial_metric(metric_id);
  end;
$$;
