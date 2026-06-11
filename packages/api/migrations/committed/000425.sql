--! Previous: sha1:58eb158425b21877c5983afd0c8103548d6c7e0f
--! Hash: sha1:ef6d7621e3754e1c599b1702e54d1444013dde37

-- Enter migration here
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
    elsif source_type != 'seasketch-mvt' and source_type != 'seasketch-raster' and source_type != 'seasketch-vector' then
      if new.source_layer is not null then
        raise 'Only Layers with data_sources of type "vector", "seasketch-mvt", or "seasketch-raster" should specify a source_layer. Type was %', (source_type);
      end if;
    end if;
    if (source_type = 'vector' or source_type = 'geojson' or source_type = 'seasketch-vector' or source_type = 'seasketch-mvt') then
      if new.mapbox_gl_styles is null then
        raise 'Vector layers must specify mapbox_gl_styles';
      end if;
    else
      if new.mapbox_gl_styles is not null and source_type != 'seasketch-raster' and source_type != 'raster' then
        raise 'Layers with data_sources of type % should not specify mapbox_gl_styles', (source_type);
      end if;
    end if;
    if old is null and NEW.z_index = 0 then
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
