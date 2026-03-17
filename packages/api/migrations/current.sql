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
