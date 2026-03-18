--! Previous: sha1:6266efde7585d7dbd9d807cd958ee2840b6ef603
--! Hash: sha1:3ee6831408f1f9353839d9f0c4c1f7f6c2567ac7

-- Enter migration here
alter table public.sketch_classes
  add column if not exists preview_new_reports boolean not null default false;

GRANT UPDATE(preview_new_reports) ON TABLE public.sketch_classes TO seasketch_user;

-- Batch fragment hash lookup for multiple sketches (avoids N queries in ensureCollectionFragments)
create or replace function get_fragment_hashes_for_sketches(sketch_ids int[])
returns table(sketch_id int, fragment_hashes text[])
language plpgsql
security definer
stable
as $$
begin
  return query
  select sf.sketch_id::int, array_agg(f.hash)::text[] as fragment_hashes
  from sketch_fragments sf
  join fragments f on f.hash = sf.fragment_hash
  where sf.sketch_id = any(sketch_ids)
    and check_sketch_rls_policy(sf.sketch_id)
  group by sf.sketch_id;
end;
$$;

comment on function public.get_fragment_hashes_for_sketches is '@omit';
grant execute on function public.get_fragment_hashes_for_sketches to anon;

create or replace function projects_sketches_missing_fragments(project projects)
  returns integer
  stable
  security definer
  language plpgsql
  as $$
    declare
      num_missing_fragments integer;
    begin
    if session_is_admin(project.id) then
      if project.enable_report_builder then
        with sketch_class_ids as (
          select 
            id 
          from 
            sketch_classes 
          where 
            project_id = project.id
            and geometry_type = 'POLYGON'
            and (
              is_geography_clipping_enabled = true
              or preview_new_reports = true
            )
        )
        select count(*) into num_missing_fragments from sketches where sketch_class_id = any(select id from sketch_class_ids) and not exists (
          select 1 from sketch_fragments where sketch_fragments.sketch_id = sketches.id
        );
        return num_missing_fragments;
      else
        return 0;
      end if;
    else
      raise exception 'Must be a project admin to view missing fragments';
    end if;
    end;
  $$;

grant execute on function projects_sketches_missing_fragments to seasketch_user;

-- Drop the old projects_* computed column function (replaced by plugin resolver calling sketches_fragment_generation_in_progress)
drop function if exists projects_sketches_fragment_generation_in_progress(projects);

-- Returns true if ensureSketchFragments or generateMissingFragmentsForProject jobs
-- are queued or running for this project. SECURITY DEFINER so it can read graphile_worker.jobs.
-- Call from GeographyPlugin; checks session_is_admin before returning.
create or replace function sketches_fragment_generation_in_progress(p_project_id int)
  returns boolean
  stable
  security definer
  language plpgsql
  as $$
    begin
      if not session_is_admin(p_project_id) then
        return false;
      end if;
      return exists (
        select 1 from graphile_worker.jobs
        where task_identifier in ('ensureSketchFragments', 'generateMissingFragmentsForProject')
          and (payload->>'projectId')::int = p_project_id
          and attempts < max_attempts and last_error is null
      );
    end;
  $$;

comment on function sketches_fragment_generation_in_progress is 'True when fragment generation jobs are queued or running for this project. Call from GeographyPlugin.';
grant execute on function sketches_fragment_generation_in_progress to seasketch_user;

create or replace function get_sketch_class_fragment_status(p_project_id int)
  returns table (
    sketch_class_id int,
    sketch_class_name text,
    missing_count int
  )
  stable
  security definer
  language plpgsql
  as $$
    begin
      if not session_is_admin(p_project_id) then
        return;
      end if;

      if not exists (
        select 1
        from projects
        where id = p_project_id
          and enable_report_builder = true
      ) then
        return;
      end if;

      return query
      select
        sc.id as sketch_class_id,
        sc.name::text as sketch_class_name,
        count(s.id)::int as missing_count
      from sketch_classes sc
      join sketches s on s.sketch_class_id = sc.id
      where sc.project_id = p_project_id
        and sc.geometry_type = 'POLYGON'
        and (
          sc.is_geography_clipping_enabled = true
          or coalesce(sc.preview_new_reports, false) = true
        )
        and not exists (
          select 1
          from sketch_fragments sf
          where sf.sketch_id = s.id
        )
      group by sc.id, sc.name
      order by count(s.id) desc, sc.name asc;
    end;
  $$;

comment on function public.get_sketch_class_fragment_status is '@omit';
grant execute on function public.get_sketch_class_fragment_status to seasketch_user;

create or replace function get_sketch_fragment_job_details(p_project_id int)
  returns table (
    id bigint,
    task_identifier text,
    key text,
    payload json,
    run_at timestamptz,
    attempts int,
    max_attempts int,
    last_error text,
    created_at timestamptz,
    updated_at timestamptz,
    locked_at timestamptz
  )
  stable
  security definer
  language plpgsql
  as $$
    begin
      if not session_is_admin(p_project_id) then
        return;
      end if;

      return query
      select
        j.id,
        j.task_identifier,
        j.key,
        j.payload::json,
        j.run_at,
        j.attempts,
        j.max_attempts,
        j.last_error,
        j.created_at,
        j.updated_at,
        j.locked_at
      from graphile_worker.jobs j
      where j.task_identifier = 'ensureSketchFragments'
        and (j.payload->>'projectId')::int = p_project_id
        and (
          (j.attempts < j.max_attempts and j.last_error is null)
          or (
            j.last_error is not null
            and j.updated_at >= now() - interval '24 hours'
          )
        )
      order by coalesce(j.locked_at, j.updated_at, j.run_at) desc, j.id desc;
    end;
  $$;

comment on function public.get_sketch_fragment_job_details is '@omit';
grant execute on function public.get_sketch_fragment_job_details to seasketch_user;

CREATE OR REPLACE FUNCTION public.update_sketch_fragments(p_sketch_id integer, p_fragments public.fragment_input[], p_fragment_deletion_scope text[] DEFAULT NULL::text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_fragment fragment_input;
  v_hash text;
  v_existing_fragment_hashes text[];
  v_user_id int;
  v_geography_id int;
begin
  -- Get current user ID from session
  v_user_id := nullif(current_setting('session.user_id', TRUE), '')::int;
  
  -- Verify ownership
  -- skip if role is postgres
  if current_role != 'postgres' and not exists (
    select 1 from sketches 
    where id = p_sketch_id 
    and user_id = v_user_id
  ) then
    raise exception 'Permission denied';
  end if;

  -- Start transaction
  begin
    -- Get existing fragment hashes for this sketch
    select array_agg(fragment_hash) into v_existing_fragment_hashes
    from sketch_fragments
    where sketch_id = p_sketch_id;

    -- Process each input fragment
    foreach v_fragment in array p_fragments
    loop
      -- Calculate hash for the geometry
      v_hash := md5(st_asbinary(st_normalize(v_fragment.geometry)));

      -- Try to find existing fragment with this hash
      if not exists (select 1 from fragments where hash = v_hash) then
        -- If no existing fragment found, create new one
        insert into fragments (geometry)
        values (v_fragment.geometry);
      end if;

      -- Ensure sketch-fragment relationship exists
      insert into sketch_fragments (sketch_id, fragment_hash)
      values (p_sketch_id, v_hash)
      on conflict (sketch_id, fragment_hash) do nothing;

      -- Update geography associations
      -- First remove all existing geography associations for this fragment
      delete from fragment_geographies
      where fragment_hash = v_hash;

      -- Then add new geography associations
      foreach v_geography_id in array v_fragment.geography_ids
      loop
        insert into fragment_geographies (fragment_hash, geography_id)
        values (v_hash, v_geography_id);
      end loop;
    end loop;

    -- Remove sketch-fragment relationships for fragments that are no longer used
    delete from sketch_fragments
    where sketch_id = p_sketch_id
    and fragment_hash not in (
      select md5(st_asbinary(st_normalize((unnest(p_fragments)).geometry)))
    )
    and (
      -- If p_fragment_deletion_scope is null, allow deletion of all fragments (original behavior)
      p_fragment_deletion_scope is null
      or
      -- If p_fragment_deletion_scope is provided, only delete fragments in that scope
      fragment_hash = any(p_fragment_deletion_scope)
    );

    -- Delete orphaned fragments (those not associated with any sketch)
    delete from fragments
    where hash in (
      select f.hash
      from fragments f
      left join sketch_fragments sf on f.hash = sf.fragment_hash
      where sf.fragment_hash is null
    );

  exception
    when others then
      raise exception 'Error updating sketch fragments: %', sqlerrm;
  end;
end;
$$;

-- Add FK from spatial_metrics.subject_fragment_id to fragments(hash) with ON DELETE CASCADE.
-- Only applies when subject_fragment_id is set (nullable FK; geography metrics use subject_geography_id).
-- Idempotent: DROP IF EXISTS then ADD is safe to run multiple times.
do $$
begin
  -- Delete orphaned spatial_metrics (those referencing non-existent fragments) before adding FK
  delete from spatial_metrics
  where subject_fragment_id is not null
    and not exists (select 1 from fragments where hash = subject_fragment_id);

  alter table spatial_metrics drop constraint if exists spatial_metrics_subject_fragment_id_fkey;

  alter table spatial_metrics
  add constraint spatial_metrics_subject_fragment_id_fkey
  foreign key (subject_fragment_id) references fragments(hash) on delete cascade;
end;
$$;

create or replace function delete_fragments_for_sketch_class(p_sketch_class_id int)
  returns void
  security definer
  language plpgsql
  as $$
    begin
      with deleted_refs as (
        delete from sketch_fragments
        where sketch_id in (
          select id
          from sketches
          where sketch_class_id = p_sketch_class_id
        )
        returning fragment_hash
      )
      delete from fragments
      where hash in (select fragment_hash from deleted_refs)
        and not exists (
          select 1
          from sketch_fragments
          where sketch_fragments.fragment_hash = fragments.hash
        );
    end;
  $$;

grant execute on function delete_fragments_for_sketch_class to postgres;

create or replace function update_sketch_class_geographies(
  sketch_class_id integer,
  geography_ids integer[]
)
  returns sketch_classes
  language plpgsql
  security definer
  as $$
    declare
      sketch_class sketch_classes;
      previous_geography_ids integer[];
      next_geography_ids integer[];
      geographies_changed boolean;
    begin
    if session_is_admin((select project_id from sketch_classes where id = sketch_class_id)) then
      select
        coalesce(array_agg(scg.geography_id order by scg.geography_id), '{}'::integer[])
      into previous_geography_ids
      from sketch_class_geographies scg
      where scg.sketch_class_id = update_sketch_class_geographies.sketch_class_id;

      select
        coalesce(array_agg(distinct g.geography_id order by g.geography_id), '{}'::integer[])
      into next_geography_ids
      from unnest(coalesce(geography_ids, '{}'::integer[])) as g(geography_id);

      geographies_changed := previous_geography_ids is distinct from next_geography_ids;

      delete from sketch_class_geographies
      where sketch_class_geographies.sketch_class_id = update_sketch_class_geographies.sketch_class_id;

      insert into sketch_class_geographies (sketch_class_id, geography_id)
      select sketch_class_id, geography_id
      from unnest(next_geography_ids) as t(geography_id);

      if geographies_changed then
        perform delete_fragments_for_sketch_class(update_sketch_class_geographies.sketch_class_id);
      end if;

      select * into sketch_class from sketch_classes where id = update_sketch_class_geographies.sketch_class_id;
      return sketch_class;
    else
      raise exception 'You are not authorized to update the geographies for this sketch class.';
    end if;
    end;
  $$;

grant execute on function update_sketch_class_geographies(integer, integer[]) to seasketch_user;
comment on function delete_fragments_for_sketch_class is '@omit';
