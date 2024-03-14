-- Enter migration here
insert into data_source_types (
  type, 
  description
) values (
  'gfw-4wings',
  '4Wings data source hosted by Global Fishing Watch'
) on conflict do nothing;

alter table data_sources drop column if exists gfw_4wings_format;
drop function if exists create_gfw_4wings_source;
drop type if exists gfw_4wings_format;
CREATE TYPE gfw_4wings_format AS ENUM('mvt', 'png');

alter table data_sources drop column if exists gfw_4wings_datasets;
alter table data_sources drop column if exists gfw_4wings_date_range;
alter table data_sources drop column if exists gfw_4wings_filters;
alter table data_sources drop column if exists gfw_4wings_token;

alter table data_sources add column if not exists gfw_4wings_datasets text[];
alter table data_sources add column if not exists gfw_4wings_date_range text;
alter table data_sources add column if not exists gfw_4wings_format gfw_4wings_format;
alter table data_sources add column if not exists gfw_4wings_filters text[];
alter table data_sources add column if not exists gfw_4wings_token text;


create or replace function create_gfw_4wings_source(
  slug text,
  datasets text[],
  date_range text,
  format gfw_4wings_format,
  filters text[],
  token text,
  title text,
  gl_styles jsonb
) returns setof table_of_contents_items
language plpgsql
security definer
as $$
  declare
    source_id int;
    pid int;
    stableid text;
    interactivity_id int;
    layer_id int;
    item_id int;
  begin
    select id into pid from projects where slug = create_gfw_4wings_source.slug;
    if session_is_admin(pid) then
      stableid := create_stable_id();
      insert into data_sources (
        project_id,
        type,
        gfw_4wings_datasets,
        gfw_4wings_date_range,
        gfw_4wings_format,
        gfw_4wings_filters,
        gfw_4wings_token,
        tiles,
        minzoom,
        maxzoom,
        attribution
      ) values (
        pid,
        'gfw-4wings',
        datasets,
        date_range,
        format,
        filters,
        token,
        array['https://gateway.api.globalfishingwatch.org/v3/4wings/tile/heatmap/{z}/{x}/{y}'],
        0,
        12,
        '<a href="https://globalfishingwatch.org" target="_blank">Powered by Global Fishing Watch</a>'
      ) returning id into source_id;
      insert into interactivity_settings (
        type
      ) values (
        'gfw'::interactivity_type
      ) returning id into interactivity_id;
      insert into data_layers (
        project_id,
        data_source_id,
        source_layer,
        mapbox_gl_styles,
        interactivity_settings_id
      ) values (
        pid,
        source_id,
        'main',
        gl_styles,
        interactivity_id
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
        pid,
        create_gfw_4wings_source.title,
        layer_id,
        false,
        false,
        stableid,
        stableid::ltree
        -- TODO: Add metadata
      ) returning id into item_id;
      return query select * from table_of_contents_items where id = item_id;
    else
      raise exception 'Permission denied';
    end if;
  end;
$$;

grant execute on function create_gfw_4wings_source to seasketch_user;