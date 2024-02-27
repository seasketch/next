-- Enter migration here
drop function if exists project_background_jobs_esri_feature_layer_conversion_task;
drop function if exists data_sources_esri_feature_layer_conversion_tasks;
drop table if exists esri_feature_layer_conversion_tasks;
create table if not exists esri_feature_layer_conversion_tasks (
  project_background_job_id uuid not null primary key references project_background_jobs(id) on delete cascade,
  table_of_contents_item_id int not null unique references table_of_contents_items(id) on delete cascade
);

create or replace function table_of_contents_items_project_background_jobs(item table_of_contents_items)
  returns setof project_background_jobs
  security definer
  language sql
  stable
  as $$
    select 
      * 
    from 
      project_background_jobs 
    where 
      id = (
        select 
          project_background_job_id 
        from 
          esri_feature_layer_conversion_tasks 
        where 
          table_of_contents_item_id = item.id
      ) and session_is_admin(item.project_id);
  $$;

grant execute on function table_of_contents_items_project_background_jobs to seasketch_user;

comment on function table_of_contents_items_project_background_jobs is '@simpleCollections only';

create or replace function convert_esri_feature_layer_to_seasketch_hosted(table_of_contents_item_id int)
  returns project_background_jobs
  security definer
  language plpgsql
  as $$
    declare
      job project_background_jobs;
      data_source data_sources;
      data_layer data_layers;
      ds_type text;
      item_name text;
      pid int;
    begin
      select project_id, title into pid, item_name from table_of_contents_items where id = table_of_contents_item_id;
      -- Check permissions
      if session_is_admin(pid) = false then
        raise exception 'Permission denied';
      end if;
      -- Validate that the item is an esri feature layer
      select data_source_type into ds_type from table_of_contents_items where id = table_of_contents_item_id;
      if ds_type is null then
        raise exception 'Table of contents item not found';
      end if;
      if ds_type != 'arcgis-dynamic-mapserver-vector-sublayer' and ds_type != 'arcgis-vector' then
        raise exception 'Table of contents item is not an esri feature layer';
      end if;
      -- Create a background job and task
      insert into project_background_jobs(
        project_id,
        title,
        user_id,
        timeout_at,
        type
      ) values (
        pid,
        'Converting ' || item_name,
        nullif(current_setting('session.user_id', TRUE), '')::integer,
        now() + interval '30 minutes',
        'arcgis_import'
      ) returning * into job;
      insert into esri_feature_layer_conversion_tasks(
        project_background_job_id,
        table_of_contents_item_id
      ) values (
        job.id,
        table_of_contents_item_id
      );
      -- start graphile job
      perform graphile_worker.add_job('beginFeatureLayerConversion', json_build_object(
        'jobId', job.id
      ));
      return job;
    end;
  $$;

grant execute on function convert_esri_feature_layer_to_seasketch_hosted to seasketch_user;

create or replace function project_background_jobs_esri_feature_layer_conversion_task(job project_background_jobs)
  returns esri_feature_layer_conversion_tasks
  security definer
  language sql
  stable
  as $$
    select 
      * 
    from 
      esri_feature_layer_conversion_tasks 
    where 
      project_background_job_id = job.id;
  $$;

grant execute on function project_background_jobs_esri_feature_layer_conversion_task to seasketch_user;

alter table esri_feature_layer_conversion_tasks add column if not exists mapbox_gl_styles jsonb;

alter table esri_feature_layer_conversion_tasks add column if not exists metadata jsonb;

alter table esri_feature_layer_conversion_tasks add column if not exists location text;

alter table esri_feature_layer_conversion_tasks add column if not exists attribution text;

alter table data_sources add column if not exists was_converted_from_esri_feature_layer boolean not null default false;

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
