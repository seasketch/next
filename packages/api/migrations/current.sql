-- Enter migration here
drop table if exists fragment_geographies cascade;
drop table if exists sketch_fragments cascade;
drop table if exists fragments cascade;
drop type if exists fragment_input cascade;

create table fragments (
  id int primary key generated always as identity,
  geometry geometry(MultiPolygon, 4326) not null,
  -- calculated geometry hash. generated from normalized geometry in binary form
  hash text not null generated always as (md5(st_asbinary(st_normalize(geometry)))) stored,
  -- ensure geometry doesn't span the antimeridian
  constraint no_antimeridian_span check (
    st_xmin(geometry) >= -180 and st_xmax(geometry) <= 180
  ),
  -- ensure no duplicate fragments
  constraint unique_fragment_hash unique (hash)
);

create table sketch_fragments (
  sketch_id int not null references sketches(id) on delete cascade,
  fragment_id int not null references fragments(id) on delete cascade,
  primary key (sketch_id, fragment_id)
);

create table fragment_geographies (
  fragment_id int not null references fragments(id) on delete cascade,
  geography_id int not null references project_geography(id) on delete cascade,
  primary key (fragment_id, geography_id)
);

create index if not exists sketch_fragments_sketch_id_idx on sketch_fragments (sketch_id);
create index if not exists sketch_fragments_fragment_id_idx on sketch_fragments (fragment_id);

create index if not exists fragment_geographies_fragment_id_idx on fragment_geographies (fragment_id);
create index if not exists fragment_geographies_geography_id_idx on fragment_geographies (geography_id);

create index if not exists fragments_hash_idx on fragments (hash);

-- Type for input geometry with associated geographies
create type fragment_input as (
  geometry geometry(MultiPolygon, 4326),
  geography_ids int[]
);

-- Function to update fragments for a sketch
create or replace function update_sketch_fragments(
  p_sketch_id int,
  p_fragments fragment_input[]
) returns void as $$
declare
  v_fragment fragment_input;
  v_hash text;
  v_fragment_id int;
  v_geography_id int;
  v_existing_fragment_ids int[];
  v_user_id int;
begin
  -- Get current user ID from session
  v_user_id := nullif(current_setting('session.user_id', TRUE), '')::int;
  
  -- Verify ownership
  if not exists (
    select 1 from sketches 
    where id = p_sketch_id 
    and user_id = v_user_id
  ) then
    raise exception 'Permission denied';
  end if;

  -- Start transaction
  begin
    -- Get existing fragment IDs for this sketch
    select array_agg(fragment_id) into v_existing_fragment_ids
    from sketch_fragments
    where sketch_id = p_sketch_id;

    -- Process each input fragment
    foreach v_fragment in array p_fragments
    loop
      -- Calculate hash for the geometry
      v_hash := md5(st_asbinary(st_normalize(v_fragment.geometry)));

      -- Try to find existing fragment with this hash
      select id into v_fragment_id
      from fragments
      where hash = v_hash;

      -- If no existing fragment found, create new one
      if v_fragment_id is null then
        insert into fragments (geometry)
        values (v_fragment.geometry)
        returning id into v_fragment_id;
      end if;

      -- Ensure sketch-fragment relationship exists
      insert into sketch_fragments (sketch_id, fragment_id)
      values (p_sketch_id, v_fragment_id)
      on conflict (sketch_id, fragment_id) do nothing;

      -- Update geography associations
      -- First remove all existing geography associations for this fragment
      delete from fragment_geographies
      where fragment_id = v_fragment_id;

      -- Then add new geography associations
      foreach v_geography_id in array v_fragment.geography_ids
      loop
        insert into fragment_geographies (fragment_id, geography_id)
        values (v_fragment_id, v_geography_id);
      end loop;
    end loop;

    -- Remove sketch-fragment relationships for fragments that are no longer used
    delete from sketch_fragments
    where sketch_id = p_sketch_id
    and fragment_id = any(v_existing_fragment_ids)
    and fragment_id not in (
      select id from fragments where hash in (
        select md5(st_asbinary(st_normalize((unnest(p_fragments)).geometry)))
      )
    );

    -- Delete orphaned fragments (those not associated with any sketch)
    delete from fragments
    where id in (
      select f.id
      from fragments f
      left join sketch_fragments sf on f.id = sf.fragment_id
      where sf.fragment_id is null
    );

  exception
    when others then
      raise exception 'Error updating sketch fragments: %', sqlerrm;
  end;
end;
$$ language plpgsql security definer;

-- Grant execute permissions on update_sketch_fragments
grant execute on function update_sketch_fragments to seasketch_user;

-- Function to get fragments for a sketch
create or replace function sketches_fragments(s sketches)
  returns setof fragments
  language sql
  stable
  security definer
  as $$
    select fragments.*
    from fragments
    join sketch_fragments on fragments.id = sketch_fragments.fragment_id
    where sketch_fragments.sketch_id = s.id;
  $$;

grant execute on function sketches_fragments to seasketch_user;

grant select, update, delete on sketch_fragments to seasketch_user;

alter table sketch_fragments enable row level security;

create policy "Enable users to edit their own sketch fragments" on sketch_fragments for all using (
  exists (
    select 1 from sketches 
    where user_id = current_setting('session.user_id', true)::int 
    and id = sketch_id
  )
);

create policy "Enable users to view relation between sketches and fragments" on sketch_fragments for select using (
  true
);

-- Function to copy fragment associations between sketches
create or replace function copy_sketch_fragments(from_sketch_id int, to_sketch_id int)
returns void as $$
declare
  policy_passed BOOLEAN;
begin
  policy_passed := check_sketch_rls_policy(from_sketch_id);
  if not policy_passed then
    raise exception 'Source sketch not found';
  end if;
  policy_passed := check_sketch_rls_policy(to_sketch_id);
  if not policy_passed then
    raise exception 'Target sketch not found';
  end if;

  -- Copy fragment associations
  insert into sketch_fragments (sketch_id, fragment_id)
  select to_sketch_id, fragment_id
  from sketch_fragments
  where sketch_fragments.sketch_id = from_sketch_id;
end;
$$ language plpgsql security definer;

grant execute on function copy_sketch_fragments to seasketch_user;

comment on function copy_sketch_fragments is E'@omit';

CREATE OR REPLACE FUNCTION public.copy_sketch(sketch_id integer, clear_parent boolean) RETURNS public.sketches
    LANGUAGE plpgsql
    AS $$
    declare 
      output sketches;
    begin
      -- this will check RLS policy. DO NOT use security definer!
      if (select exists (select id from sketches where id = copy_sketch.sketch_id)) then
        insert into sketches (
          user_id,
          copy_of,
          name,
          sketch_class_id,
          collection_id,
          folder_id,
          user_geom,
          geom,
          properties
        ) select
          nullif(current_setting('session.user_id', TRUE), '')::int,
          copy_sketch.sketch_id,
          name,
          sketch_class_id,
          CASE WHEN clear_parent THEN NULL ELSE collection_id END,
          CASE WHEN clear_parent THEN NULL ELSE folder_id END,
          user_geom,
          geom,
          properties
        from sketches where id = copy_sketch.sketch_id returning * into output;

        -- Copy fragment associations using the new function
        perform copy_sketch_fragments(copy_sketch.sketch_id, output.id);

        return output;
      else
        raise exception 'Permission denied';
      end if;
    end;
  $$;

grant select on fragment_geographies to anon;

comment on table sketch_fragments is E'@omit
Associations between sketches and fragments';

comment on table fragment_geographies is E'@omit
Associations between fragments and geographies';

comment on table fragments is E'@omit
Fragments are the core data structure for sketches. They are used to store the geometry of a sketch, and are associated with geographies.';

comment on function update_sketch_fragments is E'@omit';

comment on type fragment_input is E'@omit';

comment on table fragments is E'@omit';