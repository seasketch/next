-- Enter migration here
CREATE OR REPLACE FUNCTION public.before_insert_or_update_data_sources_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  declare
    bucket_id text;
  begin
    if new.minzoom is not null and (new.type != 'vector' and new.type != 'raster' and new.type != 'raster-dem' and new.type != 'seasketch-mvt' ) then
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
    if new.tiles is not null and (new.type != 'raster' and new.type != 'raster-dem' and new.type != 'vector' and new.type != 'seasketch-vector') then
      raise 'tiles property is not allowed for "%" sources', (new.type);
    end if;
    if new.encoding is not null and new.type != 'raster-dem' then
      raise 'encoding property only allowed on raster-dem sources';
    end if;
    if new.tile_size is not null and (new.type != 'raster' and new.type != 'raster-dem' and new.type != 'vector' and new.type != 'seasketch-mvt') then
      raise 'tile_size property is not allowed for "%" sources', (new.type);
    end if;
    if (new.type != 'geojson' and new.type != 'seasketch-vector') and (new.buffer is not null or new.cluster is not null or new.cluster_max_zoom is not null or new.cluster_properties is not null or new.cluster_radius is not null or new.generate_id is not null or new.line_metrics is not null or new.promote_id is not null or new.tolerance is not null) then
      raise 'geojson props such as buffer, cluster, generate_id, etc not allowed on % sources', (new.type);
    end if;
    if (new.byte_length is not null and new.type != 'seasketch-vector' and new.type != 'seasketch-mvt' and new.type != 'raster') then
      raise 'byte_length can only be set on seasketch-vector, seasketch_mvt and raster sources';
    end if;
    if (new.type = 'seasketch-vector' and new.type != 'seasketch-mvt' and new.byte_length is null) then
      raise 'seasketch-vector and mvt sources must have byte_length set to an approximate value';
    end if;
    if new.urls is not null and new.type != 'video' then
      raise 'urls property not allowed on % sources', (new.type);
    end if;
    if new.query_parameters is not null and (new.type != 'arcgis-vector' and new.type != 'arcgis-dynamic-mapserver') then
      raise 'query_parameters property not allowed on % sources', (new.type);
    end if;
    if new.use_device_pixel_ratio is not null and new.type != 'arcgis-dynamic-mapserver' then
      raise 'use_device_pixel_ratio property not allowed on % sources', (new.type);
    end if;
    if new.import_type is not null and new.type != 'seasketch-vector' and new.type != 'seasketch-mvt' and new.type != 'raster' then
      raise 'import_type property is only allowed for seasketch-vector, seasketch-mvt, and raster sources';
    end if;
    if new.import_type is null and (new.type = 'seasketch-vector' or new.type = 'seasketch-mvt') then
      raise 'import_type property is required for seasketch-vector sources';
    end if;
    if new.original_source_url is not null and new.type != 'seasketch-vector' then
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


CREATE OR REPLACE FUNCTION public.before_insert_or_update_data_layers_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  declare
    source_type text;
    max_z int;
  begin
    select type into source_type from data_sources where id = new.data_source_id;
    if source_type is null then
      raise 'Unknown source type. %', (new.data_source_id);
    end if;
    if new.sublayer is not null and source_type != 'arcgis-dynamic-mapserver' then
      raise 'sublayer property can only be specified for layers associated with a arcgis-dynamic-mapserver source';
    end if;
    if source_type = 'vector' then
      if new.source_layer is null then
        raise 'Layers with "vector" data sources must specify a source_layer';
      end if;
    elsif source_type != 'seasketch-mvt' and source_type != 'raster' then
      if new.source_layer is not null then
        raise 'Only Layers with data_sources of type "vector", "seasketch-mvt", or "raster" should specify a source_layer';
      end if;
    end if;
    if (source_type = 'vector' or source_type = 'geojson' or source_type = 'seasketch-vector' or source_type = 'seasketch-mvt') then
      if new.mapbox_gl_styles is null then
        raise 'Vector layers must specify mapbox_gl_styles';
      end if;
    else
      if new.mapbox_gl_styles is not null and source_type != 'raster' then
        raise 'Layers with data_sources of type % should not specify mapbox_gl_styles', (source_type);
      end if;
    end if;
    if old is null then
      -- assign a z-index
      select max(z_index) + 1 into max_z from data_layers where project_id = new.project_id;
      if max_z is null then
        max_z = 0;
      end if;
      new.z_index = max_z;
    end if;
    return new;
  end;
$$;

alter type data_upload_output_type add value if not exists 'GeoTIFF';
alter type data_upload_output_type add value if not exists 'PNG';