--! Previous: sha1:e5b2e1bb4044d3e81fa3355f0a0bed9289687a86
--! Hash: sha1:7141afb3f3cc8923e5b16a64ceaaef0645c2972a

-- Enter migration here
alter table source_processing_jobs add column if not exists duration interval;
alter table spatial_metrics add column if not exists duration interval;

CREATE OR REPLACE FUNCTION public.get_metrics_for_geography(geography_id integer) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
  begin
    if not session_has_project_access((select project_id from project_geography where id = geography_id limit 1)) then
      raise exception 'Permission denied';
    end if;
    return (
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'type', type,
          'updatedAt', updated_at,
          'createdAt', created_at,
          'value', value,
          'state', state,
          'sourceUrl', overlay_source_url,
          'sourceType', extension_to_source_type(overlay_source_url),
          'groupBy', overlay_group_by,
          'includedProperties', included_properties,
          'subject', jsonb_build_object('id', subject_geography_id, '__typename', 'GeographySubject'),
          'errorMessage', error_message,
          'progress', progress_percentage,
          'jobKey', job_key,
          'sourceProcessingJobDependency', source_processing_job_dependency,
          'eta', eta,
          'startedAt', started_at,
          'durationSeconds', extract(seconds from duration)::float
        )
      )
      from spatial_metrics
      where subject_geography_id = geography_id
    );
  end;
  $$;

CREATE OR REPLACE FUNCTION public.get_metrics_for_sketch(skid integer) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
  declare
    policy_passed boolean;
    hash_fragments text[];
  begin
    policy_passed := check_sketch_rls_policy(skid);
    if not policy_passed then
      raise exception 'Permission denied';
    end if;
    select array_agg(hash) into hash_fragments
    from get_fragment_ids_for_sketch_recursive(skid);
    return (
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'type', type,
          'updatedAt', updated_at,
          'createdAt', created_at,
          'value', value,
          'state', state,
          'sourceUrl', overlay_source_url,
          'sourceType', extension_to_source_type(overlay_source_url),
          'groupBy', overlay_group_by,
          'includedProperties', included_properties,
          'subject', jsonb_build_object('hash', subject_fragment_id, 'sketches', (select array_agg(sketch_id) from sketch_fragments where fragment_hash = subject_fragment_id), 'geographies', (select array_agg(geography_id) from fragment_geographies where fragment_hash = subject_fragment_id), '__typename', 'FragmentSubject'),
          'errorMessage', error_message,
          'progress', progress_percentage,
          'jobKey', job_key,
          'sourceProcessingJobDependency', source_processing_job_dependency,
          'eta', eta,
          'startedAt', started_at,
          'durationSeconds', extract(seconds from duration)::float
        )
      )
      from spatial_metrics
      where subject_fragment_id = any(hash_fragments)
      and subject_geography_id is null
    );
  end;
  $$;

CREATE OR REPLACE FUNCTION public.get_spatial_metric(metric_id bigint) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
  declare
    policy_passed boolean;
    subj_geography_id integer;
    subj_fragment_id text;
  begin
    select subject_geography_id, subject_fragment_id into subj_geography_id, subj_fragment_id
    from spatial_metrics
    where id = metric_id;
    if current_user not in ('graphile_worker', 'postgres') then
      if subj_geography_id is not null then
        if not session_has_project_access((select project_id from project_geography where id = subj_geography_id limit 1)) then
          raise exception 'Permission denied';
        end if;
      else
        policy_passed := check_sketch_rls_policy((select sketch_id from sketch_fragments where fragment_hash = subj_fragment_id limit 1));
        if not policy_passed then
          raise exception 'Permission denied';
        end if;
      end if;
    end if;
    return (
      select jsonb_build_object(
        'id', id,
        'type', type,
        'updatedAt', updated_at,
        'createdAt', created_at,
        'value', value,
        'state', state,
        'sourceUrl', overlay_source_url,
        'sourceType', extension_to_source_type(overlay_source_url),
        'groupBy', overlay_group_by,
        'includedProperties', included_properties,
        'jobKey', job_key,
        'subject', 
        case when subject_geography_id is not null then
          jsonb_build_object('id', subject_geography_id, '__typename', 'GeographySubject')
        else
          jsonb_build_object('hash', subject_fragment_id, 'sketches', (select array_agg(sketch_id) from sketch_fragments where fragment_hash = subject_fragment_id), 'geographies', (select array_agg(geography_id) from fragment_geographies where fragment_hash = subject_fragment_id), '__typename', 'FragmentSubject')
        end,
        'errorMessage', error_message,
        'progress', progress_percentage,
        'sourceProcessingJobDependency', source_processing_job_dependency,
        'eta', eta,
        'startedAt', started_at,
        'durationSeconds', extract(seconds from duration)::float
      ) from spatial_metrics where id = metric_id
    );
  end;
  $$;

alter table source_processing_jobs drop column if exists duration_seconds;
alter table source_processing_jobs add column if not exists duration_seconds float generated always as (extract(epoch from duration)::float) stored;
