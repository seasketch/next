--! Previous: sha1:59babdcc365a2d4cc6220561e9be6b8e5af22e21
--! Hash: sha1:731e15baf31853c47519464eef9fc33e25aa8480

-- Enter migration here
alter table data_sources drop column if exists upload_task_id;
drop TRIGGER if exists trigger_data_upload_ready on data_upload_tasks;
drop function if exists create_data_upload;
drop function if exists dismiss_failed_upload;
drop function if exists submit_data_upload;
drop table if exists data_uploads;
drop table if exists data_upload_tasks;
drop type if exists data_upload_state;
drop type if exists data_upload_type;

create type data_upload_state as enum (
  'awaiting_upload', 
  'uploaded', 
  'processing',
  'fetching',
  'validating',
  'requires_user_input', 
  'converting_format',
  'tiling',
  'uploading_products',
  'complete', 
  'failed',
  'failed_dismissed'
);

update data_source_types set description = 'Combination of geojson and vector sources hosted on SeaSketch CDN' where type = 'seasketch-vector';

create type data_upload_type as enum ('vector', 'raster');

create table data_upload_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id int not null references projects(id) on delete cascade,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  started_at timestamp with time zone,
  state data_upload_state not null default 'awaiting_upload',
  progress numeric check (progress <= 1.0 and progress >= 0.0),
  -- upload goes in a special bucket with a 7 day ttl. `${uuid}/${filename}`
  filename text not null,
  content_type text not null,
  error_message text,
  outputs jsonb
);

comment on column data_upload_tasks.progress is '0.0 to 1.0 scale, applies to tiling process.';
comment on column data_upload_tasks.filename is 'Original name of file as uploaded by the user.';
comment on column data_upload_tasks.content_type is 'Content-Type of the original upload.';

grant select (id, project_id, created_at, state, progress, filename, content_type, error_message) on data_upload_tasks to seasketch_user;

alter table data_upload_tasks enable row level security;

create policy data_upload_tasks_select on data_upload_tasks using (session_is_admin(project_id));

create index on data_upload_tasks(state, project_id);
create index on data_upload_tasks(project_id);

create or replace function create_data_upload(filename text, project_id int, content_type text)
  returns data_upload_tasks
  language plpgsql
  security definer
  as $$
    declare
      upload data_upload_tasks;
    begin
      if session_is_admin(project_id) then
        insert into data_upload_tasks(project_id, filename, content_type) values (create_data_upload.project_id, create_data_upload.filename, create_data_upload.content_type) returning * into upload;
        return upload;
      else
        raise exception 'permission denied';
      end if;
    end;
  $$;

grant execute on function create_data_upload to seasketch_user;

alter table data_sources add column if not exists uploaded_source_filename text;
alter table data_sources add column if not exists uploaded_source_layername text;
alter table data_sources add column if not exists normalized_source_object_key text;
alter table data_sources add column if not exists normalized_source_bytes int;
alter table data_sources add column if not exists geostats jsonb;
alter table data_sources add column if not exists upload_task_id uuid references data_upload_tasks(id) on delete set null;
comment on column data_sources.uploaded_source_layername is 'If uploaded using a multi-layer file format (gdb), includes the layer ID. SEASKETCH_VECTOR sources only.';
comment on column data_sources.normalized_source_object_key is 'Sources are converted to flatgeobuf (vector, 4326) or geotif (raster) and store indefinitely so they may be processed into tilesets and to support the download function. SEASKETCH_VECTOR sources only.';
comment on column data_sources.normalized_source_bytes is 'Size of the normalized file. SEASKETCH_VECTOR sources only.';
comment on column data_sources.geostats is 'mapbox-geostats summary information for vector sources. Useful for cartographic tools and authoring popups. SEASKETCH_VECTOR sources only.';
comment on column data_sources.upload_task_id is 'UUID of the upload processing job associated with a SEASKETCH_VECTOR source.';

create or replace function submit_data_upload(id uuid)
  returns data_upload_tasks
  language plpgsql
  security definer
  as $$
    declare
      upload data_upload_tasks;
    begin
      if session_is_admin((select project_id from data_upload_tasks where data_upload_tasks.id = submit_data_upload.id)) then
        update data_upload_tasks set state = 'uploaded' where data_upload_tasks.id = submit_data_upload.id returning * into upload;
        return upload;
      else
        raise exception 'permission denied';
      end if;
    end;
  $$;

grant execute on function submit_data_upload to seasketch_user;

CREATE OR REPLACE FUNCTION create_upload_task_job() RETURNS TRIGGER AS $$
BEGIN
    perform graphile_worker.add_job('processDataUpload', json_build_object('uploadId', NEW.id), max_attempts := 1);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_data_upload_ready
AFTER UPDATE ON data_upload_tasks
FOR EACH ROW
WHEN (OLD.state = 'awaiting_upload' and NEW.state = 'uploaded')
EXECUTE PROCEDURE create_upload_task_job();

create or replace function dismiss_failed_upload(id uuid)
  returns data_upload_tasks
  language plpgsql
  security definer
  as $$
    declare
      upload data_upload_tasks;
    begin
      if session_is_admin((select project_id from data_upload_tasks where data_upload_tasks.id = dismiss_failed_upload.id)) then
        update data_upload_tasks set state = 'failed_dismissed' where data_upload_tasks.id = dismiss_failed_upload.id returning * into upload;
        return upload;
      else
        raise exception 'permission denied';
      end if;
    end;
  $$;

grant execute on function dismiss_failed_upload to seasketch_user;


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
    elsif source_type != 'seasketch-mvt' then
      if new.source_layer is not null then
        raise 'Only Layers with data_sources of type "vector" or "seasketch-mvt should specify a source_layer';
      end if;
    end if;
    if (source_type = 'vector' or source_type = 'geojson' or source_type = 'seasketch-vector' or source_type = 'seasketch-mvt') then
      if new.mapbox_gl_styles is null then
        raise 'Vector layers must specify mapbox_gl_styles';
      end if;
    else
      if new.mapbox_gl_styles is not null then
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

delete from data_sources where type = 'seasketch-mvt';
delete from data_source_types where type = 'seasketch-mvt';
insert into data_source_types (type, description) values ('seasketch-mvt', 'SeaSketch-hosted vector tiles');

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
    if (new.byte_length is not null and new.type != 'seasketch-vector' and new.type != 'seasketch-mvt') then
      raise 'byte_length can only be set on seasketch-vector sources';
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
    if new.import_type is not null and new.type != 'seasketch-vector' and new.type != 'seasketch-mvt' then
      raise 'import_type property is only allowed for seasketch-vector sources';
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
      new.url = null;
    end if;
    return new;
  end;
$$;
