-- Enter migration here
drop table if exists metric_work_chunks;
drop table if exists spatial_metrics cascade;
drop table if exists metric_work_chunk;


drop type if exists spatial_metric_type cascade;
drop type if exists spatial_metric_state cascade;
drop type if exists metric_overlay_type;
drop type if exists metric_execution_environment;


create type spatial_metric_state as enum ('queued', 'processing', 'complete', 'error');

create type metric_overlay_type as enum ('vector', 'raster');

create type metric_execution_environment as enum ('lambda', 'api_server');

create type spatial_metric_type as enum ('total_area', 'count', 'presence', 'presence_table', 'contextualized_mean', 'overlay_area');

create table spatial_metrics (
  id bigint generated always as identity primary key,
  subject_fragment_id text references fragments(hash) on delete cascade,
  subject_geography_id int references project_geography(id) on delete cascade,
  type spatial_metric_type not null,
  overlay_layer_stable_id text,
  overlay_source_remote text,
  overlay_group_by text,
  included_properties text[],
  value jsonb,
  state spatial_metric_state not null default 'queued',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  overlay_type metric_overlay_type,
  progress_percentage int not null default 0,
  logs_url text,
  logs_expires_at timestamptz,
  job_key text default gen_random_uuid()::text,
  constraint spatial_metrics_exclusive_reference 
    check (
      (subject_fragment_id is not null and subject_geography_id is null) or
      (subject_fragment_id is null and subject_geography_id is not null)
    )

);

comment on table spatial_metrics is '@omit';


-- Create get_or_create_spatial_metric function
CREATE OR REPLACE FUNCTION get_or_create_spatial_metric(
    p_subject_fragment_id text DEFAULT NULL,
    p_subject_geography_id int DEFAULT NULL,
    p_type spatial_metric_type DEFAULT NULL,
    p_overlay_layer_stable_id text DEFAULT NULL,
    p_overlay_source_remote text DEFAULT NULL,
    p_overlay_group_by text DEFAULT NULL,
    p_included_properties text[] DEFAULT NULL,
    p_overlay_type metric_overlay_type DEFAULT NULL
) RETURNS spatial_metrics
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    metric spatial_metrics;
    found_metric boolean := false;
BEGIN
    -- Validate that exactly one subject ID is provided and type is not null
    IF (p_subject_fragment_id IS NULL AND p_subject_geography_id IS NULL) OR 
       (p_subject_fragment_id IS NOT NULL AND p_subject_geography_id IS NOT NULL) THEN
        RAISE EXCEPTION 'Exactly one of subject_fragment_id or subject_geography_id must be provided';
    END IF;
    
    IF p_type IS NULL THEN
        RAISE EXCEPTION 'type parameter is required';
    END IF;
    
    -- Try to find existing metric using comprehensive query that matches unique indexes
    IF p_subject_fragment_id IS NOT NULL THEN
        -- Fragment-based metric - check for existing record
        SELECT * INTO metric
        FROM spatial_metrics
        WHERE subject_fragment_id = p_subject_fragment_id
          AND type::text = p_type::text
          AND COALESCE(overlay_layer_stable_id, '') = COALESCE(p_overlay_layer_stable_id, '')
          AND COALESCE(overlay_source_remote, '') = COALESCE(p_overlay_source_remote, '')
          AND COALESCE(overlay_group_by, '') = COALESCE(p_overlay_group_by, '')
          AND COALESCE(overlay_type::text, '') = COALESCE(p_overlay_type::text, '')
        ORDER BY created_at DESC
        LIMIT 1;
        
        found_metric := FOUND;
    ELSE
        -- Geography-based metric - check for existing record
        SELECT * INTO metric
        FROM spatial_metrics
        WHERE subject_geography_id = p_subject_geography_id
          AND type::text = p_type::text
          AND COALESCE(overlay_layer_stable_id, '') = COALESCE(p_overlay_layer_stable_id, '')
          AND COALESCE(overlay_source_remote, '') = COALESCE(p_overlay_source_remote, '')
          AND COALESCE(overlay_group_by, '') = COALESCE(p_overlay_group_by, '')
          AND COALESCE(overlay_type::text, '') = COALESCE(p_overlay_type::text, '')
        ORDER BY created_at DESC
        LIMIT 1;
        
        found_metric := FOUND;
    END IF;
    
    -- If found, return existing record
    IF found_metric THEN
        RETURN metric;
    END IF;
    
    -- If not found, create new metric
    INSERT INTO spatial_metrics (
        subject_fragment_id,
        subject_geography_id,
        type,
        overlay_layer_stable_id,
        overlay_source_remote,
        overlay_group_by,
        included_properties,
        overlay_type
    ) VALUES (
        p_subject_fragment_id,
        p_subject_geography_id,
        p_type,
        p_overlay_layer_stable_id,
        p_overlay_source_remote,
        p_overlay_group_by,
        p_included_properties,
        p_overlay_type
    ) RETURNING * INTO metric;
    
    RETURN metric;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_or_create_spatial_metric TO anon;


-- Create batch function to get or create metrics for multiple fragments
CREATE OR REPLACE FUNCTION get_or_create_spatial_metrics_for_fragments(
    p_subject_fragments text[],
    p_type spatial_metric_type DEFAULT NULL,
    p_overlay_layer_stable_id text DEFAULT NULL,
    p_overlay_source_remote text DEFAULT NULL,
    p_overlay_group_by text DEFAULT NULL,
    p_included_properties text[] DEFAULT NULL,
    p_overlay_type metric_overlay_type DEFAULT NULL
) RETURNS bigint[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    fragment_hash text;
    metric_row spatial_metrics;
    metric_ids bigint[] := ARRAY[]::bigint[];
BEGIN
    IF p_type IS NULL THEN
        RAISE EXCEPTION 'type parameter is required';
    END IF;

    IF p_subject_fragments IS NULL OR array_length(p_subject_fragments, 1) IS NULL THEN
        RETURN metric_ids;
    END IF;

    FOREACH fragment_hash IN ARRAY p_subject_fragments LOOP
        IF fragment_hash IS NULL THEN
            CONTINUE;
        END IF;
        metric_row := get_or_create_spatial_metric(
            p_subject_fragment_id => fragment_hash,
            p_subject_geography_id => NULL,
            p_type => p_type,
            p_overlay_layer_stable_id => p_overlay_layer_stable_id,
            p_overlay_source_remote => p_overlay_source_remote,
            p_overlay_group_by => p_overlay_group_by,
            p_included_properties => p_included_properties,
            p_overlay_type => p_overlay_type
        );
        metric_ids := array_append(metric_ids, metric_row.id);
    END LOOP;

    RETURN metric_ids;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_or_create_spatial_metrics_for_fragments TO anon;



comment on function public.get_or_create_spatial_metrics_for_fragments is '@omit';

create or replace function get_fragment_hashes_for_sketch(sketch_id integer) returns text[]
  language plpgsql
  security definer
  stable
  as $$
    declare
    fragment_hashes text[];
    policy_passed boolean;
    sketch_ids integer[];
  begin
    policy_passed := check_sketch_rls_policy(sketch_id);
    if not policy_passed then
      raise exception 'Permission denied';
    end if;
-- get ids of all children of the sketch, if it is a collection
    -- initialize and add the sketch id to the list
    sketch_ids := ARRAY[]::integer[];
    sketch_ids := array_append(sketch_ids, sketch_id);
    -- concatenate ids of all children of the sketch, if it is a collection
    sketch_ids := array_cat(
      sketch_ids,
      coalesce((
        SELECT get_child_sketches_recursive(sketch_id, 'sketch')
      ), ARRAY[]::integer[])
    );
    select array_agg(fragment_hash) into fragment_hashes
    from fragments
    inner join sketch_fragments on sketch_fragments.fragment_hash = fragments.hash
    where sketch_fragments.sketch_id = any(sketch_ids);
    return fragment_hashes;
  end;
  $$;

comment on function public.get_fragment_hashes_for_sketch is '@omit';

grant execute on function public.get_fragment_hashes_for_sketch to anon;

CREATE OR REPLACE FUNCTION public.get_fragment_ids_for_sketch_recursive(sketch_id integer) RETURNS TABLE(hash text, sketches integer[], geographies integer[])
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    policy_passed boolean;
    sketch_ids integer[];
  begin
    -- Check that the session can access the given sketch using RLS policy
    policy_passed := check_sketch_rls_policy(sketch_id);
    if not policy_passed then
      raise exception 'Permission denied';
    end if;

    -- get ids of all children of the sketch, if it is a collection
    -- initialize and add the sketch id to the list
    sketch_ids := ARRAY[]::integer[];
    sketch_ids := array_append(sketch_ids, sketch_id);
    -- concatenate ids of all children of the sketch, if it is a collection
    sketch_ids := array_cat(
      sketch_ids,
      coalesce((
        SELECT get_child_sketches_recursive(sketch_id, 'sketch')
      ), ARRAY[]::integer[])
    );

    return query
    SELECT
    fragments.hash,
    ARRAY(
      SELECT sketch_fragments.sketch_id
      FROM sketch_fragments
      WHERE sketch_fragments.fragment_hash = fragments.hash AND sketch_fragments.sketch_id = ANY(sketch_ids)
    ) AS sketches,
    ARRAY(
      SELECT fragment_geographies.geography_id
      FROM fragment_geographies
      WHERE fragment_geographies.fragment_hash = fragments.hash) AS geographies
    FROM fragments
    WHERE
    EXISTS (
      SELECT 1
      FROM sketch_fragments
      WHERE sketch_fragments.fragment_hash = fragments.hash
        AND sketch_fragments.sketch_id = ANY(sketch_ids)
    );
  end;
  $$;


grant execute on function public.get_fragment_ids_for_sketch_recursive to anon;

comment on function public.get_fragment_ids_for_sketch_recursive is '@omit';

create or replace function sketches_related_fragments(sketch sketches) returns table(hash text, sketches integer[], geographies integer[])
    language sql
    stable
    as $$
      select * from get_fragment_ids_for_sketch_recursive(sketch.id);
  $$;

grant execute on function public.sketches_related_fragments to anon;

comment on function public.sketches_related_fragments is '@simpleCollections only';

create or replace function sketches_siblings(sketch sketches) returns
  setof sketches
  language plpgsql
  security definer
  stable
  as $$
  declare
    policy_passed boolean;
    coll_id integer;
  begin
    policy_passed := check_sketch_rls_policy(sketch.id);
    if not policy_passed then
      raise exception 'Permission denied';
    end if;
    

    coll_id := coalesce(get_parent_collection_id(sketch),sketch.id);

    return query
    select * from sketches
    where
      id = any(get_child_sketches_recursive(coll_id, 'sketch'));
  end;
  $$;

grant execute on function public.sketches_siblings to anon;

comment on function public.sketches_siblings is '@simpleCollections only';

create or replace function sketches_children(sketch sketches) returns
  setof sketches
  language plpgsql
  security definer
  stable
  as $$
  declare
    policy_passed boolean;
  begin
    policy_passed := check_sketch_rls_policy(sketch.id);
    if not policy_passed then
      raise exception 'Permission denied';
    end if;
    return query
    select * from sketches
    where
      id = any(get_child_sketches_recursive(sketch.id, 'sketch'));
  end;
  $$;

grant execute on function public.sketches_children to anon;

comment on function public.sketches_children is '@simpleCollections only';

grant execute on function get_parent_collection_id(sketches) to anon;

comment on function public.get_parent_collection_id(sketches) is '@omit';


drop type if exists geography_subject cascade;

create or replace function get_metrics_for_geography(geography_id integer)
  returns jsonb
  language plpgsql
  security definer
  stable
  as $$
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
          'stableId', overlay_layer_stable_id,
          'groupBy', overlay_group_by,
          'includedProperties', included_properties,
          'subject', jsonb_build_object('id', subject_geography_id, '__typename', 'GeographySubject'),
          'errorMessage', error_message,
          'progress', progress_percentage,
          'jobKey', job_key
        )
      )
      from spatial_metrics
      where subject_geography_id = geography_id
    );
  end;
  $$;

grant execute on function public.get_metrics_for_geography to anon;

comment on function public.get_metrics_for_geography is '@omit';

drop function if exists get_metrics_for_sketch;
create or replace function get_metrics_for_sketch(skid integer)
  returns jsonb
  language plpgsql
  security definer
  stable
  as $$
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
          'stableId', overlay_layer_stable_id,
          'groupBy', overlay_group_by,
          'includedProperties', included_properties,
          'subject', jsonb_build_object('hash', subject_fragment_id, 'sketches', (select array_agg(sketch_id) from sketch_fragments where fragment_hash = subject_fragment_id), 'geographies', (select array_agg(geography_id) from fragment_geographies where fragment_hash = subject_fragment_id), '__typename', 'FragmentSubject'),
          'errorMessage', error_message,
          'progress', progress_percentage,
          'jobKey', job_key
        )
      )
      from spatial_metrics
      where subject_fragment_id = any(hash_fragments)
      and subject_geography_id is null
    );
  end;
  $$;

grant execute on function public.get_metrics_for_sketch to anon;

comment on function public.get_metrics_for_sketch is '@omit';


create or replace function get_spatial_metric(metric_id bigint)
  returns jsonb
  language plpgsql
  security definer
  stable
  as $$
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
        'stableId', overlay_layer_stable_id,
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
        'progress', progress_percentage
      ) from spatial_metrics where id = metric_id
    );
  end;
  $$;

grant execute on function public.get_spatial_metric to anon;

comment on function public.get_spatial_metric is '@omit';

-- whenever a spatial metric is updated with a subject_geography_id, trigger the
-- graphql subscription topic for the geography
create or replace function trigger_geography_metric_subscription()
  returns trigger
  language plpgsql
  security definer
  stable
  as $$
  declare
    pid integer;
    skid integer;
  begin
    if NEW.subject_geography_id is not null then
      select project_id into pid from project_geography where id = NEW.subject_geography_id limit 1;
      perform pg_notify(
        'graphql:projects:' || pid || ':geography-metrics',
        '{"metricId": ' || NEW.id || ', "geographyId": ' || NEW.subject_geography_id || ', "projectId": ' || pid || '}'
      );
    end if;
    if NEW.subject_fragment_id is not null then
      select sketch_id into skid from sketch_fragments where fragment_hash = NEW.subject_fragment_id limit 1;
      perform pg_notify(
        'graphql:sketches:' || skid || ':metrics',
        '{"metricId": ' || NEW.id || ', "sketchId": ' || skid || '}'
      );
    end if;
    return NEW;
  end;
  $$;

-- setup trigger to call trigger_geography_metric_subscription when spatial_metrics.subject_geography_id is updated
create trigger trigger_geography_metric_subscription_trigger
  after update on spatial_metrics
  for each row
  execute function trigger_geography_metric_subscription();

create or replace function session_can_access_sketch(skid integer)
  returns boolean
  language sql
  stable
  security definer
  as $$
  select check_sketch_rls_policy(skid);
  $$;

grant execute on function public.session_can_access_sketch to anon;

comment on function public.session_can_access_sketch is '@omit';

-- create a trigger to queue the caclulateSpatialMetric task after a 
-- spatial_metrics insert (that is queued)

create or replace function queue_calculate_spatial_metric_task()
  returns trigger
  language plpgsql
  security definer
  stable
  as $$
  begin
    if NEW.state = 'queued' then
      perform graphile_worker.add_job(
        'calculateSpatialMetric',
        json_build_object('metricId', NEW.id),
        max_attempts := 1,
        job_key := 'calculateSpatialMetric:' || NEW.id,
        job_key_mode := 'replace'
      );
    end if;
    return NEW;
  end;
  $$;

create trigger queue_calculate_spatial_metric_task_trigger
  after insert on spatial_metrics
  for each row
  execute function queue_calculate_spatial_metric_task();

-- create an index to support finding spatial metrics that are queued, and have a created_at older than some period of time
create index if not exists spatial_metrics_queued_created_at_idx on spatial_metrics (created_at) where state = 'queued';

drop function if exists retry_failed_spatial_metrics;
create or replace function retry_failed_spatial_metrics(metric_ids bigint[])
  returns boolean
  security definer
  language plpgsql
  as $$
  declare
    metric spatial_metrics;
    updated_metric_id bigint;
    metric_id bigint;
  begin
    -- loop through the metric ids, and update the state to queued
    foreach metric_id in array metric_ids loop
      update spatial_metrics set state = 'queued', error_message = null, updated_at = now(), created_at = now(), progress_percentage = 0, job_key = gen_random_uuid()::text where id = metric_id returning id into updated_metric_id;
      if updated_metric_id is not null then
        perform graphile_worker.add_job(
          'calculateSpatialMetric',
          json_build_object('metricId', updated_metric_id),
          max_attempts := 1,
          job_key := 'calculateSpatialMetric:' || updated_metric_id,
          job_key_mode := 'replace'
        );
      end if;
    end loop;
    return true;
  end;
  $$;

grant execute on function public.retry_failed_spatial_metrics to anon;
