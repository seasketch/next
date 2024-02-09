--! Previous: sha1:35b6c3f76b8295a308bbf8451396d2b6eb99fa6a
--! Hash: sha1:914941c36c70ee0354fa3de2b8dabbffbf00e217

-- Enter migration here

insert into data_source_types (
  type,
  description
) values (
  'arcgis-dynamic-mapserver-vector-sublayer',
  'Only valid when used as a table of contents item data_source_type value.'
) on conflict do nothing;

insert into data_source_types (
  type,
  description
) values (
  'arcgis-dynamic-mapserver-raster-sublayer',
  'Only valid when used as a table of contents item data_source_type value.'
) on conflict do nothing;

CREATE OR REPLACE FUNCTION public.before_insert_or_update_data_sources_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  declare
    bucket_id text;
  begin
    if new.type = 'arcgis-dynamic-mapserver-raster-sublayer' then
      raise exception 'arcgis-dynamic-mapserver-raster-sublayer is not a valid data source type. It is only to be used as a table of contents item data_source_type value.';
    end if;
    if new.type = 'arcgis-dynamic-mapserver-vector-sublayer' then
      raise exception 'arcgis-dynamic-mapserver-vector-sublayer is not a valid data source type. It is only to be used as a table of contents item data_source_type value.';
    end if;
    if new.minzoom is not null and (new.type != 'vector' and new.type != 'raster' and new.type != 'raster-dem' and new.type != 'seasketch-mvt' and new.type != 'seasketch-raster' and new.type != 'arcgis-raster-tiles' ) then
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
    if new.tile_size is not null and (new.type != 'raster' and new.type != 'raster-dem' and new.type != 'vector' and new.type != 'seasketch-mvt' and new.type != 'seasketch-raster') then
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
    if new.query_parameters is not null and (new.type != 'arcgis-vector' and new.type != 'arcgis-dynamic-mapserver') then
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

alter table table_of_contents_items add column if not exists data_source_type text references data_source_types(type);

alter table table_of_contents_items drop column if exists has_original_source_upload;

alter table table_of_contents_items add column if not exists original_source_upload_available boolean not null default false;

create or replace function table_of_contents_items_is_downloadable_source_type(item table_of_contents_items)
  returns boolean
  stable
  language sql
  as $$
    select 
      item.data_source_type = 'arcgis-dynamic-mapserver-vector-sublayer' or
      item.data_source_type = 'arcgis-vector' or
      (
        (
          item.data_source_type = 'seasketch-vector' or
          item.data_source_type = 'seasketch-mvt' or
          item.data_source_type = 'seasketch-raster'
        ) and 
        item.original_source_upload_available = true
      );
  $$;

grant execute on function table_of_contents_items_is_downloadable_source_type to anon;


create or replace function data_source_type(data_layer_id int)
  returns text
  language sql
  as $$
    select
      (
        case 
          when data_layers.sublayer is not null then
            'arcgis-dynamic-mapserver-' || data_layers.sublayer_type || '-sublayer'
          else
            data_sources.type
          end
      ) as data_source_type
    from 
      data_layers
    inner join
      data_sources
    on
      data_layers.data_source_id = data_sources.id
    where
      data_layers.id = data_layer_id;
  $$;

CREATE OR REPLACE FUNCTION public.before_insert_or_update_table_of_contents_items_trigger() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  begin
    if new.is_folder or new.data_layer_id is null then
      new.data_source_type = null;
    else
      new.data_source_type = data_source_type(new.data_layer_id);
    end if;
    if (new.data_source_type = 'seasketch-vector' or new.data_source_type = 'seasketch-mvt' or new.data_source_type = 'seasketch-raster') and new.original_source_upload_available = false then
      new.original_source_upload_available = (
      
              select exists (
                select 
                  original_filename
                from 
                  data_upload_outputs
                where 
                  data_upload_outputs.data_source_id = (
                    select 
                      data_layers.data_source_id
                    from 
                      data_layers
                    where 
                      data_layers.id = new.data_layer_id
                  ) and
                  data_upload_outputs.is_original = true
              )
      );
    end if;
    if old.is_folder != new.is_folder then
      raise 'Cannot change is_folder. Create a new table of contents item';
    end if;
    if new.sort_index is null then
      new.sort_index = (select coalesce(max(sort_index), -1) + 1 from table_of_contents_items where is_draft = true and project_id = new.project_id and parent_stable_id = new.parent_stable_id or (parent_stable_id is null and new.parent_stable_id is null));
    end if;
    if old is null and new.is_draft = true then -- inserting
      new.enable_download = (select enable_download_by_default from projects where id = new.project_id);
      -- verify that stable_id is unique among draft items
      if (select count(id) from table_of_contents_items where stable_id = new.stable_id and is_draft = true) > 0 then
        raise '% is not a unique stable_id.', new.stable_id;
      end if;
      -- set path
      if new.parent_stable_id is null then
        new.path = new.stable_id;
      else
        if (select count(id) from table_of_contents_items where is_draft = true and stable_id = new.parent_stable_id) > 0 then
          -- set path, finding path of parent and appending to it
          new.path = (select path from table_of_contents_items where is_draft = true and stable_id = new.parent_stable_id) || new.stable_id;
        else
          raise 'Cannot find parent item with stable_id=%', new.parent_stable_id;
        end if;
      end if;
    end if;
    if new.is_folder then
      if new.data_layer_id is not null then
        raise 'Folders cannot have data_layer_id set';
      end if;
      if new.bounds is not null then
        raise 'Folders cannot have bounds set';
      end if;
    else
      if new.data_layer_id is null then
        raise 'data_layer_id must be set if is_folder=false';
      end if;
      if new.show_radio_children then
        raise 'show_radio_children must be false if is_folder=false';
      end if;
      if new.is_click_off_only then
        raise 'is_click_off_only must be false if is_folder=false';
      end if;
    end if;
    if length(trim(new.title)) = 0 then
      raise 'title cannot be empty';
    end if;
    return new;
  end;
$$;

update table_of_contents_items set data_source_type = data_source_type(data_layer_id) where data_layer_id is not null and data_source_type is null;

update table_of_contents_items set original_source_upload_available = (
  select exists (
                select 
                  original_filename
                from 
                  data_upload_outputs
                where 
                  data_upload_outputs.data_source_id = (
                    select 
                      data_layers.data_source_id
                    from 
                      data_layers
                    where 
                      data_layers.id = data_layer_id
                  ) and
                  data_upload_outputs.is_original = true
              )
) where original_source_upload_available = false and (data_source_type = 'seasketch-vector' or data_source_type = 'seasketch-mvt' or data_source_type = 'seasketch-raster');


update table_of_contents_items set enable_download = false where enable_download is true and not table_of_contents_items_is_downloadable_source_type(table_of_contents_items.*);

CREATE OR REPLACE FUNCTION public.before_insert_or_update_table_of_contents_items_trigger() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  begin
    if new.is_folder or new.data_layer_id is null then
      new.data_source_type = null;
    else
      new.data_source_type = data_source_type(new.data_layer_id);
    end if;
    if (new.data_source_type = 'seasketch-vector' or new.data_source_type = 'seasketch-mvt' or new.data_source_type = 'seasketch-raster') and new.original_source_upload_available = false then
      new.original_source_upload_available = (
      
              select exists (
                select 
                  original_filename
                from 
                  data_upload_outputs
                where 
                  data_upload_outputs.data_source_id = (
                    select 
                      data_layers.data_source_id
                    from 
                      data_layers
                    where 
                      data_layers.id = new.data_layer_id
                  ) and
                  data_upload_outputs.is_original = true
              )
      );
    end if;
    if old.is_folder != new.is_folder then
      raise 'Cannot change is_folder. Create a new table of contents item';
    end if;
    if old.is_draft = false then
      raise 'Cannot alter table of contents items after they are published';
    end if;
    if new.sort_index is null then
      new.sort_index = (select coalesce(max(sort_index), -1) + 1 from table_of_contents_items where is_draft = true and project_id = new.project_id and parent_stable_id = new.parent_stable_id or (parent_stable_id is null and new.parent_stable_id is null));
    end if;
    if old is null and new.is_draft = true then -- inserting
      new.enable_download = (select enable_download_by_default from projects where id = new.project_id);
      -- verify that stable_id is unique among draft items
      if (select count(id) from table_of_contents_items where stable_id = new.stable_id and is_draft = true) > 0 then
        raise '% is not a unique stable_id.', new.stable_id;
      end if;
      -- set path
      if new.parent_stable_id is null then
        new.path = new.stable_id;
      else
        if (select count(id) from table_of_contents_items where is_draft = true and stable_id = new.parent_stable_id) > 0 then
          -- set path, finding path of parent and appending to it
          new.path = (select path from table_of_contents_items where is_draft = true and stable_id = new.parent_stable_id) || new.stable_id;
        else
          raise 'Cannot find parent item with stable_id=%', new.parent_stable_id;
        end if;
      end if;
    end if;
    if new.is_folder then
      if new.data_layer_id is not null then
        raise 'Folders cannot have data_layer_id set';
      end if;
      if new.bounds is not null then
        raise 'Folders cannot have bounds set';
      end if;
    else
      if new.data_layer_id is null then
        raise 'data_layer_id must be set if is_folder=false';
      end if;
      if new.show_radio_children then
        raise 'show_radio_children must be false if is_folder=false';
      end if;
      if new.is_click_off_only then
        raise 'is_click_off_only must be false if is_folder=false';
      end if;
    end if;
    if length(trim(new.title)) = 0 then
      raise 'title cannot be empty';
    end if;
    if new.enable_download = true and not table_of_contents_items_is_downloadable_source_type(new) then
      raise 'Cannot enable download for this source type %', new.data_source_type;
    end if;
    return new;
  end;
$$;


comment on function table_of_contents_items_has_original_source_upload is '@omit';


CREATE OR REPLACE FUNCTION public.projects_eligable_downloadable_layers_count(p public.projects) RETURNS integer
    LANGUAGE sql STABLE
    AS $$
    select 
      count(id)::int 
    from 
      table_of_contents_items 
    where 
      project_id = p.id and 
      is_draft = true and 
      is_folder = false and 
      enable_download = false and 
      table_of_contents_items_is_downloadable_source_type(table_of_contents_items.*);
  $$;

CREATE OR REPLACE FUNCTION public.projects_downloadable_layers_count(p public.projects) RETURNS integer
    LANGUAGE sql STABLE
    AS $$
    select 
      count(id)::int 
    from 
      table_of_contents_items 
    where 
      project_id = p.id and 
      is_draft = true and 
      is_folder = false and 
      enable_download = true and 
      table_of_contents_items_is_downloadable_source_type(table_of_contents_items.*);
$$;

CREATE OR REPLACE FUNCTION public.table_of_contents_items_primary_download_url(item public.table_of_contents_items) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
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
              data_upload_outputs.data_source_id = (
                select 
                  data_layers.data_source_id
                from 
                  data_layers
                where 
                  data_layers.id = item.data_layer_id
              )
            and 
              data_upload_outputs.is_original = true
              limit 1
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

CREATE OR REPLACE FUNCTION public.enable_download_for_eligible_layers(slug text) RETURNS public.projects
    LANGUAGE plpgsql
    AS $$
    DECLARE
      project projects;
    begin    
      update 
        table_of_contents_items 
      set enable_download = true
      where 
        table_of_contents_items.project_id = (
          select 
            id 
          from 
            projects 
          where 
            projects.slug = enable_download_for_eligible_layers.slug
        ) and 
        table_of_contents_items.is_draft = true and
        table_of_contents_items_is_downloadable_source_type(table_of_contents_items.*);
      select 
        * 
      from 
        projects 
      into 
        project
      where 
        projects.slug = enable_download_for_eligible_layers.slug 
      limit 1;
      return project;
    end;
  $$;
