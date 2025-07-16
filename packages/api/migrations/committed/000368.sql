--! Previous: sha1:3f9e714d9e247240dffdbfc4f2d80b244bb9630f
--! Hash: sha1:b5b5d7581aecdff4c0bf6900ee0dda12964c83bf

-- Enter migration here
drop table if exists fragment_geographies cascade;
drop table if exists sketch_fragments cascade;
drop table if exists fragments cascade;
drop type if exists fragment_input cascade;

create table fragments (
  hash text primary key generated always as (md5(st_asbinary(st_normalize(geometry)))) stored,
  geometry geometry(Polygon, 4326) not null,
  -- ensure geometry doesn't span the antimeridian
  constraint no_antimeridian_span check (
    st_xmin(geometry) >= -180 and st_xmax(geometry) <= 180
  )
);

create table sketch_fragments (
  sketch_id int not null references sketches(id) on delete cascade,
  fragment_hash text not null references fragments(hash) on delete cascade,
  primary key (sketch_id, fragment_hash)
);

create table fragment_geographies (
  fragment_hash text not null references fragments(hash) on delete cascade,
  geography_id int not null references project_geography(id) on delete cascade,
  primary key (fragment_hash, geography_id)
);

create index if not exists sketch_fragments_sketch_id_idx on sketch_fragments (sketch_id);
create index if not exists sketch_fragments_fragment_hash_idx on sketch_fragments (fragment_hash);

create index if not exists fragment_geographies_fragment_hash_idx on fragment_geographies (fragment_hash);
create index if not exists fragment_geographies_geography_id_idx on fragment_geographies (geography_id);

-- Type for input geometry with associated geographies
create type fragment_input as (
  geometry geometry(Polygon, 4326),
  geography_ids int[]
);

-- Function to update fragments for a sketch
create or replace function update_sketch_fragments(
  p_sketch_id int,
  p_fragments fragment_input[],
  p_fragment_deletion_scope text[] default null
) returns void as $$
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
  if not exists (
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
    join sketch_fragments on fragments.hash = sketch_fragments.fragment_hash
    where sketch_fragments.sketch_id = s.id;
  $$;

comment on function sketches_fragments is E'@omit';

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
  insert into sketch_fragments (sketch_id, fragment_hash)
  select to_sketch_id, fragment_hash
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

CREATE OR REPLACE FUNCTION geostats_feature_count(geostats jsonb)
RETURNS integer
LANGUAGE sql
AS $$
  SELECT COALESCE(SUM((layer->>'count')::int), 0)::integer
  FROM jsonb_array_elements(geostats->'layers') AS layer
$$;

grant execute on function geostats_feature_count to anon;
comment on function geostats_feature_count is E'@omit';

drop function if exists approximate_fgb_index_size cascade;
CREATE OR REPLACE FUNCTION approximate_fgb_index_size(feature_count integer)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  index_node_size CONSTANT int := 16;
  node_item_byte_length CONSTANT int := 40;
  n int;
  num_nodes int := 0;
BEGIN
  IF feature_count = 0 THEN
    RETURN 0;
  END IF;

  n := feature_count;
  WHILE n > 1 LOOP
    num_nodes := num_nodes + n;
    n := CEIL(n::numeric / index_node_size)::int;
  END LOOP;

  num_nodes := num_nodes + 1;  -- root node

  RETURN num_nodes * node_item_byte_length;
END;
$$;

grant execute on function approximate_fgb_index_size to anon;
comment on function approximate_fgb_index_size is E'@omit';

create or replace function has_fgb_output(ds data_sources)
RETURNS boolean
LANGUAGE sql
stable
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM data_upload_outputs 
    WHERE data_source_id = ds.id 
    AND type = 'FlatGeobuf'
  )
$$;

create or replace function data_sources_approximate_fgb_index_size(ds data_sources)
RETURNS integer
LANGUAGE sql
stable
AS $$
  select
    CASE 
      WHEN has_fgb_output(ds) 
      THEN approximate_fgb_index_size(geostats_feature_count(ds.geostats))
      ELSE 0
    END
$$;

grant execute on function has_fgb_output to anon;
grant execute on function data_sources_approximate_fgb_index_size to anon;

ALTER TABLE table_of_contents_items
ADD COLUMN if not exists has_metadata boolean GENERATED ALWAYS AS (metadata IS NOT NULL) STORED;

drop function if exists table_of_contents_items_has_metadata;


CREATE INDEX IF NOT EXISTS data_upload_outputs_source_original_idx
  ON data_upload_outputs (data_source_id)
  WHERE is_original = true;


CREATE OR REPLACE FUNCTION public.table_of_contents_items_primary_download_url(item public.table_of_contents_items) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    WITH layer AS (
      SELECT * FROM data_layers WHERE id = item.data_layer_id
    )
    select
      case
        when item.enable_download = false then null
        when item.data_layer_id is null then null
        when item.is_folder = true then null
        when not table_of_contents_items_is_downloadable_source_type(item) then null 
        when item.data_source_type = 'seasketch-mvt' or 
          item.data_source_type = 'seasketch-vector' then
          (
            select 
                data_upload_outputs.url || '?download=' || data_upload_outputs.original_filename
            from 
              data_upload_outputs
            where 
              data_upload_outputs.data_source_id = (SELECT data_source_id FROM layer)
            and 
              data_upload_outputs.is_original = true
              limit 1
          )
        when item.data_source_type = 'geojson' then
          (
            select 
              url 
            from 
              data_sources 
            where id = (SELECT data_source_id FROM layer)
          ) 
        else (
          select 
            'https://arcgis-export.seasketch.org/?download=' || 
            item.title || 
            '&location=' || 
            data_sources.url || 
            '/' || 
            coalesce(data_layers.sublayer, '')
          from
            data_layers
          inner join
            data_sources
          on
            data_sources.id = data_layers.data_source_id
          where
            data_layers.id = item.data_layer_id
          limit 1
        )
      end;
  $$;

CREATE INDEX if not exists table_of_contents_items_acl_lookup_idx 
ON table_of_contents_items (project_id, is_draft, path) 
WHERE is_draft = false;

CREATE OR REPLACE FUNCTION public._session_on_toc_item_acl(lpath public.ltree) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    with test (on_acl) as (select 
      bool_and(session_on_acl(access_control_lists.id)) as bool_and
    from
      access_control_lists
    where
      table_of_contents_item_id in (
        select id from table_of_contents_items where is_draft = false and table_of_contents_items.path @> lpath
      ) and
      type != 'public') select on_acl = true or (on_acl is null and lpath is not null) from test;
  $$;


CREATE OR REPLACE FUNCTION _session_has_toc_access(item_id INT) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
WITH toc AS (
  SELECT id, path
  FROM table_of_contents_items
  WHERE id = item_id AND NOT is_draft
),
parents AS (
  SELECT parent.id
  FROM table_of_contents_items parent, toc
  WHERE parent.path @> toc.path AND NOT parent.is_draft
),
acls AS (
  SELECT acl.id
  FROM access_control_lists acl
  JOIN parents p ON p.id = acl.table_of_contents_item_id
  WHERE acl.type != 'public'
)
SELECT
  COALESCE(bool_and(session_on_acl(id)), EXISTS (SELECT 1 FROM toc))
FROM acls;
$$;


CREATE INDEX IF NOT EXISTS toc_path_idx
ON table_of_contents_items USING gist (path);

grant execute on function _session_has_toc_access to anon;
comment on function _session_has_toc_access is E'@omit';

drop policy if exists table_of_contents_items_select on table_of_contents_items;

CREATE POLICY table_of_contents_items_select ON table_of_contents_items
FOR SELECT
TO anon
USING (
  (
    session_has_project_access(project_id)
    AND NOT is_draft
    AND _session_has_toc_access(id)
  )
  OR data_library_template_id IS NOT NULL
);

CREATE OR REPLACE FUNCTION public.session_on_acl(acl_id integer) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
WITH acl AS (
  SELECT id, type, project_id
  FROM access_control_lists
  WHERE id = $1
),
sess_user AS (
  SELECT nullif(current_setting('session.user_id', true), '')::int AS user_id
)
SELECT
  -- Public access allowed
  EXISTS (SELECT 1 FROM acl WHERE type = 'public')

  -- OR user is an admin
  OR EXISTS (
    SELECT 1 FROM acl
    WHERE session_is_admin(acl.project_id)
  )

  -- OR user is in a group with access
  OR EXISTS (
    SELECT 1
    FROM acl, sess_user
    WHERE acl.type = 'group'
      AND sess_user.user_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM access_control_list_groups aclg
        JOIN project_group_members pgm ON pgm.group_id = aclg.group_id
        WHERE aclg.access_control_list_id = acl.id
          AND pgm.user_id = sess_user.user_id
      )
  );
$$;


CREATE OR REPLACE FUNCTION public.projects_table_of_contents_items(p public.projects)
RETURNS SETOF public.table_of_contents_items
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  WITH toc_items AS (
    SELECT *
    FROM table_of_contents_items
    WHERE project_id = p.id AND is_draft = false
  ),
  blocked_items AS (
    SELECT DISTINCT t.id
    FROM toc_items t
    JOIN table_of_contents_items ancestor ON ancestor.path @> t.path
    JOIN access_control_lists acl ON acl.table_of_contents_item_id = ancestor.id
    WHERE acl.type != 'public' AND NOT session_on_acl(acl.id)
  )
  SELECT *
  FROM toc_items
  WHERE id NOT IN (SELECT id FROM blocked_items)
$$;

DROP FUNCTION IF EXISTS overlapping_fragments_for_collection;
-- TODO: Make unit tests for this function
CREATE OR REPLACE FUNCTION overlapping_fragments_for_collection(
  input_collection_id int,
  input_envelopes geometry[],
  edited_sketch_id int
)
RETURNS TABLE (
  hash text,
  geometry geometry(Polygon, 4326),
  sketch_ids int[],
  geography_ids int[]
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH sketches_in_collection AS (
    SELECT unnest(get_child_sketches_recursive(input_collection_id, 'sketch')) as id
  ),
  fragments_in_envelopes AS (
    SELECT f.*
    FROM fragments f
    JOIN unnest(input_envelopes) AS env ON f.geometry && env
  ),
  fragments_in_sketch as (
    select fragment_hash from sketch_fragments where sketch_id = edited_sketch_id
  ),
  overlapping_sketches AS (
    SELECT sketch_fragments.sketch_id
    FROM sketch_fragments
    WHERE sketch_fragments.fragment_hash = any(
      SELECT hash
      FROM fragments_in_envelopes
    ) or fragment_hash = any(
      select fragment_hash from fragments_in_sketch
    )
  )
  -- construct output table
  SELECT
    fragments.hash,
    fragments.geometry,
    ARRAY(
      SELECT sketch_fragments.sketch_id
      FROM sketch_fragments
      WHERE sketch_fragments.fragment_hash = fragments.hash
      AND sketch_fragments.sketch_id IN (SELECT id FROM sketches_in_collection)
    ) AS sketch_ids,
    ARRAY(
      SELECT fragment_geographies.geography_id
      FROM fragment_geographies
      WHERE fragment_geographies.fragment_hash = fragments.hash
    ) AS geography_ids
  FROM fragments
  WHERE
    -- Include ALL fragments from sketches that have any overlapping fragments
  EXISTS (
    SELECT 1
    FROM sketch_fragments
    WHERE sketch_fragments.fragment_hash = fragments.hash
      AND sketch_fragments.sketch_id IN (SELECT sketch_id FROM overlapping_sketches)
      AND sketch_fragments.sketch_id IN (SELECT id FROM sketches_in_collection)
  )
  OR
  -- Include fragments that belong to the edited sketch
  EXISTS (
    SELECT 1
    FROM sketch_fragments
    WHERE sketch_fragments.fragment_hash = fragments.hash
      AND sketch_fragments.sketch_id = edited_sketch_id
  )
$$;


grant execute on function overlapping_fragments_for_collection to seasketch_user;
comment on function overlapping_fragments_for_collection is E'@omit';

create or replace function cleanup_orphaned_fragments()
returns void
language sql
security definer
as $$
  delete from fragments
  where hash not in (select fragment_hash from sketch_fragments)
$$;

create or replace function cleanup_orphaned_fragments(scope text[])
  returns void
  security definer
  language sql
  as $$
    delete from fragments where hash = any(scope) and not exists (select 1 from sketch_fragments where fragment_hash = fragments.hash)
  $$;

grant execute on function cleanup_orphaned_fragments(text[]) to seasketch_user;
comment on function cleanup_orphaned_fragments(text[]) is E'@omit';

create or replace function cleanup_orphaned_fragments()
  returns void
  security definer
  language sql
  as $$
    delete from fragments where not exists (select 1 from sketch_fragments where fragment_hash = fragments.hash)
  $$;

grant execute on function cleanup_orphaned_fragments() to seasketch_user;
comment on function cleanup_orphaned_fragments() is E'@omit';

drop function if exists get_fragments_for_sketch;
create or replace function get_fragments_for_sketch(sketch_id int)
  returns table (
    hash text,
    geometry text,
    sketch_ids int[],
    geography_ids int[]
  )
  security definer
  language plpgsql
  as $$
  declare
    policy_passed boolean;
  begin
    -- Check that the session can access the given sketch using RLS policy
    policy_passed := check_sketch_rls_policy(get_fragments_for_sketch.sketch_id);
    if not policy_passed then
      raise exception 'Permission denied';
    end if;

    return query
    SELECT
    fragments.hash,
    ST_AsGeoJSON(fragments.geometry) as geometry,
    ARRAY(
      SELECT sketch_fragments.sketch_id
      FROM sketch_fragments
      WHERE sketch_fragments.fragment_hash = fragments.hash
    ) AS sketch_ids,
    ARRAY(
      SELECT fragment_geographies.geography_id
      FROM fragment_geographies
      WHERE fragment_geographies.fragment_hash = fragments.hash
    ) AS geography_ids
    FROM fragments
    WHERE
    EXISTS (
      SELECT 1
      FROM sketch_fragments
      WHERE sketch_fragments.fragment_hash = fragments.hash
        AND sketch_fragments.sketch_id = get_fragments_for_sketch.sketch_id
    );
  end;
  $$;

grant execute on function get_fragments_for_sketch to anon;
comment on function get_fragments_for_sketch is E'@omit';

create or replace function clipping_layers_for_sketch_class(pid int, scid int)
  returns table (
    id int,
    geography_id int,
    object_key text,
    operation_type geography_layer_operation,
    cql2_query jsonb,
    template_id text,
    for_clipping boolean
  )
  security definer
  language sql
  as $$
    select
      gcl.id,
      gcl.project_geography_id as geography_id,
      data_layers_vector_object_key((select dl from data_layers dl where dl.id = gcl.data_layer_id)) as object_key,
      gcl.operation_type,
      gcl.cql2_query,
      gcl.template_id,
      exists(
        select 1 
        from sketch_class_geographies scg 
        where scg.geography_id = gcl.project_geography_id 
        and scg.sketch_class_id = clipping_layers_for_sketch_class.scid
      ) as for_clipping
    from geography_clipping_layers gcl
    join project_geography pg on gcl.project_geography_id = pg.id
    where pg.project_id = clipping_layers_for_sketch_class.pid
  $$;

grant execute on function clipping_layers_for_sketch_class to seasketch_user;
comment on function clipping_layers_for_sketch_class is E'@omit';
