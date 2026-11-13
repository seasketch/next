-- Shareable links to a single published overlay.
--
-- A layer link is a map_bookmarks row (kind = layer_link) that stores one
-- layer, the basemap that was on screen when an admin created the link, and a
-- camera fitted to the layer's extent. The existing screenshot worker renders
-- the thumbnail. Forum bookmarks stay kind = forum.

do $$ begin
  create type public.map_bookmark_kind as enum ('forum', 'layer_link');
exception
  when duplicate_object then null;
end $$;

alter table public.map_bookmarks
  add column if not exists kind public.map_bookmark_kind not null default 'forum',
  add column if not exists subject_stable_id text;

comment on column public.map_bookmarks.kind is
  'forum rows are map views attached to forum posts. layer_link rows are the shareable link for one published overlay.';

comment on column public.map_bookmarks.subject_stable_id is
  'For layer_link rows, the published table_of_contents stable_id. Null for forum bookmarks.';

create unique index if not exists map_bookmarks_layer_link_uidx
  on public.map_bookmarks (project_id, subject_stable_id)
  where kind = 'layer_link';

-- One canonical link per published layer. Opening the dialog again with the
-- same basemap, camera, and style returns the existing row. A change requeues
-- the screenshot and keeps the same id, so the URL does not move.
create or replace function public.ensure_layer_link(
  slug text,
  "stableId" text,
  style jsonb,
  "selectedBasemap" integer,
  "basemapOptionalLayerStates" jsonb,
  "cameraOptions" jsonb,
  "mapDimensions" integer[],
  "basemapName" text,
  "layerNames" jsonb
) returns public.map_bookmarks
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  bookmark public.map_bookmarks;
  pid int;
  item_id int;
  style_changed boolean;
  uid int;
begin
  select id into pid from projects where projects.slug = ensure_layer_link.slug;
  if pid is null or session_is_admin(pid) is not true then
    raise exception 'Permission denied';
  end if;

  select id into item_id
  from table_of_contents_items
  where project_id = pid
    and stable_id = "stableId"
    and is_draft = false
    and is_folder = false;

  if item_id is null then
    if exists (
      select 1
      from table_of_contents_items
      where project_id = pid
        and stable_id = "stableId"
        and is_draft = true
        and is_folder = false
    ) then
      raise exception 'Publish this layer before creating a link to it';
    end if;
    raise exception 'Layer not found';
  end if;

  uid := nullif(current_setting('session.user_id', true), '')::int;

  select * into bookmark
  from map_bookmarks
  where project_id = pid
    and subject_stable_id = "stableId"
    and kind = 'layer_link'
  for update;

  if bookmark.id is null then
    begin
      insert into map_bookmarks (
        project_id,
        user_id,
        is_public,
        style,
        visible_data_layers,
        selected_basemap,
        basemap_optional_layer_states,
        camera_options,
        map_dimensions,
        visible_sketches,
        sidebar_state,
        basemap_name,
        layer_names,
        sketch_names,
        data_table_states,
        kind,
        subject_stable_id
      ) values (
        pid,
        uid,
        true,
        ensure_layer_link.style,
        array["stableId"],
        "selectedBasemap",
        coalesce("basemapOptionalLayerStates", '{}'::jsonb),
        "cameraOptions",
        "mapDimensions",
        '{}'::int[],
        '{"open": false, "width": 0, "isSmall": false}'::jsonb,
        "basemapName",
        "layerNames",
        '{}'::jsonb,
        '{}'::jsonb,
        'layer_link',
        "stableId"
      ) returning * into bookmark;
      return bookmark;
    exception
      when unique_violation then
        select * into bookmark
        from map_bookmarks
        where project_id = pid
          and subject_stable_id = "stableId"
          and kind = 'layer_link'
        for update;
    end;
  end if;

  style_changed :=
    bookmark.style is distinct from ensure_layer_link.style
    or bookmark.selected_basemap is distinct from "selectedBasemap"
    or bookmark.camera_options is distinct from "cameraOptions"
    or coalesce(bookmark.basemap_optional_layer_states, '{}'::jsonb)
      is distinct from coalesce("basemapOptionalLayerStates", '{}'::jsonb)
    or bookmark.map_dimensions is distinct from "mapDimensions";

  if not style_changed
     and bookmark.layer_names is not distinct from "layerNames"
     and bookmark.basemap_name is not distinct from "basemapName" then
    return bookmark;
  end if;

  update map_bookmarks set
    style = ensure_layer_link.style,
    selected_basemap = "selectedBasemap",
    basemap_optional_layer_states = coalesce("basemapOptionalLayerStates", '{}'::jsonb),
    camera_options = "cameraOptions",
    map_dimensions = "mapDimensions",
    basemap_name = "basemapName",
    layer_names = "layerNames",
    visible_data_layers = array["stableId"],
    visible_sketches = '{}'::int[],
    sidebar_state = '{"open": false, "width": 0, "isSmall": false}'::jsonb,
    is_public = true,
    user_id = case when style_changed then uid else user_id end,
    image_id = case when style_changed then null else image_id end,
    screenshot_job_status = case
      when style_changed then 'queued'::public.worker_job_status
      else screenshot_job_status
    end,
    client_generated_thumbnail = case
      when style_changed then null
      else client_generated_thumbnail
    end
  where id = bookmark.id
  returning * into bookmark;

  if style_changed then
    perform graphile_worker.add_job(
      'createBookmarkScreenshot',
      json_build_object('id', bookmark.id),
      job_key := 'createBookmarkScreenshot:' || bookmark.id,
      max_attempts := 6
    );
  end if;

  return bookmark;
end;
$$;

comment on function public.ensure_layer_link(
  slug text,
  "stableId" text,
  style jsonb,
  "selectedBasemap" integer,
  "basemapOptionalLayerStates" jsonb,
  "cameraOptions" jsonb,
  "mapDimensions" integer[],
  "basemapName" text,
  "layerNames" jsonb
) is 'Create or refresh the shareable bookmark for one published layer. Admins only. The bookmark id is stable for the layer.';

revoke all on function public.ensure_layer_link(
  slug text,
  "stableId" text,
  style jsonb,
  "selectedBasemap" integer,
  "basemapOptionalLayerStates" jsonb,
  "cameraOptions" jsonb,
  "mapDimensions" integer[],
  "basemapName" text,
  "layerNames" jsonb
) from public;
grant all on function public.ensure_layer_link(
  slug text,
  "stableId" text,
  style jsonb,
  "selectedBasemap" integer,
  "basemapOptionalLayerStates" jsonb,
  "cameraOptions" jsonb,
  "mapDimensions" integer[],
  "basemapName" text,
  "layerNames" jsonb
) to seasketch_user;

-- What an admin should tell people about who can open the link.
-- Inherited folder ACLs count: a public layer inside a group folder is not public.
create or replace function public.layer_link_sharing(
  slug text,
  "stableId" text
) returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  pid int;
  item_id int;
  project_name text;
  project_access text;
  layer_title text;
  layer_attribution text;
  folders jsonb;
  restrictions jsonb;
begin
  select id, name, access_control::text
    into pid, project_name, project_access
  from projects
  where projects.slug = layer_link_sharing.slug;

  if pid is null or session_is_admin(pid) is not true then
    raise exception 'Permission denied';
  end if;

  select id, title into item_id, layer_title
  from table_of_contents_items
  where project_id = pid
    and stable_id = "stableId"
    and is_draft = false
    and is_folder = false;

  if item_id is null then
    if exists (
      select 1
      from table_of_contents_items
      where project_id = pid
        and stable_id = "stableId"
        and is_draft = true
        and is_folder = false
    ) then
      raise exception 'Publish this layer before creating a link to it';
    end if;
    raise exception 'Layer not found';
  end if;

  select ds.attribution into layer_attribution
  from data_layers dl
  left join data_sources ds on ds.id = dl.data_source_id
  where dl.id = (
    select data_layer_id from table_of_contents_items where id = item_id
  );

  with recursive chain as (
    select
      id,
      stable_id,
      parent_stable_id,
      title,
      is_folder,
      0 as depth
    from table_of_contents_items
    where id = item_id
    union all
    select
      parent.id,
      parent.stable_id,
      parent.parent_stable_id,
      parent.title,
      parent.is_folder,
      chain.depth + 1
    from chain
    join table_of_contents_items parent
      on parent.stable_id = chain.parent_stable_id
     and parent.project_id = pid
     and parent.is_draft = false
    where chain.depth < 64
  )
  select
    coalesce(
      (
        select jsonb_agg(title order by depth desc)
        from chain
        where depth > 0
      ),
      '[]'::jsonb
    ),
    coalesce(
      (
        select jsonb_agg(payload order by depth desc)
        from (
          select
            chain.depth,
            jsonb_build_object(
              'title', chain.title,
              'isFolder', chain.is_folder,
              'type', acl.type::text,
              'groups', coalesce(
                (
                  select jsonb_agg(pg.name order by pg.name)
                  from access_control_list_groups ag
                  join project_groups pg on pg.id = ag.group_id
                  where ag.access_control_list_id = acl.id
                ),
                '[]'::jsonb
              )
            ) as payload
          from chain
          join access_control_lists acl
            on acl.table_of_contents_item_id = chain.id
          where acl.type <> 'public'
        ) limited
      ),
      '[]'::jsonb
    )
  into folders, restrictions;

  return jsonb_build_object(
    'projectName', project_name,
    'projectAccess', project_access,
    'title', layer_title,
    'attribution', layer_attribution,
    'folderTitles', folders,
    'restrictions', restrictions
  );
end;
$$;

comment on function public.layer_link_sharing(slug text, "stableId" text) is
  'Admin-only summary of who can open a layer link: project access, attribution, folder path, and non-public ACLs on the layer and its parent folders.';

revoke all on function public.layer_link_sharing(slug text, "stableId" text) from public;
grant all on function public.layer_link_sharing(slug text, "stableId" text) to seasketch_user;
