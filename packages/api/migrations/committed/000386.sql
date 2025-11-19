--! Previous: sha1:992256faa3b5cfd830573830483a411da59c10f9
--! Hash: sha1:d20b263713b6677759f13ddf403126ce0e0de22e

-- Enter migration here
drop function if exists get_or_create_spatial_metric;
CREATE FUNCTION public.get_or_create_spatial_metric(p_subject_fragment_id text, p_subject_geography_id integer, p_type public.spatial_metric_type, p_overlay_source_url text, p_parameters jsonb, p_source_processing_job_dependency text, p_project_id integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    metric_id bigint;
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
        
    -- Try to get existing metric first (matching the unique index logic)
    select id into metric_id
    from spatial_metrics
    where coalesce(overlay_source_url, '') = coalesce(p_overlay_source_url, '')
      and coalesce(source_processing_job_dependency, '') = coalesce(p_source_processing_job_dependency, '')
      and coalesce(subject_fragment_id, '') = coalesce(p_subject_fragment_id, '')
      and coalesce(subject_geography_id, -999999) = coalesce(p_subject_geography_id, -999999)
      and type = p_type
      and parameters = p_parameters;
    
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
        p_parameters
      )
      returning id into metric_id;
    end if;
    
    return get_spatial_metric(metric_id);
  end;
$$;

grant execute on function get_or_create_spatial_metric to anon;
