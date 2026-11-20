-- Shareable bookmarks of the whole map, created from the map tools menu.
--
-- A map_view row stores the camera, basemap, and visible project layers. It is
-- not attached to a forum post and it is not a one-layer link. Sketches and
-- in-progress drawing markup are stripped before the row is stored, so the
-- screenshot worker cannot paint them into the saved image.

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'map_bookmark_kind'
      and e.enumlabel = 'map_view'
  ) then
    alter type public.map_bookmark_kind add value 'map_view';
  end if;
end $$;

comment on column public.map_bookmarks.kind is
  'forum rows are map views attached to forum posts. layer_link rows are the shareable link for one overlay. map_view rows are shareable views of the whole map and are not attached to a post.';

-- Drop sketch, drawing, and filter layers so a saved map view cannot carry
-- private sketch geometry or unsaved digitizing into the screenshot.
create or replace function public.strip_map_view_style(style jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  layers jsonb := '[]'::jsonb;
  layer jsonb;
  sources jsonb := '{}'::jsonb;
  key text;
  source_name text;
  layer_id text;
  keep_sources text[] := array[]::text[];
  original_sources jsonb;
begin
  if style is null or jsonb_typeof(style) <> 'object' then
    return '{}'::jsonb;
  end if;

  for layer in
    select value
    from jsonb_array_elements(coalesce(style->'layers', '[]'::jsonb))
  loop
    layer_id := coalesce(layer->>'id', '');
    source_name := coalesce(layer->>'source', '');
    if layer_id like 'gl-draw%'
       or layer_id like 'filter-layer-%'
       or layer_id like 'sketch-%'
       or layer_id = 'all-cells'
       or source_name like 'sketch-%'
       or source_name like 'mapbox-gl-draw%'
       or source_name = 'all-cells'
    then
      continue;
    end if;
    layers := layers || jsonb_build_array(layer);
    if source_name <> '' then
      keep_sources := array_append(keep_sources, source_name);
    end if;
  end loop;

  if jsonb_typeof(style->'terrain') = 'object' then
    source_name := coalesce(style->'terrain'->>'source', '');
    if source_name <> '' then
      keep_sources := array_append(keep_sources, source_name);
    end if;
  end if;

  original_sources := coalesce(style->'sources', '{}'::jsonb);
  if jsonb_typeof(original_sources) = 'object' then
    for key in
      select jsonb_object_keys(original_sources)
    loop
      if key like 'sketch-%'
         or key like 'mapbox-gl-draw%'
         or key = 'all-cells'
         or not (key = any(keep_sources))
      then
        continue;
      end if;
      sources := sources || jsonb_build_object(key, original_sources->key);
    end loop;
  end if;

  return style || jsonb_build_object('layers', layers, 'sources', sources);
end;
$$;

comment on function public.strip_map_view_style(jsonb) is '@omit';

revoke all on function public.strip_map_view_style(jsonb) from public;

create or replace function public.create_map_view_bookmark(
  slug text,
  style jsonb,
  "visibleDataLayers" text[],
  "selectedBasemap" integer,
  "basemapOptionalLayerStates" jsonb,
  "cameraOptions" jsonb,
  "mapDimensions" integer[],
  "sidebarState" jsonb,
  "basemapName" text,
  "layerNames" jsonb,
  "clientGeneratedThumbnail" text default null,
  "dataTableStates" jsonb default '{}'::jsonb
) returns public.map_bookmarks
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  bookmark public.map_bookmarks;
  pid int;
  uid int;
begin
  select id into pid from projects where projects.slug = create_map_view_bookmark.slug;
  uid := nullif(current_setting('session.user_id', true), '')::int;
  if pid is null or uid is null or session_has_project_access(pid) is not true then
    raise exception 'Permission denied';
  end if;

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
    client_generated_thumbnail,
    data_table_states,
    kind
  ) values (
    pid,
    uid,
    true,
    strip_map_view_style(create_map_view_bookmark.style),
    coalesce("visibleDataLayers", '{}'::text[]),
    "selectedBasemap",
    coalesce("basemapOptionalLayerStates", '{}'::jsonb),
    "cameraOptions",
    "mapDimensions",
    '{}'::int[],
    coalesce(
      "sidebarState",
      '{"open": false, "width": 0, "isSmall": false}'::jsonb
    ),
    "basemapName",
    coalesce("layerNames", '{}'::jsonb),
    '{}'::jsonb,
    "clientGeneratedThumbnail",
    coalesce("dataTableStates", '{}'::jsonb),
    'map_view'::text::public.map_bookmark_kind
  ) returning * into bookmark;

  return bookmark;
end;
$$;

comment on function public.create_map_view_bookmark(
  text, jsonb, text[], integer, jsonb, jsonb, integer[], jsonb, text, jsonb, text, jsonb
) is
  'Create a shareable bookmark of the current map. Sketches and unsaved drawings are omitted. The row is not attached to a forum post.';

revoke all on function public.create_map_view_bookmark(
  text, jsonb, text[], integer, jsonb, jsonb, integer[], jsonb, text, jsonb, text, jsonb
) from public;
grant execute on function public.create_map_view_bookmark(
  text, jsonb, text[], integer, jsonb, jsonb, integer[], jsonb, text, jsonb, text, jsonb
) to seasketch_user;

-- A map view link pasted into a forum post must stay a standalone bookmark.
-- Attaching it would delete the link when the post is deleted.
create or replace function public.assign_post_id_to_attached_map_bookmarks(body jsonb, post_id integer) returns boolean
language plpgsql
security definer
as $$
declare
  map_bookmark_ids text[];
begin
  select collect_map_bookmark_ids_from_prosemirror_body(body) into map_bookmark_ids;
  update map_bookmarks
  set post_id = assign_post_id_to_attached_map_bookmarks.post_id
  where id::text = any(map_bookmark_ids)
    and kind = 'forum';
  return true;
end;
$$;
