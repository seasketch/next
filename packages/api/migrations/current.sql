-- Enter migration here
drop function if exists create_remote_mvt_source;
create or replace function create_remote_mvt_source(project_id int, url text, source_layer text, title text, max_zoom int, min_zoom int, attribution text, mapbox_gl_styles jsonb, stable_id text)
returns table_of_contents_items
language plpgsql
security definer
as $$
  declare
    source_id int;
    layer_id int;
    item table_of_contents_items;
  begin
    if session_is_admin(project_id) then
      insert into data_sources (
        project_id,
        type,
        tiles,
        maxzoom,
        minzoom,
        attribution
      ) values (
        create_remote_mvt_source.project_id,
        'vector',
        array[url],
        create_remote_mvt_source.max_zoom,
        create_remote_mvt_source.min_zoom,
        create_remote_mvt_source.attribution
      ) returning id into source_id;
      insert into data_layers (
        project_id,
        data_source_id,
        source_layer,
        mapbox_gl_styles
      ) values (
        create_remote_mvt_source.project_id,
        source_id,
        create_remote_mvt_source.source_layer,
        create_remote_mvt_source.mapbox_gl_styles
      ) returning id into layer_id;
      insert into table_of_contents_items (
        project_id,
        title,
        data_layer_id,
        is_folder,
        enable_download,
        stable_id,
        path
      ) values (
        create_remote_mvt_source.project_id,
        create_remote_mvt_source.title,
        layer_id,
        false,
        false,
        create_remote_mvt_source.stable_id,
        create_remote_mvt_source.stable_id::ltree
      ) returning * into item;
      return item;
    else
      raise exception 'Permission denied.';
    end if;
  end;
  $$;

grant execute on function create_remote_mvt_source to seasketch_user;