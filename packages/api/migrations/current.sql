-- Enter migration here
create or replace function bookmark_data(id text)
  returns jsonb
  language sql
  stable
  security definer
  as $$
    SELECT jsonb_build_object('id', id, 'style', style, 'basemapUrl', (select url from basemaps where basemaps.id = map_bookmarks.selected_basemap), 'mapDimensions', map_dimensions, 'cameraOptions', camera_options) as bookmark from map_bookmarks where map_bookmarks.id = bookmark_data.id::uuid;
  $$;

grant execute on function bookmark_data to anon;
comment on function bookmark_data is '@omit';