--! Previous: sha1:f10b47702095bb2524002271b5ed484e11051394
--! Hash: sha1:a5ad8a23ead01ac0fc9fcbc4b44775eee4f0c38b

-- Add Global Fishing Watch annual fishing-effort map layers.

insert into data_source_types (type, description)
values (
  'gfw-4wings',
  'Global Fishing Watch 4Wings annual fishing effort. Tiles are proxied; query_parameters names the pinned dataset.'
)
on conflict do nothing;

create or replace function public.before_insert_or_update_data_sources_trigger() returns trigger
  language plpgsql
  as $$
  declare
    bucket_id text;
  begin
    if new.type = 'arcgis-dynamic-mapserver-raster-sublayer' then
      raise exception 'arcgis-dynamic-mapserver-raster-sublayer is not a valid data source type. It is only to be used as a table of contents item data_source_type value.';
    end if;
    if new.type = 'arcgis-dynamic-mapserver-vector-sublayer' then
      raise exception 'arcgis-dynamic-mapserver-vector-sublayer is not a valid data source type. It is only to be used as a table of contents item data_source_type value.';
    end if;
    if new.minzoom is not null and (new.type != 'vector' and new.type != 'raster' and new.type != 'raster-dem' and new.type != 'seasketch-mvt' and new.type != 'seasketch-raster' and new.type != 'arcgis-raster-tiles' and new.type != 'gfw-4wings') then
      raise 'minzoom may only be set for tiled sources (vector, raster, raster-dem)';
    end if;
    if new.coordinates is null and (new.type = 'video' or new.type = 'image') then
      raise 'coordinates must be set on image and video sources';
    end if;
    if new.coordinates is not null and (new.type != 'video' and new.type != 'image') then
      raise 'coordinates property can only be set on image and video sources';
    end if;
    if new.maxzoom is not null and (new.type = 'image' or new.type = 'video') then
      raise 'maxzoom cannot be set for image and video sources';
    end if;
    if new.url is null and (new.type = 'geojson' or new.type = 'image' or new.type = 'arcgis-dynamic-mapserver' or new.type = 'arcgis-vector' or new.type = 'seasketch-mvt') then
      raise 'url must be set for "%" sources', (new.type);
    end if;
    if new.scheme is not null and (new.type != 'raster' and new.type != 'raster-dem' and new.type != 'vector' and new.type != 'seasketch-mvt') then
      raise 'scheme property is not allowed for "%" sources', (new.type);
    end if;
    if new.tiles is not null and (new.type != 'raster' and new.type != 'raster-dem' and new.type != 'vector' and new.type != 'seasketch-vector' and new.type != 'gfw-4wings') then
      raise 'tiles property is not allowed for "%" sources', (new.type);
    end if;
    if new.encoding is not null and new.type != 'raster-dem' then
      raise 'encoding property only allowed on raster-dem sources';
    end if;
    if new.tile_size is not null and (new.type != 'raster' and new.type != 'raster-dem' and new.type != 'vector' and new.type != 'seasketch-mvt' and new.type != 'seasketch-raster' and new.type != 'inaturalist' and new.type != 'gfw-4wings') then
      raise 'tile_size property is not allowed for "%" sources', (new.type);
    end if;
    if (new.type != 'geojson' and new.type != 'seasketch-vector') and (new.buffer is not null or new.cluster is not null or new.cluster_max_zoom is not null or new.cluster_properties is not null or new.cluster_radius is not null or new.generate_id is not null or new.line_metrics is not null or new.promote_id is not null or new.tolerance is not null) then
      raise 'geojson props such as buffer, cluster, generate_id, etc not allowed on % sources', (new.type);
    end if;
    if (new.byte_length is not null and new.type != 'seasketch-vector' and new.type != 'seasketch-mvt' and new.type != 'seasketch-raster') then
      raise 'byte_length can only be set on seasketch-vector, seasketch_mvt and seasketch-raster sources';
    end if;
    if (new.type = 'seasketch-vector' and new.type != 'seasketch-mvt' and new.byte_length is null) then
      raise 'seasketch-vector and mvt sources must have byte_length set to an approximate value';
    end if;
    if new.urls is not null and new.type != 'video' then
      raise 'urls property not allowed on % sources', (new.type);
    end if;
    if new.query_parameters is not null and (new.type != 'arcgis-vector' and new.type != 'arcgis-dynamic-mapserver' and new.type != 'inaturalist' and new.type != 'gfw-4wings') then
      raise 'query_parameters property not allowed on % sources', (new.type);
    end if;
    if new.use_device_pixel_ratio is not null and (new.type != 'arcgis-dynamic-mapserver' and new.type != 'arcgis-raster-tiles') then
      raise 'use_device_pixel_ratio property not allowed on % sources', (new.type);
    end if;
    if new.import_type is not null and new.type != 'seasketch-vector' and new.type != 'seasketch-mvt' and new.type != 'seasketch-raster' then
      raise 'import_type property is only allowed for seasketch-vector, seasketch-mvt, and seasketch-raster sources';
    end if;
    if new.import_type is null and (new.type = 'seasketch-vector' or new.type = 'seasketch-mvt') then
      raise 'import_type property is required for seasketch-vector sources';
    end if;
    if new.original_source_url is not null and (new.type != 'seasketch-vector' and new.type != 'seasketch-mvt') then
      raise 'original_source_url may only be set on seasketch-vector sources';
    end if;
    if new.enhanced_security is not null and new.type != 'seasketch-vector' then
      raise 'enhanced_security may only be set on seasketch-vector sources';
    end if;
    if old is null and new.type = 'seasketch-vector' then
      if new.bucket_id is null then
        new.bucket_id = (select data_sources_bucket_id from projects where id = new.project_id);
      end if;
      if new.object_key is null then
        new.object_key = (select gen_random_uuid());
      end if;
      new.tiles = null;
    end if;
    return new;
  end;
$$;

create or replace function public.create_gfw_4wings_table_of_contents_item(
  slug text,
  params jsonb,
  title text,
  metadata jsonb default null
) returns public.table_of_contents_items
  language plpgsql
  security definer
  as $$
declare
  pid int;
  source_id int;
  layer_id int;
  item table_of_contents_items;
  stableid text := create_stable_id();
  world_bounds constant numeric[] := array[-180, -85.051129, 180, 85.051129]::numeric[];
  default_metadata constant jsonb := '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Annual apparent fishing effort, in hours, from the Global Fishing Watch public dataset (version 5.0). One tile set covers 2012 through the current year. The current year is incomplete and changes as new data arrives. "},{"type":"text","text":"Powered by Global Fishing Watch","marks":[{"type":"link","attrs":{"href":"https://globalfishingwatch.org","title":null}}]},{"type":"text","text":". Data is available under CC BY-NC 4.0."}]}]}'::jsonb;
  temporal_doc constant jsonb := '{"version":1,"granularity":"remote","coverage":{"kind":"interval","start":"2012-01-01","end":null,"precision":"day"},"nativeResolution":"month","defaultViewResolution":"year","supportedViewResolutions":["year"],"providesSliderStats":true,"mapping":{"type":"remote","driver":"gfw-4wings"},"authoredBy":"library"}'::jsonb;
begin
  if params is null
    or params->>'version' is distinct from '1'
    or params->>'dataset' is distinct from 'public-global-fishing-effort'
    or params->>'datasetVersion' is distinct from 'v5.0'
    or params->'intervals' is distinct from '["YEAR"]'::jsonb
    or params ? 'filters' then
    raise exception 'Unsupported Global Fishing Watch layer configuration';
  end if;

  select id into pid from projects where projects.slug = create_gfw_4wings_table_of_contents_item.slug;
  if pid is null or session_is_admin(pid) = false then
    raise exception 'Permission denied. Must be a project admin';
  end if;
  if title is null or length(trim(title)) = 0 then
    raise exception 'title cannot be empty';
  end if;

  insert into data_sources (
    type,
    query_parameters,
    temporal,
    tiles,
    minzoom,
    maxzoom,
    tile_size,
    project_id,
    bounds,
    created_by,
    attribution
  ) values (
    'gfw-4wings',
    params,
    temporal_doc,
    array['https://tiles.seasketch.org/gfw/tile/{z}/{x}/{y}.mvt'],
    0,
    12,
    256,
    pid,
    world_bounds,
    nullif(current_setting('session.user_id', TRUE), '')::integer,
    '<a href="https://globalfishingwatch.org" target="_blank" rel="noopener noreferrer">Powered by Global Fishing Watch</a>'
  ) returning id into source_id;

  insert into data_layers (
    project_id,
    data_source_id
  ) values (
    pid,
    source_id
  ) returning id into layer_id;

  insert into table_of_contents_items (
    project_id,
    title,
    data_layer_id,
    stable_id,
    is_draft,
    metadata,
    is_folder,
    bounds,
    enable_download,
    copied_from_data_library_template_id
  ) values (
    pid,
    title,
    layer_id,
    stableid,
    true,
    coalesce(metadata, default_metadata),
    false,
    world_bounds,
    false,
    'GFW_FISHING_EFFORT'
  ) returning * into item;

  return item;
end;
$$;

grant execute on function public.create_gfw_4wings_table_of_contents_item(text, jsonb, text, jsonb) to seasketch_user;
