-- Enter migration here
alter table map_bookmarks add column if not exists sidebar_state jsonb;
drop function if exists create_map_bookmark(text, boolean, jsonb, text[], integer, jsonb, jsonb,  integer[]
, integer[]);
CREATE OR REPLACE FUNCTION public.create_map_bookmark(slug text, "isPublic" boolean, style jsonb, "visibleDataLayers" text[], "selectedBasemap" integer, "basemapOptionalLayerStates" jsonb, "cameraOptions" jsonb, "mapDimensions" integer[], "visibleSketches" integer[], "sidebarState" jsonb) RETURNS public.map_bookmarks
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      bookmark map_bookmarks;
      pid int;
    begin
      select id into pid from projects where projects.slug = create_map_bookmark.slug;
      if session_has_project_access(pid) then
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
          sidebar_state
        ) values (
          pid,
          nullif(current_setting('session.user_id', TRUE), '')::int,
          "isPublic",
          create_map_bookmark.style,
          "visibleDataLayers",
          "selectedBasemap",
          "basemapOptionalLayerStates",
          "cameraOptions",
          "mapDimensions",
          "visibleSketches",
          "sidebarState"
        ) returning * into bookmark;
        return bookmark;
      else
        raise exception 'Permission denied';
      end if;
    end;
  $$;

grant execute on function create_map_bookmark to seasketch_user;

grant select(sidebar_state) on map_bookmarks to anon;

create or replace function bookmark_data(id text)
  returns jsonb
  language sql
  stable
  security definer
  as $$
    SELECT jsonb_build_object('id', id, 'style', style, 'basemapUrl', (select url from basemaps where basemaps.id = map_bookmarks.selected_basemap), 'mapDimensions', map_dimensions, 'cameraOptions', camera_options, 'sidebarState', sidebar_state) as bookmark from map_bookmarks where map_bookmarks.id = bookmark_data.id::uuid;
  $$;

grant execute on function bookmark_data to anon;
comment on function bookmark_data is '@omit';