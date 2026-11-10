--! Previous: sha1:908d2a135d675dcb27cfb70eeaa6143dc135bbc2
--! Hash: sha1:8e5209b56be9df6cacfbb6235370bc7b17c26009
--! Message: selective overlay publishing

-- Selective overlay publishing.
--
-- publish_table_of_contents_items copies a chosen set of draft TOC items onto
-- the published tree and leaves every other published item alone. It does not
-- publish sort_index or z_index: an updated item keeps its published position
-- and a new item is appended. Full publish (publish_table_of_contents) makes
-- the published tree match the draft, including order, but copies only the
-- items that differ.
--
-- An item is pending when its draft state differs from its published copy
-- (_overlay_changed_stable_ids), or when only one side exists. The changelog
-- only explains a pending item; it does not decide whether one exists.
--
-- published_at records when each published row was written. The full-publish
-- review and the comments list use it to drop items that a partial publish
-- already shipped.
--
-- While seasketch.publishing is set, per-row triggers that repeat the same
-- project update, activity job, validation, or changelog work for every
-- copied row return immediately. Each publish does that work once.

-- Sibling reorders are recorded like stacking order. Added before the
-- functions below cast it. A new enum value cannot be used until this
-- statement's transaction commits, and these functions only cast it at run time.
do $$
begin
  if not exists (
    select 1
    from pg_enum
    join pg_type on pg_enum.enumtypid = pg_type.oid
    where pg_type.typname = 'change_log_field_group'
      and pg_enum.enumlabel = 'layers:list-order-change'
  ) then
    alter type public.change_log_field_group add value 'layers:list-order-change';
  end if;
end
$$;

alter table public.table_of_contents_items
  add column if not exists published_at timestamp with time zone;

comment on column public.table_of_contents_items.published_at is
  'When a publish wrote this row. Null on draft rows.';

-- Removed in an earlier revision of this migration.
drop trigger if exists trg_toc_stamp_published_at on public.table_of_contents_items;
drop function if exists public.trg_toc_stamp_published_at();
drop function if exists public._publish_place_ids(text[], text[], text[]);
drop function if exists public.projects_layer_stack_order_pending(public.projects);

-- Deleting a published source cascades to its upload outputs. The cleanup
-- trigger looks for other outputs that share the same remote object.
create index if not exists data_upload_outputs_remote_idx
  on public.data_upload_outputs (remote);

--
-- Per-row trigger bailouts while publishing
--

create or replace function public.table_of_contents_items_project_update()
  returns trigger
  language plpgsql
  security definer
as $$
begin
  -- publishing-bailout
  if coalesce(current_setting('seasketch.publishing', true), '') = 'true' then
    return new;
  end if;
  if coalesce(current_setting('seasketch.skip_library_source_side_effects', true), '') = 'true' then
    return new;
  end if;
  -- The flag is what the Publish button reads. Set it from the draft-vs-published
  -- diff so an edit that is immediately undone (changelog coalesces to nothing,
  -- and a full publish would copy nothing) turns the button off again.
  update projects
  set draft_table_of_contents_has_changes =
    public.overlay_list_has_unpublished_changes(id)
  where id = coalesce(new.project_id, old.project_id);
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Publish queues recordProjectActivity once instead of once per deleted row.
create or replace function public.record_project_activity_on_delete()
  returns trigger
  language plpgsql
as $$
begin
  -- publishing-bailout
  if coalesce(current_setting('seasketch.publishing', true), '') = 'true' then
    return old;
  end if;
  perform graphile_worker.add_job(
    'recordProjectActivity',
    payload := json_build_object(
      'projectId', old.project_id
    ),
    run_at := now() + '10 seconds',
    queue_name := 'recordProjectActivity',
    job_key := 'recordProjectActivity:' || old.project_id
  );
  return old;
end;
$$;

create or replace function public.after_data_layers_update_or_delete_set_draft_table_of_contents_()
  returns trigger
  language plpgsql
  security definer
as $$
begin
  -- publishing-bailout
  if coalesce(current_setting('seasketch.publishing', true), '') = 'true' then
    return new;
  end if;
  if coalesce(current_setting('seasketch.skip_library_source_side_effects', true), '') = 'true' then
    return new;
  end if;
  update projects p
  set draft_table_of_contents_has_changes =
    public.overlay_list_has_unpublished_changes(p.id)
  where id in (
    select tocs.project_id
    from table_of_contents_items as tocs
    where tocs.data_layer_id = coalesce(old.id, new.id)
  );
  return coalesce(new, old);
end;
$$;

create or replace function public.after_data_sources_update_or_delete_set_draft_table_of_contents()
  returns trigger
  language plpgsql
  security definer
as $$
declare
  v_library_template_id text;
  v_project_id int;
begin
  -- publishing-bailout
  if coalesce(current_setting('seasketch.publishing', true), '') = 'true' then
    return new;
  end if;
  if coalesce(current_setting('seasketch.skip_library_source_side_effects', true), '') = 'true' then
    return new;
  end if;

  if tg_op = 'DELETE' then
    v_library_template_id := old.data_library_template_id;
    v_project_id := old.project_id;
  else
    v_library_template_id := new.data_library_template_id;
    v_project_id := new.project_id;
  end if;

  -- Live library sources: do not fan out "unpublished changes" to every
  -- consumer project. The owning (Data Library) project still gets the flag.
  if v_library_template_id is not null then
    update projects p
      set draft_table_of_contents_has_changes =
        public.overlay_list_has_unpublished_changes(p.id)
      where id = v_project_id;
    return coalesce(new, old);
  end if;

  update projects p
  set draft_table_of_contents_has_changes =
    public.overlay_list_has_unpublished_changes(p.id)
  where id in (
    select tocs.project_id
    from table_of_contents_items as tocs
    where tocs.data_layer_id in (
      select data_layers.id from data_layers where data_layers.data_source_id = coalesce(old.id, new.id)
    )
  );
  return coalesce(new, old);
end;
$$;

create or replace function public.acl_update_draft_toc_has_changes()
  returns trigger
  language plpgsql
  security definer
as $$
begin
  -- publishing-bailout
  if coalesce(current_setting('seasketch.publishing', true), '') = 'true' then
    return new;
  end if;
  update projects p
  set draft_table_of_contents_has_changes =
    public.overlay_list_has_unpublished_changes(p.id)
  where id = (
    select project_id from table_of_contents_items where id = (
      select table_of_contents_item_id from access_control_lists where id = new.id
    )
  );
  return new;
end;
$$;

-- Published copies repeat draft values that were validated when the draft was
-- written, and carry an explicit z_index.
create or replace function public.before_insert_or_update_data_layers_trigger()
  returns trigger
  language plpgsql
as $$
declare
  source_type text;
  max_z int;
begin
  -- publishing-bailout
  if coalesce(current_setting('seasketch.publishing', true), '') = 'true' then
    return new;
  end if;
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
  if old is null and new.z_index = 0 then
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

-- Publish copies bucket_id and object_key from the draft source.
create or replace function public.before_insert_or_update_data_sources_trigger()
  returns trigger
  language plpgsql
as $$
declare
  bucket_id text;
begin
  -- publishing-bailout
  if coalesce(current_setting('seasketch.publishing', true), '') = 'true' then
    return new;
  end if;
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
  if new.tile_size is not null and (new.type != 'raster' and new.type != 'raster-dem' and new.type != 'vector' and new.type != 'seasketch-mvt' and new.type != 'seasketch-raster' and new.type != 'inaturalist') then
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
  if new.query_parameters is not null and (new.type != 'arcgis-vector' and new.type != 'arcgis-dynamic-mapserver' and new.type != 'inaturalist') then
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

-- Publish copies the draft layer's interactivity settings row.
create or replace function public.before_layer_insert_create_interactivity_settings_func()
  returns trigger
  language plpgsql
  security definer
as $$
declare
  iid int;
begin
  -- publishing-bailout
  if coalesce(current_setting('seasketch.publishing', true), '') = 'true' then
    return new;
  end if;
  if new.interactivity_settings_id is null then
    insert into interactivity_settings (type) values ('NONE') returning id into iid;
    new.interactivity_settings_id = iid;
  end if;
  return new;
end;
$$;

create or replace function public.trg_changelog_data_layers_data_source_layer_uploaded()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
as $$
declare
  v_uploaded_by     int;
  v_filename        text;
  v_changelog       text;
  v_summary         jsonb;
  v_url             text;
  v_toc             record;
begin
  -- publishing-bailout
  if coalesce(current_setting('seasketch.publishing', true), '') = 'true' then
    return new;
  end if;
  if coalesce(current_setting('seasketch.skip_library_source_side_effects', true), '') = 'true' then
    return new;
  end if;

  if old.data_source_id is not distinct from new.data_source_id then
    return new;
  end if;

  select ds.uploaded_by, ds.uploaded_source_filename, ds.changelog, ds.url
  into v_uploaded_by, v_filename, v_changelog, v_url
  from data_sources ds
  where ds.id = new.data_source_id;

  if v_uploaded_by is null or v_filename is null or btrim(v_filename) = '' then
    return new;
  end if;

  v_summary := jsonb_build_object('filename', v_filename, 'replacement', true);
  if v_changelog is not null then
    v_summary := v_summary || jsonb_build_object('changelog', v_changelog);
  end if;

  for v_toc in
    select toc.id, toc.project_id
    from table_of_contents_items toc
    where toc.data_layer_id = new.id
      and toc.is_draft = true
      and toc.is_folder = false
  loop
    perform record_changelog(
      v_toc.project_id,
      v_uploaded_by,
      'table_of_contents_items',
      v_toc.id,
      'layer:uploaded'::change_log_field_group,
      '{}'::jsonb,
      v_summary,
      null,
      null,
      jsonb_build_object('data_source_id', new.data_source_id, 'url', v_url)
    );
  end loop;

  return new;
end;
$$;

create or replace function public.trg_changelog_table_of_contents_items_insert_created()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
as $$
declare
  v_editor int;
begin
  -- publishing-bailout
  if coalesce(current_setting('seasketch.publishing', true), '') = 'true' then
    return new;
  end if;
  if not new.is_draft or not new.is_folder then
    return new;
  end if;

  v_editor := nullif(current_setting('session.user_id', true), '')::int;
  if v_editor is null then
    return new;
  end if;

  perform record_changelog(
    new.project_id,
    v_editor,
    'table_of_contents_items',
    new.id,
    'folder:created'::change_log_field_group,
    '{}'::jsonb,
    jsonb_build_object('title', new.title),
    null,
    null,
    null
  );

  return new;
end;
$$;

create or replace function public.trg_changelog_table_of_contents_items_insert_layer_uploaded()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
as $$
declare
  v_uploaded_by     int;
  v_filename        text;
  v_data_source_id  int;
  v_url             text;
begin
  -- publishing-bailout
  if coalesce(current_setting('seasketch.publishing', true), '') = 'true' then
    return new;
  end if;
  if not new.is_draft or new.is_folder or new.data_layer_id is null then
    return new;
  end if;

  select ds.id, ds.uploaded_by, ds.uploaded_source_filename, ds.url
  into v_data_source_id, v_uploaded_by, v_filename, v_url
  from data_layers dl
  join data_sources ds on ds.id = dl.data_source_id
  where dl.id = new.data_layer_id;

  if v_uploaded_by is null or v_filename is null or btrim(v_filename) = '' then
    return new;
  end if;

  perform record_changelog(
    new.project_id,
    v_uploaded_by,
    'table_of_contents_items',
    new.id,
    'layer:uploaded'::change_log_field_group,
    '{}'::jsonb,
    jsonb_build_object('filename', v_filename),
    null,
    null,
    jsonb_build_object('data_source_id', v_data_source_id, 'url', v_url)
  );

  return new;
end;
$$;

-- Published rows are written only by publish, which copies data_source_type,
-- original_source_upload_available, and path itself. The bailout also lets
-- publish rewrite path on published rows.
create or replace function public.before_insert_or_update_table_of_contents_items_trigger()
  returns trigger
  language plpgsql
  security definer
as $$
begin
  -- publishing-bailout
  if coalesce(current_setting('seasketch.publishing', true), '') = 'true' and new.is_draft = false then
    return new;
  end if;
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
  if old.is_draft = false and coalesce(current_setting('seasketch.skip_library_source_side_effects', true), '') != 'true' then
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
  return new;
end;
$$;

-- after_deleted__data_upload_outputs keeps running during publish. It queues
-- an S3 object for cleanup when the last row that references it is deleted,
-- for example when publish drops the published copy of a deleted layer.
-- An earlier revision of this migration skipped it.
create or replace function public.after_deleted__data_upload_outputs()
  returns trigger
  language plpgsql
  security definer
as $$
begin
  -- Check to see if there are any other data_upload_output records with the same remote value
  if not exists (
    select 1 from data_upload_outputs where remote = old.remote and id != old.id
  ) then
    insert into deleted_data_upload_outputs (remote, data_upload_output_data) values (old.remote, row_to_json(old));
  end if;
  return old;
end;
$$;

-- Existing published rows were written by the last full publish. Stamping
-- them under the bailout keeps draft_table_of_contents_has_changes as it is.
select set_config('seasketch.publishing', 'true', true);
update public.table_of_contents_items t
set published_at = p.table_of_contents_last_published
from public.projects p
where p.id = t.project_id
  and t.is_draft = false
  and t.published_at is null
  and p.table_of_contents_last_published is not null;
select set_config('seasketch.publishing', 'false', true);

--
-- Full publish
--

-- Full publish makes the published tree match the draft, including list order
-- and stacking order. It copies only the items whose published copy differs
-- from the draft (pending_publish_items_for_project), deletes removed items,
-- and writes sort_index, path, and z_index onto the published rows that are
-- already current. Published rows that match the draft are left in place.
--
-- Columns are copied by _publish_copy_draft_toc_item and
-- _publish_copy_data_source, and compared by _overlay_changed_stable_ids and
-- _publishable_source_differs. A new column must be added to all of them.
create or replace function public.publish_table_of_contents("projectId" integer)
  returns setof public.table_of_contents_items
  language plpgsql
  security definer
  set search_path to public, pg_temp
as $$
declare
  v_editor int;
  v_layer_count int;
  v_dup text;
  v_detached int;
  v_detached_ids int[] := '{}'::int[];
begin
  perform pg_advisory_xact_lock(hashtext('publish_toc:' || "projectId"::text));
  if session_is_admin("projectId") = false then
    raise 'Permission denied. Must be a project admin';
  end if;
  perform set_config('seasketch.publishing', 'true', true);

  -- Publishes that ran concurrently before the publish lock existed could
  -- leave two published rows with one stable_id. Remove them all so the
  -- draft item is copied again.
  for v_dup in
    select stable_id
    from table_of_contents_items
    where project_id = "projectId" and not is_draft
    group by stable_id
    having count(*) > 1
  loop
    while exists (
      select 1 from table_of_contents_items
      where project_id = "projectId" and not is_draft and stable_id = v_dup
    ) loop
      v_detached := public._unpublish_toc_stable_id("projectId", v_dup);
      if v_detached is not null then
        v_detached_ids := v_detached_ids || v_detached;
      end if;
    end loop;
  end loop;
  delete from data_sources s
  where s.id = any(v_detached_ids)
    and not exists (select 1 from data_layers dl where dl.data_source_id = s.id);

  if to_regclass('pg_temp._units') is not null then
    drop table pg_temp._units;
  end if;
  create temp table _units on commit drop as
    select * from public.pending_publish_items_for_project("projectId");

  perform public._publish_units(
    "projectId",
    (select coalesce(array_agg(stable_id), '{}'::text[]) from _units),
    true
  );

  perform set_config('seasketch.publishing', 'false', true);

  update projects
  set
    draft_table_of_contents_has_changes = false,
    table_of_contents_last_published = now()
  where id = "projectId";

  perform public._publish_record_project_activity("projectId");

  v_editor := nullif(current_setting('session.user_id', true), '')::int;
  if v_editor is not null then
    select count(*)::int into v_layer_count
    from table_of_contents_items
    where project_id = "projectId"
      and is_draft = true
      and is_folder = false;

    perform public._record_overlay_publish(
      "projectId",
      v_editor,
      v_layer_count,
      true,
      (select coalesce(array_agg(stable_id), '{}'::text[]) from _units)
    );
  end if;

  return query select * from table_of_contents_items
    where project_id = "projectId" and is_draft = false;
end;
$$;

--
-- Shared publish helpers
--

-- One recordProjectActivity job per publish. The per-row delete trigger is
-- skipped while publishing.
create or replace function public._publish_record_project_activity(p_project_id integer)
  returns void
  language plpgsql
  security definer
  set search_path to public, pg_temp
as $$
begin
  -- plpgsql, not sql: graphile_worker is installed by the worker at runtime,
  -- so a sql function body cannot be validated when this migration commits.
  perform graphile_worker.add_job(
    'recordProjectActivity',
    payload := json_build_object('projectId', p_project_id),
    run_at := now() + '10 seconds',
    queue_name := 'recordProjectActivity',
    job_key := 'recordProjectActivity:' || p_project_id
  );
end;
$$;

comment on function public._publish_record_project_activity(integer) is '@omit';
revoke all on function public._publish_record_project_activity(integer) from public;

-- Copies a draft data source and its upload outputs for published layers.
create or replace function public._publish_copy_data_source(
  p_source_id integer,
  p_project_id integer
)
  returns integer
  language plpgsql
  security definer
  set search_path to public, pg_temp
as $$
declare
  v_copy_id int;
begin
  -- TODO: This function will have to be updated whenever the schema
  -- changes since these columns are hard coded... no way around it.
  -- Also update _publishable_source_differs.
  insert into data_sources (
    project_id,
    type,
    attribution,
    bounds,
    maxzoom,
    minzoom,
    url,
    scheme,
    tiles,
    tile_size,
    encoding,
    buffer,
    cluster,
    cluster_max_zoom,
    cluster_properties,
    cluster_radius,
    generate_id,
    line_metrics,
    promote_id,
    tolerance,
    coordinates,
    urls,
    query_parameters,
    use_device_pixel_ratio,
    import_type,
    original_source_url,
    enhanced_security,
    byte_length,
    supports_dynamic_layers,
    uploaded_source_filename,
    uploaded_source_layername,
    normalized_source_object_key,
    normalized_source_bytes,
    geostats,
    upload_task_id,
    translated_props,
    arcgis_fetch_strategy,
    temporal,
    created_by,
    bucket_id,
    object_key
  )
  select
    p_project_id,
    type,
    attribution,
    bounds,
    maxzoom,
    minzoom,
    url,
    scheme,
    tiles,
    tile_size,
    encoding,
    buffer,
    cluster,
    cluster_max_zoom,
    cluster_properties,
    cluster_radius,
    generate_id,
    line_metrics,
    promote_id,
    tolerance,
    coordinates,
    urls,
    query_parameters,
    use_device_pixel_ratio,
    import_type,
    original_source_url,
    enhanced_security,
    byte_length,
    supports_dynamic_layers,
    uploaded_source_filename,
    uploaded_source_layername,
    normalized_source_object_key,
    normalized_source_bytes,
    geostats,
    upload_task_id,
    translated_props,
    arcgis_fetch_strategy,
    temporal,
    created_by,
    bucket_id,
    object_key
  from data_sources
  where id = p_source_id
  returning id into v_copy_id;

  insert into data_upload_outputs (
    data_source_id,
    project_id,
    type,
    created_at,
    url,
    remote,
    is_original,
    size,
    filename,
    original_filename,
    source_processing_job_key,
    epsg
  )
  select
    v_copy_id,
    project_id,
    type,
    created_at,
    url,
    remote,
    is_original,
    size,
    filename,
    original_filename,
    source_processing_job_key,
    epsg
  from data_upload_outputs
  where data_source_id = p_source_id;

  return v_copy_id;
end;
$$;

comment on function public._publish_copy_data_source(integer, integer) is '@omit';
revoke all on function public._publish_copy_data_source(integer, integer) from public;

-- Upload outputs publish copies with a source, as one comparable value.
-- Reporting jobs and PMTiles replacement add outputs to an existing source.
create or replace function public._publishable_upload_outputs(p_source_id integer)
  returns jsonb
  language sql
  stable
  security definer
  set search_path to public, pg_temp
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_array(
        o.type, o.url, o.remote, o.is_original, o.size, o.filename,
        o.original_filename, o.source_processing_job_key, o.epsg
      )
      order by o.type, o.remote, o.url, o.filename
    ),
    '[]'::jsonb
  )
  from data_upload_outputs o
  where o.data_source_id = p_source_id;
$$;

comment on function public._publishable_upload_outputs(integer) is '@omit';
revoke all on function public._publishable_upload_outputs(integer) from public;

-- True when a published copy of a source would not match the draft source.
-- Covers every column _publish_copy_data_source writes except created_by and
-- the upload outputs' created_at.
create or replace function public._publishable_source_differs(
  a public.data_sources,
  b public.data_sources
)
  returns boolean
  language sql
  stable
as $$
  select (
    a.type, a.attribution, a.bounds, a.maxzoom, a.minzoom, a.url, a.scheme,
    a.tiles, a.tile_size, a.encoding, a.buffer, a.cluster, a.cluster_max_zoom,
    a.cluster_properties, a.cluster_radius, a.generate_id, a.line_metrics,
    a.promote_id, a.tolerance, a.coordinates, a.urls, a.query_parameters,
    a.use_device_pixel_ratio, a.import_type, a.original_source_url,
    a.enhanced_security, a.byte_length, a.supports_dynamic_layers,
    a.uploaded_source_filename, a.uploaded_source_layername,
    a.normalized_source_object_key, a.normalized_source_bytes, a.upload_task_id,
    a.translated_props, a.arcgis_fetch_strategy, a.temporal, a.bucket_id,
    a.object_key, a.geostats
  ) is distinct from (
    b.type, b.attribution, b.bounds, b.maxzoom, b.minzoom, b.url, b.scheme,
    b.tiles, b.tile_size, b.encoding, b.buffer, b.cluster, b.cluster_max_zoom,
    b.cluster_properties, b.cluster_radius, b.generate_id, b.line_metrics,
    b.promote_id, b.tolerance, b.coordinates, b.urls, b.query_parameters,
    b.use_device_pixel_ratio, b.import_type, b.original_source_url,
    b.enhanced_security, b.byte_length, b.supports_dynamic_layers,
    b.uploaded_source_filename, b.uploaded_source_layername,
    b.normalized_source_object_key, b.normalized_source_bytes, b.upload_task_id,
    b.translated_props, b.arcgis_fetch_strategy, b.temporal, b.bucket_id,
    b.object_key, b.geostats
  )
  or public._publishable_upload_outputs(a.id)
    is distinct from public._publishable_upload_outputs(b.id);
$$;

comment on function public._publishable_source_differs(public.data_sources, public.data_sources) is '@omit';

-- Columns publish copies from an overlay data table, as one comparable value.
create or replace function public._publishable_data_tables(p_toc_id integer)
  returns jsonb
  language sql
  stable
  security definer
  set search_path to public, pg_temp
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'stable_id', odt.stable_id,
        'name', odt.name,
        'join_column', odt.join_column,
        'overlay_join_column', odt.overlay_join_column,
        'row_count', odt.row_count,
        'version', odt.version,
        'parquet_remote', odt.parquet_remote,
        'parquet_url', odt.parquet_url,
        'column_stats_remote', odt.column_stats_remote,
        'visualization_columns', odt.visualization_columns,
        'visualization_ops', odt.visualization_ops,
        'calculation_mode', odt.calculation_mode,
        'additional_replicate_identifiers', odt.additional_replicate_identifiers,
        'replicate_label', odt.replicate_label,
        'replicate_label_custom', odt.replicate_label_custom,
        'within_replicate_operations', odt.within_replicate_operations,
        'across_replicate_operations', odt.across_replicate_operations,
        'subject_column', odt.subject_column,
        'observation_detail_columns', odt.observation_detail_columns,
        'coverage_mode', odt.coverage_mode,
        'coverage_remote', odt.coverage_remote,
        'effort_marker_values', odt.effort_marker_values,
        'excluded_values', odt.excluded_values,
        'required_filter_columns', odt.required_filter_columns,
        'hidden_filter_columns', odt.hidden_filter_columns,
        'filter_column_labels', odt.filter_column_labels,
        'temporal', odt.temporal,
        'organism', odt.organism,
        'nodata_values', odt.nodata_values,
        'source_parquet_remote', odt.source_parquet_remote,
        'description', odt.description
      )
      order by odt.stable_id
    ),
    '[]'::jsonb
  )
  from overlay_data_tables odt
  where odt.table_of_contents_item_id = p_toc_id
    and odt.deleted_at is null;
$$;

comment on function public._publishable_data_tables(integer) is '@omit';
revoke all on function public._publishable_data_tables(integer) from public;

-- Stable ids present in both trees whose published copy no longer matches the
-- draft: the TOC row (including a move), its layer, source, interactivity,
-- access control, or data tables. sort_index and z_index are not compared.
-- Keep in step with the columns publish copies.
create or replace function public._overlay_changed_stable_ids(p_project_id integer)
  returns setof text
  language sql
  stable
  security definer
  set search_path to public, pg_temp
as $$
  select d.stable_id
  from table_of_contents_items d
  join table_of_contents_items p
    on p.project_id = d.project_id
   and p.stable_id = d.stable_id
   and not p.is_draft
  left join data_layers dd on dd.id = d.data_layer_id
  left join data_layers pd on pd.id = p.data_layer_id
  left join data_sources ds on ds.id = dd.data_source_id
  left join data_sources ps on ps.id = pd.data_source_id
  left join interactivity_settings di on di.id = dd.interactivity_settings_id
  left join interactivity_settings pi on pi.id = pd.interactivity_settings_id
  left join access_control_lists da on da.table_of_contents_item_id = d.id
  left join access_control_lists pa on pa.table_of_contents_item_id = p.id
  where d.project_id = p_project_id
    and d.is_draft
    and (
      (
        d.parent_stable_id, d.title, d.is_folder, d.show_radio_children,
        d.is_click_off_only, d.metadata, d.bounds, d.hide_children,
        d.geoprocessing_reference_id, d.translated_props, d.enable_download,
        d.enable_data_tables, d.data_table_join_column,
        d.copied_from_data_library_template_id, d.hide_arcgis_rest_link,
        d.data_source_type, d.original_source_upload_available
      ) is distinct from (
        p.parent_stable_id, p.title, p.is_folder, p.show_radio_children,
        p.is_click_off_only, p.metadata, p.bounds, p.hide_children,
        p.geoprocessing_reference_id, p.translated_props, p.enable_download,
        p.enable_data_tables, p.data_table_join_column,
        p.copied_from_data_library_template_id, p.hide_arcgis_rest_link,
        p.data_source_type, p.original_source_upload_available
      )
      or (
        dd.source_layer, dd.sublayer, dd.sublayer_type, dd.render_under,
        dd.mapbox_gl_styles
      ) is distinct from (
        pd.source_layer, pd.sublayer, pd.sublayer_type, pd.render_under,
        pd.mapbox_gl_styles
      )
      or (
        di.type, di.short_template, di.long_template, di.cursor, di.title
      ) is distinct from (
        pi.type, pi.short_template, pi.long_template, pi.cursor, pi.title
      )
      or (
        ds.id is distinct from ps.id
        and (
          ds.id is null
          or ps.id is null
          or ds.data_library_template_id is not null
          or ps.data_library_template_id is not null
          or public._publishable_source_differs(ds, ps)
        )
      )
      or coalesce(da.type, 'public') is distinct from coalesce(pa.type, 'public')
      or (
        (da.type = 'group' or pa.type = 'group')
        and (
          select coalesce(array_agg(g.group_id order by g.group_id), '{}'::int[])
          from access_control_list_groups g
          where g.access_control_list_id = da.id
        ) is distinct from (
          select coalesce(array_agg(g.group_id order by g.group_id), '{}'::int[])
          from access_control_list_groups g
          where g.access_control_list_id = pa.id
        )
      )
      or (
        not d.is_folder
        and public._publishable_data_tables(d.id)
          is distinct from public._publishable_data_tables(p.id)
      )
    );
$$;

comment on function public._overlay_changed_stable_ids(integer) is '@omit';
revoke all on function public._overlay_changed_stable_ids(integer) from public;

--
-- Pending units
--

drop function if exists public.projects_pending_publish_items(public.projects);
drop function if exists public.pending_publish_items_for_project(integer);
drop type if exists public.pending_publish_item;
create type public.pending_publish_item as (
  stable_id text,
  kind text,
  title text,
  is_folder boolean,
  parent_stable_id text,
  path text,
  requires_stable_ids text[],
  bundle_id text,
  draft_id integer,
  included_in_bundle boolean
);

-- Added: a draft row with no published row. Removed: a published row with no
-- draft row. Updated: _overlay_changed_stable_ids.
--
-- requires_stable_ids: the new folders an item must be published with so it
-- has a parent on the published tree; for an item moved into a folder that is
-- still inside it on the published tree, the moves that take that folder out;
-- and for a removed folder, the items that were moved out of it before it was
-- deleted.
--
-- bundle_id groups units that publish together. A removed folder is bundled
-- with the removed items inside it (bundle_id = the folder's stable_id),
-- including items that were moved into it after the last publish and deleted
-- with it. Units on a non-library source whose source-level fields changed
-- are bundled as 'source:<draft source id>', so the published layers keep
-- sharing one copy. The first unit of a bundle is its checkbox;
-- included_in_bundle marks the rest.
create or replace function public.pending_publish_items_for_project(p_project_id integer)
  returns setof public.pending_publish_item
  language sql
  stable
  security definer
  set search_path to public, pg_temp
as $$
  with recursive draft as (
    select id, stable_id, parent_stable_id, title, is_folder, path, data_layer_id
    from table_of_contents_items
    where project_id = p_project_id and is_draft
  ),
  published as (
    select id, stable_id, parent_stable_id, title, is_folder, path, data_layer_id
    from table_of_contents_items
    where project_id = p_project_id and not is_draft
  ),
  units as (
    select
      d.stable_id, 'added'::text as kind, d.title, d.is_folder,
      d.parent_stable_id, d.path, d.id as draft_id
    from draft d
    where not exists (select 1 from published p where p.stable_id = d.stable_id)
    union all
    select
      d.stable_id, 'updated'::text, d.title, d.is_folder,
      d.parent_stable_id, d.path, d.id
    from draft d
    where d.stable_id in (
      select public._overlay_changed_stable_ids(p_project_id)
    )
    union all
    select
      p.stable_id, 'removed'::text, p.title, p.is_folder,
      p.parent_stable_id, p.path, null::int
    from published p
    where not exists (select 1 from draft d where d.stable_id = p.stable_id)
  ),
  -- The unbroken run of new folders above a new or updated item.
  added_chain(unit_id, ancestor_id) as (
    select u.stable_id, a.stable_id
    from units u
    join units a on a.kind = 'added' and a.stable_id = u.parent_stable_id
    where u.kind in ('added', 'updated')
    union all
    select c.unit_id, a.stable_id
    from added_chain c
    join units cur on cur.kind = 'added' and cur.stable_id = c.ancestor_id
    join units a on a.kind = 'added' and a.stable_id = cur.parent_stable_id
  ),
  added_requires as (
    select unit_id, array_agg(distinct ancestor_id) as reqs
    from added_chain
    group by unit_id
  ),
  -- An item moved into a folder that is still inside it on the published
  -- tree needs the moves that take that folder out, or publishing it alone
  -- would make a cycle.
  subtree_requires as (
    select u.stable_id as unit_id, array_agg(distinct m.stable_id) as reqs
    from units u
    join published self on self.stable_id = u.stable_id
    join published new_parent
      on new_parent.stable_id = u.parent_stable_id
     and self.path @> new_parent.path
    join published x
      on self.path @> x.path
     and x.path @> new_parent.path
     and x.stable_id <> u.stable_id
    join units m
      on m.stable_id = x.stable_id
     and m.kind = 'updated'
     and m.parent_stable_id is distinct from x.parent_stable_id
    where u.kind = 'updated'
    group by u.stable_id
  ),
  -- Draft parent recorded when the item was deleted. Published parent is not
  -- enough for a layer that was moved into a folder after publish and then
  -- deleted with that folder: its published parent is still the old one.
  deleted_draft_parent as (
    select distinct on (cl.from_blob->>'stable_id')
      cl.from_blob->>'stable_id' as stable_id,
      cl.from_blob->>'parent_stable_id' as parent_stable_id
    from change_logs cl
    where cl.project_id = p_project_id
      and cl.field_group in ('layer:deleted', 'folder:deleted')
      and cl.from_blob ? 'stable_id'
      and coalesce(cl.from_blob->>'parent_stable_id', '') <> ''
    order by cl.from_blob->>'stable_id', cl.last_at desc
  ),
  -- Each removed item, with the outermost removed folder it sits in.
  removal_parent as (
    select
      r.stable_id,
      case
        when exists (
          select 1
          from units published_parent
          where published_parent.kind = 'removed'
            and published_parent.stable_id = r.parent_stable_id
        ) then r.parent_stable_id
        when exists (
          select 1
          from units draft_parent
          where draft_parent.kind = 'removed'
            and draft_parent.stable_id = dp.parent_stable_id
        ) then dp.parent_stable_id
      end as parent_stable_id
    from units r
    left join deleted_draft_parent dp on dp.stable_id = r.stable_id
    where r.kind = 'removed'
  ),
  removal_tree(root_id, stable_id, seen) as (
    select r.stable_id, r.stable_id, array[r.stable_id]
    from removal_parent r
    where r.parent_stable_id is null
    union all
    select t.root_id, child.stable_id, t.seen || child.stable_id
    from removal_tree t
    join removal_parent child
      on child.parent_stable_id = t.stable_id
     and child.stable_id <> all (t.seen)
  ),
  removal_sizes as (
    select root_id, count(*) as size
    from removal_tree
    group by root_id
  ),
  -- Published children of removed items that still exist in draft were moved
  -- out first. They are updated units, and the removal needs them.
  removal_requires as (
    select t.root_id as unit_id, array_agg(distinct moved.stable_id) as reqs
    from removal_tree t
    join published child on child.parent_stable_id = t.stable_id
    join units moved
      on moved.stable_id = child.stable_id
     and moved.kind = 'updated'
    group by t.root_id
  ),
  dirty_sources as (
    select distinct dd.data_source_id
    from units u
    join draft d on d.stable_id = u.stable_id
    join published p on p.stable_id = u.stable_id
    join data_layers dd on dd.id = d.data_layer_id
    join data_layers pd on pd.id = p.data_layer_id
    join data_sources ds
      on ds.id = dd.data_source_id
     and ds.data_library_template_id is null
    join data_sources ps on ps.id = pd.data_source_id
    where u.kind = 'updated'
      and ds.id <> ps.id
      and public._publishable_source_differs(ds, ps)
  ),
  source_members as (
    select u.stable_id, dd.data_source_id
    from units u
    join draft d on d.stable_id = u.stable_id
    join data_layers dd on dd.id = d.data_layer_id
    join dirty_sources s on s.data_source_id = dd.data_source_id
    where u.kind in ('added', 'updated')
  ),
  source_bundles as (
    select data_source_id, min(stable_id) as leader_id
    from source_members
    group by data_source_id
    having count(*) > 1
  ),
  bundled as (
    select
      u.stable_id,
      u.kind,
      u.title,
      u.is_folder,
      u.parent_stable_id,
      u.path::text as path,
      coalesce(ar.reqs, '{}'::text[])
        || coalesce(sr.reqs, '{}'::text[])
        || coalesce(rr.reqs, '{}'::text[]) as requires_stable_ids,
      u.draft_id,
      case
        when rs.size > 1 then rt.root_id
        when sb.data_source_id is not null then 'source:' || sb.data_source_id::text
      end as bundle_id,
      case
        when rs.size > 1 then rt.root_id <> u.stable_id
        when sb.data_source_id is not null then sb.leader_id <> u.stable_id
        else false
      end as included_in_bundle
    from units u
    left join added_requires ar on ar.unit_id = u.stable_id
    left join subtree_requires sr on sr.unit_id = u.stable_id
    left join removal_requires rr on rr.unit_id = u.stable_id
    left join removal_tree rt on u.kind = 'removed' and rt.stable_id = u.stable_id
    left join removal_sizes rs on rs.root_id = rt.root_id
    left join source_members sm on sm.stable_id = u.stable_id
    left join source_bundles sb on sb.data_source_id = sm.data_source_id
  ),
  bundle_requires as (
    select bundle_id, array_agg(distinct r) as reqs
    from bundled, unnest(requires_stable_ids) r
    where bundle_id is not null
    group by bundle_id
  )
  select
    b.stable_id,
    b.kind,
    b.title,
    b.is_folder,
    b.parent_stable_id,
    b.path,
    coalesce(br.reqs, b.requires_stable_ids),
    b.bundle_id,
    b.draft_id,
    b.included_in_bundle
  from bundled b
  left join bundle_requires br on br.bundle_id = b.bundle_id
  order by b.kind, b.path, b.stable_id;
$$;

comment on function public.pending_publish_items_for_project(integer) is '@omit';
revoke all on function public.pending_publish_items_for_project(integer) from public;

create or replace function public.projects_pending_publish_items(project public.projects)
  returns setof public.pending_publish_item
  language plpgsql
  stable
  security definer
  set search_path to public, pg_temp
as $$
begin
  if session_is_admin(project.id) = false then
    raise 'Permission denied. Must be a project admin';
  end if;
  return query
    select * from public.pending_publish_items_for_project(project.id);
end;
$$;

comment on function public.projects_pending_publish_items(public.projects) is '@simpleCollections only';

-- Relative stacking of the layers present in both trees.
create or replace function public.layer_stack_order_pending(p_project_id integer)
  returns boolean
  language sql
  stable
  security definer
  set search_path to public, pg_temp
as $$
  with common as (
    select
      d.stable_id,
      dd.z_index as draft_z,
      pd.z_index as pub_z
    from table_of_contents_items d
    join table_of_contents_items p
      on p.project_id = d.project_id
     and p.stable_id = d.stable_id
     and not p.is_draft
    join data_layers dd on dd.id = d.data_layer_id
    join data_layers pd on pd.id = p.data_layer_id
    where d.project_id = p_project_id
      and d.is_draft
      and not d.is_folder
  ),
  ranked as (
    select
      row_number() over (order by draft_z, stable_id) as draft_rank,
      row_number() over (order by pub_z, stable_id) as pub_rank
    from common
  )
  select exists (select 1 from ranked where draft_rank <> pub_rank);
$$;

comment on function public.layer_stack_order_pending(integer) is '@omit';
revoke all on function public.layer_stack_order_pending(integer) from public;

-- Whether sibling order differs for items that share a parent in both trees.
-- Only a full publish ships list order.
create or replace function public.list_order_pending(p_project_id integer)
  returns boolean
  language sql
  stable
  security definer
  set search_path to public, pg_temp
as $$
  with draft as (
    select stable_id, parent_stable_id, sort_index
    from table_of_contents_items
    where project_id = p_project_id and is_draft
  ),
  published as (
    select stable_id, parent_stable_id, sort_index
    from table_of_contents_items
    where project_id = p_project_id and not is_draft
  ),
  same_parent as (
    select
      row_number() over (
        partition by d.parent_stable_id order by d.sort_index, d.stable_id
      ) as draft_rank,
      row_number() over (
        partition by p.parent_stable_id order by p.sort_index, p.stable_id
      ) as pub_rank
    from draft d
    join published p
      on p.stable_id = d.stable_id
     and p.parent_stable_id is not distinct from d.parent_stable_id
  )
  select exists (select 1 from same_parent where draft_rank <> pub_rank);
$$;

comment on function public.list_order_pending(integer) is '@omit';
revoke all on function public.list_order_pending(integer) from public;

-- Whether the items present in both trees differ in sibling order or in
-- layer stacking order. Only a full publish ships either.
create or replace function public.overlay_order_pending(p_project_id integer)
  returns boolean
  language sql
  stable
  security definer
  set search_path to public, pg_temp
as $$
  select
    public.list_order_pending(p_project_id)
    or public.layer_stack_order_pending(p_project_id);
$$;

comment on function public.overlay_order_pending(integer) is '@omit';
revoke all on function public.overlay_order_pending(integer) from public;

-- Lets the selective publish modal tell reorder-only changes apart from a
-- draft_table_of_contents_has_changes flag that no longer matches anything.
-- Null for non-admins.
create or replace function public.projects_overlay_order_pending(project public.projects)
  returns boolean
  language sql
  stable
  security definer
  set search_path to public, pg_temp
as $$
  select case
    when session_is_admin(project.id)
    then public.overlay_order_pending(project.id)
  end;
$$;

comment on function public.projects_overlay_order_pending(public.projects) is
  'Whether list order or layer stacking order differs between the draft and published overlay lists. Only a full publish ships either.';
grant execute on function public.projects_overlay_order_pending(public.projects) to seasketch_user;

-- Null for non-admins. The publish review uses this when a reorder was not
-- written to the changelog.
create or replace function public.projects_list_order_pending(project public.projects)
  returns boolean
  language sql
  stable
  security definer
  set search_path to public, pg_temp
as $$
  select case
    when session_is_admin(project.id)
    then public.list_order_pending(project.id)
  end;
$$;

comment on function public.projects_list_order_pending(public.projects) is
  'Whether sibling order differs between the draft and published overlay lists. Only a full publish ships list order.';
grant execute on function public.projects_list_order_pending(public.projects) to seasketch_user;

-- Whether a full publish would change anything that end users see.
create or replace function public.overlay_list_has_unpublished_changes(p_project_id integer)
  returns boolean
  language sql
  stable
  security definer
  set search_path to public, pg_temp
as $$
  select
    exists (
      select 1
      from table_of_contents_items d
      where d.project_id = p_project_id
        and d.is_draft
        and not exists (
          select 1 from table_of_contents_items p
          where p.project_id = p_project_id
            and not p.is_draft
            and p.stable_id = d.stable_id
        )
    )
    or exists (
      select 1
      from table_of_contents_items p
      where p.project_id = p_project_id
        and not p.is_draft
        and not exists (
          select 1 from table_of_contents_items d
          where d.project_id = p_project_id
            and d.is_draft
            and d.stable_id = p.stable_id
        )
    )
    or exists (select 1 from public._overlay_changed_stable_ids(p_project_id))
    or public.overlay_order_pending(p_project_id);
$$;

comment on function public.overlay_list_has_unpublished_changes(integer) is '@omit';
revoke all on function public.overlay_list_has_unpublished_changes(integer) from public;

--
-- Full-publish review lists
--

-- Changelog rows since the last full publish, without rows for items a
-- partial publish has shipped since. Stacking order and list order stay until
-- a full publish, because partial publish does not ship either.
create or replace function public.projects_change_logs_since_last_publish(project public.projects)
  returns setof public.change_logs
  language plpgsql
  stable
  security definer
  set search_path to public, pg_temp
as $$
declare
  v_last_publish timestamptz;
begin
  if session_is_admin(project.id) = false then
    raise 'Permission denied. Must be a project admin';
  end if;
  select coalesce(table_of_contents_last_published, '-infinity'::timestamptz)
    into v_last_publish
  from projects where id = project.id;
  return query
    select cl.*
    from change_logs cl
    where cl.project_id = project.id
      and cl.net_zero_changes = false
      and cl.field_group <> 'layers:published'
      and cl.last_at > v_last_publish
      and (
        cl.field_group in (
          'layers:z-order-change',
          'layers:list-order-change'
        )
        or (
          cl.entity_type = 'table_of_contents_items'
          and cl.field_group not in ('layer:deleted', 'folder:deleted')
          and exists (
            select 1
            from table_of_contents_items d
            left join table_of_contents_items p
              on p.project_id = d.project_id
             and not p.is_draft
             and p.stable_id = d.stable_id
            where d.id = cl.entity_id
              and d.project_id = cl.project_id
              and d.is_draft
              and (p.id is null or cl.last_at > coalesce(p.published_at, '-infinity'::timestamptz))
          )
        )
        or (
          cl.entity_type <> 'table_of_contents_items'
          and cl.meta ? 'table_of_contents_item_id'
          and (cl.meta->>'table_of_contents_item_id') ~ '^[0-9]+$'
          and exists (
            select 1
            from table_of_contents_items d
            left join table_of_contents_items p
              on p.project_id = d.project_id
             and not p.is_draft
             and p.stable_id = d.stable_id
            where d.id = (cl.meta->>'table_of_contents_item_id')::int
              and d.project_id = cl.project_id
              and d.is_draft
              and (p.id is null or cl.last_at > coalesce(p.published_at, '-infinity'::timestamptz))
          )
        )
        or (
          cl.field_group in ('layer:deleted', 'folder:deleted')
          and exists (
            select 1
            from table_of_contents_items p
            where p.project_id = cl.project_id
              and not p.is_draft
              and not exists (
                select 1
                from table_of_contents_items d
                where d.project_id = p.project_id
                  and d.is_draft
                  and d.stable_id = p.stable_id
              )
              and p.title = cl.from_summary->>'title'
              and p.is_folder = (cl.field_group = 'folder:deleted')
          )
        )
      )
    order by cl.last_at desc;
end;
$$;

comment on function public.projects_change_logs_since_last_publish(public.projects) is '@simpleCollections only';

create or replace function public.projects_comments_since_last_publish(project public.projects)
  returns setof public.resolvable_layer_comments
  language plpgsql
  stable
  security definer
  set search_path to public, pg_temp
as $$
declare
  v_last_publish timestamptz;
begin
  if session_is_admin(project.id) = false then
    raise exception 'Access denied to project %', project.id;
  end if;
  select coalesce(table_of_contents_last_published, '-infinity'::timestamptz)
    into v_last_publish
  from projects where id = project.id;
  return query
    select c.*
    from resolvable_layer_comments c
    where c.project_id = project.id
      and c.parent_comment_id is null
      and (c.resolved_at > v_last_publish or c.created_at > v_last_publish)
      and not exists (
        select 1
        from table_of_contents_items d
        join table_of_contents_items p
          on p.project_id = d.project_id
         and not p.is_draft
         and p.stable_id = d.stable_id
        where d.id = c.table_of_contents_item_id
          and d.is_draft
          and p.published_at is not null
          and c.created_at <= p.published_at
          and (c.resolved_at is null or c.resolved_at <= p.published_at)
      );
end;
$$;

comment on function public.projects_comments_since_last_publish(public.projects) is '@simpleCollections only';

--
-- Partial publish
--

-- Deletes one published item with its layer and interactivity settings. ACL
-- rows and data tables cascade. Children are not touched. Returns the
-- non-library source the published layer used, which the caller reuses or
-- deletes once no published layer references it.
drop function if exists public._unpublish_toc_stable_id(integer, text);
create function public._unpublish_toc_stable_id(p_project_id integer, p_stable_id text)
  returns integer
  language plpgsql
  security definer
  set search_path to public, pg_temp
as $$
declare
  v_toc_id int;
  v_layer_id int;
  v_source_id int;
  v_interactivity_id int;
begin
  select id, data_layer_id
    into v_toc_id, v_layer_id
  from table_of_contents_items
  where project_id = p_project_id
    and not is_draft
    and stable_id = p_stable_id
  limit 1;
  if v_toc_id is null then
    return null;
  end if;
  if v_layer_id is not null then
    select
      case when ds.data_library_template_id is null then dl.data_source_id end,
      dl.interactivity_settings_id
      into v_source_id, v_interactivity_id
    from data_layers dl
    left join data_sources ds on ds.id = dl.data_source_id
    where dl.id = v_layer_id;
  end if;
  delete from table_of_contents_items where id = v_toc_id;
  if v_layer_id is not null then
    delete from data_layers where id = v_layer_id;
    if v_interactivity_id is not null then
      delete from interactivity_settings where id = v_interactivity_id;
    end if;
  end if;
  return v_source_id;
end;
$$;

comment on function public._unpublish_toc_stable_id(integer, text) is '@omit';
revoke all on function public._unpublish_toc_stable_id(integer, text) from public;

drop function if exists public._publish_copy_draft_toc_item(integer);
drop function if exists public._publish_copy_draft_toc_item(integer, integer, integer);

-- Copies one draft item onto the published tree. The published layer still
-- references the draft source; the caller repoints it. A null sort_index or
-- z_index appends the item. A null path is built from the published parent.
--
-- TODO: this will have to be modified with the addition of any columns.
-- Also update _overlay_changed_stable_ids.
create or replace function public._publish_copy_draft_toc_item(
  p_draft_id integer,
  p_sort_index integer,
  p_z_index integer,
  p_path ltree
)
  returns table(new_toc_id integer, new_layer_id integer, draft_source_id integer)
  language plpgsql
  security definer
  set search_path to public, pg_temp
as $$
declare
  item table_of_contents_items;
  v_path ltree;
  v_parent_path ltree;
  v_interactivity_id int;
  v_layer_id int;
  v_source_id int;
  v_library text;
  acl_type access_control_list_type;
  acl_id int;
  orig_acl_id int;
begin
  select * into item from table_of_contents_items where id = p_draft_id and is_draft;
  if item.id is null then
    raise 'Draft table of contents item % not found', p_draft_id;
  end if;

  if p_sort_index is null then
    select coalesce(max(sort_index), -1) + 1 into p_sort_index
    from table_of_contents_items
    where project_id = item.project_id
      and not is_draft
      and parent_stable_id is not distinct from item.parent_stable_id;
  end if;

  if p_path is not null then
    v_path := p_path;
  elsif item.parent_stable_id is null then
    v_path := text2ltree(item.stable_id);
  else
    select path into v_parent_path
    from table_of_contents_items
    where project_id = item.project_id
      and not is_draft
      and stable_id = item.parent_stable_id;
    if v_parent_path is null then
      raise 'Published parent % is missing for %', item.parent_stable_id, item.stable_id;
    end if;
    v_path := v_parent_path || text2ltree(item.stable_id);
  end if;

  v_layer_id := null;
  v_source_id := null;
  if item.is_folder = false then
    select data_source_id into v_source_id
    from data_layers where id = item.data_layer_id;
    select data_library_template_id into v_library
    from data_sources where id = v_source_id;

    if p_z_index is null then
      select coalesce(max(dl.z_index), 0) + 1 into p_z_index
      from data_layers dl
      join table_of_contents_items t on t.data_layer_id = dl.id
      where t.project_id = item.project_id
        and not t.is_draft;
    end if;

    insert into interactivity_settings (
      type, short_template, long_template, cursor, title
    )
    select type, short_template, long_template, cursor, title
    from interactivity_settings
    where id = (
      select interactivity_settings_id from data_layers where id = item.data_layer_id
    )
    returning id into v_interactivity_id;

    insert into data_layers (
      project_id,
      data_source_id,
      source_layer,
      sublayer,
      sublayer_type,
      render_under,
      mapbox_gl_styles,
      interactivity_settings_id,
      z_index
    )
    select
      item.project_id,
      data_source_id,
      source_layer,
      sublayer,
      sublayer_type,
      render_under,
      mapbox_gl_styles,
      v_interactivity_id,
      p_z_index
    from data_layers
    where id = item.data_layer_id
    returning id into v_layer_id;
  end if;

  insert into table_of_contents_items (
    is_draft,
    project_id,
    path,
    stable_id,
    parent_stable_id,
    title,
    is_folder,
    show_radio_children,
    is_click_off_only,
    metadata,
    bounds,
    data_layer_id,
    sort_index,
    hide_children,
    geoprocessing_reference_id,
    translated_props,
    enable_download,
    enable_data_tables,
    data_table_join_column,
    copied_from_data_library_template_id,
    hide_arcgis_rest_link,
    data_source_type,
    original_source_upload_available,
    published_at
  ) values (
    false,
    item.project_id,
    v_path,
    item.stable_id,
    item.parent_stable_id,
    item.title,
    item.is_folder,
    item.show_radio_children,
    item.is_click_off_only,
    item.metadata,
    item.bounds,
    v_layer_id,
    p_sort_index,
    item.hide_children,
    item.geoprocessing_reference_id,
    item.translated_props,
    item.enable_download,
    item.enable_data_tables,
    item.data_table_join_column,
    item.copied_from_data_library_template_id,
    item.hide_arcgis_rest_link,
    item.data_source_type,
    item.original_source_upload_available,
    clock_timestamp()
  )
  returning id into new_toc_id;

  new_layer_id := v_layer_id;
  draft_source_id := case when v_library is null then v_source_id else null end;

  select type, id into acl_type, orig_acl_id
  from access_control_lists
  where table_of_contents_item_id = item.id;
  if acl_type is not null and acl_type <> 'public' then
    update access_control_lists
    set type = acl_type
    where table_of_contents_item_id = new_toc_id
    returning id into acl_id;
    if acl_type = 'group' then
      insert into access_control_list_groups (access_control_list_id, group_id)
      select acl_id, group_id
      from access_control_list_groups
      where access_control_list_id = orig_acl_id;
    end if;
  end if;

  insert into overlay_data_tables (
    table_of_contents_item_id,
    project_id,
    name,
    join_column,
    overlay_join_column,
    row_count,
    created_by,
    version,
    parquet_remote,
    parquet_url,
    column_stats_remote,
    visualization_columns,
    visualization_ops,
    calculation_mode,
    additional_replicate_identifiers,
    replicate_label,
    replicate_label_custom,
    within_replicate_operations,
    across_replicate_operations,
    subject_column,
    observation_detail_columns,
    coverage_mode,
    coverage_remote,
    effort_marker_values,
    excluded_values,
    required_filter_columns,
    hidden_filter_columns,
    filter_column_labels,
    temporal,
    organism,
    nodata_values,
    source_parquet_remote,
    stable_id,
    description
  )
  select
    new_toc_id,
    odt.project_id,
    odt.name,
    odt.join_column,
    odt.overlay_join_column,
    odt.row_count,
    odt.created_by,
    odt.version,
    odt.parquet_remote,
    odt.parquet_url,
    odt.column_stats_remote,
    odt.visualization_columns,
    odt.visualization_ops,
    odt.calculation_mode,
    odt.additional_replicate_identifiers,
    odt.replicate_label,
    odt.replicate_label_custom,
    odt.within_replicate_operations,
    odt.across_replicate_operations,
    odt.subject_column,
    odt.observation_detail_columns,
    odt.coverage_mode,
    odt.coverage_remote,
    odt.effort_marker_values,
    odt.excluded_values,
    odt.required_filter_columns,
    odt.hidden_filter_columns,
    odt.filter_column_labels,
    odt.temporal,
    odt.organism,
    odt.nodata_values,
    odt.source_parquet_remote,
    odt.stable_id,
    odt.description
  from overlay_data_tables odt
  where odt.table_of_contents_item_id = item.id
    and odt.deleted_at is null;

  return next;
end;
$$;

comment on function public._publish_copy_draft_toc_item(integer, integer, integer, ltree) is '@omit';
revoke all on function public._publish_copy_draft_toc_item(integer, integer, integer, ltree) from public;

-- Rewrites path on published rows from the published parent chain. Run after
-- a partial publish moves folders, in any nesting or order.
create or replace function public._publish_rebuild_published_paths(p_project_id integer)
  returns void
  language sql
  security definer
  set search_path to public, pg_temp
as $$
  with recursive published as (
    select id, stable_id, parent_stable_id, path
    from table_of_contents_items
    where project_id = p_project_id and not is_draft
  ),
  tree(id, stable_id, new_path) as (
    select id, stable_id, text2ltree(stable_id)
    from published
    where parent_stable_id is null
    union all
    select c.id, c.stable_id, t.new_path || text2ltree(c.stable_id)
    from tree t
    join published c on c.parent_stable_id = t.stable_id
  )
  update table_of_contents_items x
  set path = tree.new_path
  from tree
  where x.id = tree.id
    and x.path is distinct from tree.new_path;
$$;

comment on function public._publish_rebuild_published_paths(integer) is '@omit';
revoke all on function public._publish_rebuild_published_paths(integer) from public;

-- Applies the units named in p_sel to the published tree. The caller fills
-- the _units temp table from pending_publish_items_for_project and holds the
-- publish lock with seasketch.publishing set.
--
-- With p_full, copied items take the draft sort_index, z_index, and path, and
-- every published row that is already current gets the draft sort_index,
-- path, and z_index. Without it, an updated item keeps its published z_index,
-- and its sort_index unless it moved to another folder; a new item is
-- appended; and paths are rebuilt from the published parent chain.
--
-- A copied layer reuses a published source copy that still matches its draft
-- source, including the copy it used before, so an edit to a layer does not
-- copy the source's geostats again.
create or replace function public._publish_units(
  p_project_id integer,
  p_sel text[],
  p_full boolean
)
  returns void
  language plpgsql
  security definer
  set search_path to public, pg_temp
as $$
declare
  v_row record;
  v_detached int;
  v_copied_toc int;
  v_copied_layer int;
  v_copied_source int;
  v_layer_ids int[] := '{}'::int[];
  v_source_ids int[] := '{}'::int[];
  v_source int;
  v_target int;
  v_sort int;
  v_z int;
begin
  if to_regclass('pg_temp._detached_sources') is not null then
    drop table pg_temp._detached_sources;
  end if;
  create temp table _detached_sources (
    draft_source_id int,
    published_source_id int not null
  ) on commit drop;

  -- Removals, deepest first.
  for v_row in
    select u.stable_id
    from _units u
    join table_of_contents_items p
      on p.project_id = p_project_id
     and not p.is_draft
     and p.stable_id = u.stable_id
    where u.kind = 'removed'
      and u.stable_id = any(p_sel)
    order by nlevel(p.path) desc
  loop
    v_detached := public._unpublish_toc_stable_id(p_project_id, v_row.stable_id);
    if v_detached is not null then
      insert into _detached_sources values (null, v_detached);
    end if;
  end loop;

  -- New and updated items, parents first.
  for v_row in
    select
      d.id as draft_id,
      d.stable_id,
      d.parent_stable_id,
      d.sort_index,
      d.path,
      dl.z_index,
      dl.data_source_id
    from _units u
    join table_of_contents_items d
      on d.project_id = p_project_id
     and d.is_draft
     and d.stable_id = u.stable_id
    left join data_layers dl on dl.id = d.data_layer_id
    where u.kind in ('added', 'updated')
      and u.stable_id = any(p_sel)
    order by nlevel(d.path), d.sort_index, d.stable_id
  loop
    if p_full then
      v_sort := v_row.sort_index;
      v_z := v_row.z_index;
    else
      v_sort := null;
      v_z := null;
      select
        case
          when p.parent_stable_id is not distinct from v_row.parent_stable_id
          then p.sort_index
        end,
        pl.z_index
        into v_sort, v_z
      from table_of_contents_items p
      left join data_layers pl on pl.id = p.data_layer_id
      where p.project_id = p_project_id
        and not p.is_draft
        and p.stable_id = v_row.stable_id;
    end if;
    v_detached := public._unpublish_toc_stable_id(p_project_id, v_row.stable_id);
    if v_detached is not null then
      insert into _detached_sources values (v_row.data_source_id, v_detached);
    end if;
    select new_toc_id, new_layer_id, draft_source_id
      into v_copied_toc, v_copied_layer, v_copied_source
    from public._publish_copy_draft_toc_item(
      v_row.draft_id,
      v_sort,
      v_z,
      case when p_full then v_row.path end
    );
    if v_copied_layer is not null and v_copied_source is not null then
      v_layer_ids := v_layer_ids || v_copied_layer;
      v_source_ids := v_source_ids || v_copied_source;
    end if;
  end loop;

  -- Point the new published layers at a published copy of their draft source.
  for v_source in
    select distinct s from unnest(v_source_ids) s
  loop
    select ps.id into v_target
    from (
      select pl.data_source_id as id
      from data_layers dl
      join table_of_contents_items dt
        on dt.data_layer_id = dl.id
       and dt.is_draft
      join table_of_contents_items pt
        on pt.project_id = dt.project_id
       and pt.stable_id = dt.stable_id
       and not pt.is_draft
      join data_layers pl on pl.id = pt.data_layer_id
      where dl.data_source_id = v_source
      union
      select published_source_id
      from _detached_sources
      where draft_source_id = v_source
    ) candidate
    join data_sources ps on ps.id = candidate.id
    join data_sources ds on ds.id = v_source
    where ps.id <> v_source
      and ps.data_library_template_id is null
      and not public._publishable_source_differs(ds, ps)
    order by ps.id
    limit 1;
    if v_target is null then
      v_target := public._publish_copy_data_source(v_source, p_project_id);
    end if;
    update data_layers dl
    set data_source_id = v_target
    where dl.id in (
      select t.layer_id
      from unnest(v_layer_ids, v_source_ids) as t(layer_id, source_id)
      where t.source_id = v_source
    );
    v_target := null;
  end loop;

  delete from data_sources s
  where s.id in (select published_source_id from _detached_sources)
    and not exists (select 1 from data_layers dl where dl.data_source_id = s.id);

  if p_full then
    update table_of_contents_items p
    set sort_index = d.sort_index, path = d.path
    from table_of_contents_items d
    where d.project_id = p_project_id
      and d.is_draft
      and p.project_id = p_project_id
      and not p.is_draft
      and p.stable_id = d.stable_id
      and (p.sort_index, p.path) is distinct from (d.sort_index, d.path);

    update data_layers pl
    set z_index = dl.z_index
    from table_of_contents_items d
    join data_layers dl on dl.id = d.data_layer_id
    join table_of_contents_items p
      on p.project_id = d.project_id
     and p.stable_id = d.stable_id
     and not p.is_draft
    where d.project_id = p_project_id
      and d.is_draft
      and pl.id = p.data_layer_id
      and pl.z_index is distinct from dl.z_index;
  else
    perform public._publish_rebuild_published_paths(p_project_id);
  end if;
end;
$$;

comment on function public._publish_units(integer, text[], boolean) is '@omit';
revoke all on function public._publish_units(integer, text[], boolean) from public;

drop function if exists public.publish_table_of_contents_items(integer, text[], boolean);

create or replace function public.publish_table_of_contents_items(
  "projectId" integer,
  "stableIds" text[]
) returns setof public.table_of_contents_items
  language plpgsql
  security definer
  set search_path to public, pg_temp
as $$
declare
  v_editor int;
  v_layer_count int;
  v_sel text[];
  v_next text[];
  v_orphan text;
begin
  perform pg_advisory_xact_lock(hashtext('publish_toc:' || "projectId"::text));
  if session_is_admin("projectId") = false then
    raise 'Permission denied. Must be a project admin';
  end if;

  if to_regclass('pg_temp._units') is not null then
    drop table pg_temp._units;
  end if;
  create temp table _units on commit drop as
    select * from public.pending_publish_items_for_project("projectId");

  -- The selection, plus everything it requires and every bundle-mate.
  v_sel := coalesce((
    select array_agg(distinct stable_id)
    from _units
    where stable_id = any(coalesce("stableIds", '{}'::text[]))
  ), '{}'::text[]);
  loop
    select coalesce(array_agg(distinct x), '{}'::text[]) into v_next
    from (
      select unnest(v_sel) as x
      union
      select unnest(u.requires_stable_ids)
      from _units u
      where u.stable_id = any(v_sel)
      union
      select u2.stable_id
      from _units u
      join _units u2
        on u.bundle_id is not null
       and u2.bundle_id = u.bundle_id
      where u.stable_id = any(v_sel)
    ) s
    where x in (select stable_id from _units);
    exit when v_next <@ v_sel and v_sel <@ v_next;
    v_sel := v_next;
  end loop;

  if cardinality(v_sel) = 0 then
    return;
  end if;

  perform set_config('seasketch.publishing', 'true', true);

  perform public._publish_units("projectId", v_sel, false);

  -- Every published item must hang off a root. A missing parent or a parent
  -- cycle would hide items from end users.
  with recursive reachable(stable_id) as (
    select stable_id
    from table_of_contents_items
    where project_id = "projectId"
      and not is_draft
      and parent_stable_id is null
    union all
    select c.stable_id
    from reachable r
    join table_of_contents_items c
      on c.project_id = "projectId"
     and not c.is_draft
     and c.parent_stable_id = r.stable_id
  )
  select c.title into v_orphan
  from table_of_contents_items c
  where c.project_id = "projectId"
    and not c.is_draft
    and c.stable_id not in (select stable_id from reachable)
  order by c.title
  limit 1;
  if v_orphan is not null then
    raise 'Publishing this selection would leave "%" without a published folder. Use Publish to publish the whole list.', v_orphan;
  end if;

  perform set_config('seasketch.publishing', 'false', true);

  -- Each published unit now matches its draft, and nothing outside the
  -- selection changed, so the units left over are what is still pending.
  update projects
  set draft_table_of_contents_has_changes =
    exists (select 1 from _units where not (stable_id = any(v_sel)))
    or public.overlay_order_pending("projectId")
  where id = "projectId";

  perform public._publish_record_project_activity("projectId");

  v_editor := nullif(current_setting('session.user_id', true), '')::int;
  if v_editor is not null then
    select count(*)::int into v_layer_count
    from _units
    where stable_id = any(v_sel)
      and not is_folder;
    perform public._record_overlay_publish(
      "projectId",
      v_editor,
      v_layer_count,
      false,
      v_sel
    );
  end if;

  return query
    select *
    from table_of_contents_items
    where project_id = "projectId"
      and not is_draft
      and stable_id = any(v_sel);
end;
$$;

comment on function public.publish_table_of_contents_items(integer, text[]) is
  'Publishes the selected draft overlay items, and anything they require, without replacing the rest of the published tree. Does not publish sort_index or z_index.';

grant execute on function public.publish_table_of_contents_items(integer, text[]) to seasketch_user;
grant execute on function public.projects_pending_publish_items(public.projects) to seasketch_user;

-- Which items a layers:published row shipped. Layer history uses this instead
-- of "any edit since the previous publish", so a partial publish is not
-- listed on a layer it did not include. Rows with no manifest (publishes from
-- before this existed) keep the time window.
create table if not exists public.overlay_publish_runs (
  change_log_id bigint primary key references public.change_logs(id) on delete cascade,
  full_publish boolean not null
);
comment on table public.overlay_publish_runs is '@omit';

create table if not exists public.overlay_publish_run_items (
  change_log_id bigint not null references public.overlay_publish_runs(change_log_id) on delete cascade,
  stable_id text not null,
  title text not null,
  is_folder boolean not null,
  primary key (change_log_id, stable_id)
);
comment on table public.overlay_publish_run_items is '@omit';

revoke all on table public.overlay_publish_runs from public;
revoke all on table public.overlay_publish_run_items from public;

create or replace function public._record_overlay_publish(
  p_project_id integer,
  p_editor_id integer,
  p_layer_count integer,
  p_full boolean,
  p_stable_ids text[]
) returns void
  language plpgsql
  security definer
  set search_path to public, pg_temp
as $$
declare
  v_log_id bigint;
begin
  -- Publishing is one action, not a burst of edits. Close an open
  -- layers:published row so this run is not merged into the previous one
  -- (the field group's window is 5 seconds) and the two keep their own ids.
  update change_logs
  set status = 'closed'
  where project_id = p_project_id
    and editor_id = p_editor_id
    and entity_type = 'projects'
    and entity_id = p_project_id
    and field_group = 'layers:published'
    and status = 'open';

  v_log_id := record_changelog(
    p_project_id,
    p_editor_id,
    'projects',
    p_project_id,
    'layers:published'::change_log_field_group,
    '{}'::jsonb,
    jsonb_build_object('layer_count', p_layer_count),
    null,
    null,
    null
  );
  insert into public.overlay_publish_runs (change_log_id, full_publish)
  values (v_log_id, p_full)
  on conflict do nothing;
  -- Titles are copied from the pending units. A removal's draft row is
  -- already gone by the time this runs, and _units still has its name.
  insert into public.overlay_publish_run_items (
    change_log_id, stable_id, title, is_folder
  )
  select v_log_id, u.stable_id, coalesce(u.title, u.stable_id), u.is_folder
  from _units u
  where u.stable_id = any(coalesce(p_stable_ids, '{}'::text[]))
  on conflict do nothing;
end;
$$;

comment on function public._record_overlay_publish(integer, integer, integer, boolean, text[]) is '@omit';
revoke all on function public._record_overlay_publish(integer, integer, integer, boolean, text[]) from public;

-- Read model for the changelog. Titles are the names at publish time.
do $$
begin
  create type public.overlay_published_item as (
    stable_id text,
    title text,
    is_folder boolean
  );
exception
  when duplicate_object then null;
end
$$;

create or replace function public.change_logs_full_overlay_publish(c public.change_logs)
  returns boolean
  language sql
  stable
  security definer
  set search_path to public, pg_temp
as $$
  select r.full_publish
  from public.overlay_publish_runs r
  join public.change_logs cl on cl.id = r.change_log_id
  where r.change_log_id = c.id
    and cl.project_id = c.project_id
    and public.session_is_admin(cl.project_id);
$$;

comment on function public.change_logs_full_overlay_publish(public.change_logs) is
  'True when this row is a full overlay publish. Null when the publish has no record of which items it shipped.';
revoke all on function public.change_logs_full_overlay_publish(public.change_logs) from public;
grant execute on function public.change_logs_full_overlay_publish(public.change_logs) to seasketch_user;

create or replace function public.change_logs_published_overlay_items(c public.change_logs)
  returns setof public.overlay_published_item
  language sql
  stable
  security definer
  set search_path to public, pg_temp
as $$
  select i.stable_id, i.title, i.is_folder
  from public.overlay_publish_run_items i
  join public.change_logs cl on cl.id = i.change_log_id
  where i.change_log_id = c.id
    and cl.project_id = c.project_id
    and public.session_is_admin(cl.project_id)
  order by i.is_folder, i.title, i.stable_id;
$$;

comment on function public.change_logs_published_overlay_items(public.change_logs) is
  E'@simpleCollections only\nLayers and folders this publish shipped, with the names they had at the time.';
revoke all on function public.change_logs_published_overlay_items(public.change_logs) from public;
grant execute on function public.change_logs_published_overlay_items(public.change_logs) to seasketch_user;

create or replace function public.table_of_contents_items_related_publish_change_logs(item public.table_of_contents_items)
  returns setof public.change_logs
  language sql
  stable
  security definer
  set search_path to public, pg_temp
as $$
  with layer_created as (
    select ds.created_at
    from data_layers dl
    inner join data_sources ds on ds.id = dl.data_source_id
    where dl.id = item.data_layer_id
    limit 1
  ),
  publish_logs as (
    select
      p as publish_log,
      (
        select max(prev.last_at)
        from change_logs prev
        where prev.project_id = item.project_id
          and prev.entity_type = 'projects'
          and prev.entity_id = item.project_id
          and prev.field_group = 'layers:published'
          and prev.net_zero_changes = false
          and prev.last_at < p.last_at
      ) as previous_publish_at
    from change_logs p
    cross join layer_created lc
    where p.project_id = item.project_id
      and p.entity_type = 'projects'
      and p.entity_id = item.project_id
      and p.field_group = 'layers:published'
      and p.net_zero_changes = false
      and session_is_admin(p.project_id)
      and p.last_at > lc.created_at
  )
  select (p.publish_log).*
  from publish_logs p
  where case
    when exists (
      select 1 from overlay_publish_runs r
      where r.change_log_id = (p.publish_log).id
    ) then exists (
      select 1 from overlay_publish_run_items i
      where i.change_log_id = (p.publish_log).id
        and i.stable_id = item.stable_id
    )
    else exists (
      select 1
      from change_logs c
      where c.project_id = item.project_id
        and c.entity_type = 'table_of_contents_items'
        and c.entity_id = item.id
        and c.net_zero_changes = false
        and c.last_at > coalesce(p.previous_publish_at, '-infinity'::timestamptz)
        and c.last_at <= (p.publish_log).last_at
    )
  end
  order by (p.publish_log).last_at desc;
$$;

comment on function public.table_of_contents_items_related_publish_change_logs(public.table_of_contents_items) is '@simpleCollections only';
grant execute on function public.table_of_contents_items_related_publish_change_logs(public.table_of_contents_items) to seasketch_user;

-- Z-order updates run with replication role replica, which skips the trigger
-- that marks the draft list changed. The publish button reads that flag, so
-- set it explicitly once triggers are back on. The changelog row is what the
-- publish modal already shows.
create or replace function public.update_z_indexes("dataLayerIds" integer[])
  returns setof public.data_layers
  language plpgsql
  security definer
  set search_path to public, pg_temp
as $$
declare
  z int;
  pid int;
  v_editor int;
  v_reordered_count int;
begin
  if (select count(distinct(project_id)) from data_layers where id = any("dataLayerIds")) > 1 then
    raise 'Denied. Attempting to modify more than one project.';
  end if;
  if (session_is_admin((select project_id from data_layers where id = any("dataLayerIds") limit 1))) != true then
    raise 'Unauthorized';
  end if;

  pid := (select project_id from data_layers where id = any("dataLayerIds") limit 1);

  v_reordered_count := coalesce(array_length("dataLayerIds", 1), 0);

  -- Disable triggers to prevent unnecessary checks which could cause
  -- deadlocks if rapidly updating z-indexes on a large number of layers.
  set session_replication_role = replica;
  z = 0;
  for i in array_lower("dataLayerIds", 1)..array_upper("dataLayerIds", 1) loop
    z = z + 1;
    update data_layers set z_index = z where id = "dataLayerIds"[i];
  end loop;
  set session_replication_role = default;

  if pid is not null then
    update projects p
    set draft_table_of_contents_has_changes =
      public.overlay_list_has_unpublished_changes(p.id)
    where id = pid;
  end if;

  v_editor := nullif(current_setting('session.user_id', true), '')::int;
  if v_editor is not null then
    perform record_changelog(
      pid,
      v_editor,
      'projects',
      pid,
      'layers:z-order-change'::change_log_field_group,
      '{}'::jsonb,
      jsonb_build_object('reordered_count', v_reordered_count),
      null,
      null,
      null
    );
  end if;

  return query (select * from data_layers where id = any("dataLayerIds"));
end;
$$;

comment on function public.update_z_indexes(integer[]) is
  'Batch reassigns z_index for one project. Records change_logs (layers:z-order-change) on projects when session.user_id is set; to_summary includes reordered_count. Marks the draft overlay list as changed.';

-- A sibling reorder does not change parent_stable_id, so the parent-changed
-- trigger stays quiet and the publish modal had nothing to show. Record one
-- project-level list-order event. Calls in one drag coalesce.
create or replace function public.update_table_of_contents_item_position(
  "itemId" integer,
  "parentStableId" text,
  "sortIndex" integer
) returns public.table_of_contents_items
  language plpgsql
  security definer
as $$
declare
  pid int;
  parent_path ltree;
  current_path ltree;
  item table_of_contents_items;
  old_sort int;
  old_parent text;
  v_editor int;
begin
  select project_id, sort_index, parent_stable_id
    into pid, old_sort, old_parent
  from table_of_contents_items
  where id = "itemId" and is_draft = true;
  if pid is null then
    raise 'Could not find draft item with id = %', "itemId";
  end if;
  if session_is_admin(pid) = false then
    raise 'Permission denied';
  end if;
  select path into current_path from table_of_contents_items where id = "itemId" and is_draft = true;

  if "parentStableId" is not null then
    select path into parent_path
    from table_of_contents_items
    where is_draft = true and project_id = pid and stable_id = "parentStableId";
    if parent_path is null then
      raise 'Could not find valid parent with stable_id=%', "parentStableId";
    end if;
    -- parent_path <@ current_path is true when the new parent is this item
    -- or one of its descendants. That move closes a cycle.
    if parent_path <@ current_path then
      raise 'Cannot move an item into itself or one of its subfolders';
    end if;
  end if;

  update table_of_contents_items
  set parent_stable_id = "parentStableId", sort_index = "sortIndex"
  where id = "itemId"
    and (
      parent_stable_id is distinct from "parentStableId"
      or sort_index is distinct from "sortIndex"
    );

  if found
    and old_sort is distinct from "sortIndex"
    and old_parent is not distinct from "parentStableId"
    and coalesce(current_setting('seasketch.publishing', true), '') <> 'true'
  then
    v_editor := nullif(current_setting('session.user_id', true), '')::int;
    if v_editor is not null then
      perform record_changelog(
        pid,
        v_editor,
        'projects',
        pid,
        'layers:list-order-change'::change_log_field_group,
        '{}'::jsonb,
        '{}'::jsonb,
        null,
        null,
        null
      );
    end if;
  end if;

  if "parentStableId" is not null then
    update table_of_contents_items
    set path = parent_path || subpath(path, nlevel(current_path) - 1)
    where is_draft = true and path <@ current_path;
  else
    update table_of_contents_items
    set path = subpath(path, nlevel(current_path) - 1)
    where is_draft = true and path <@ current_path;
  end if;

  select * into item from table_of_contents_items where id = "itemId";
  return item;
end;
$$;

-- Delete logs keep the draft stable id and parent so a folder removal can be
-- bundled with items that were moved into it after the last publish. The
-- published parent of those items is still the old one.
create or replace function public.trg_changelog_table_of_contents_items_deleted()
  returns trigger
  language plpgsql
  security definer
  set search_path to public, pg_temp
as $$
declare
  v_editor     int;
  v_field_group change_log_field_group;
  v_from_blob  jsonb;
  v_ds_id      int;
  v_ds_url     text;
begin
  if not old.is_draft then
    return old;
  end if;

  v_editor := nullif(current_setting('session.user_id', true), '')::int;
  if v_editor is null then
    return old;
  end if;

  v_field_group :=
    case when old.is_folder then 'folder:deleted'::change_log_field_group
         else 'layer:deleted'::change_log_field_group end;

  v_ds_id := null;
  v_ds_url := null;
  if not old.is_folder and old.data_layer_id is not null then
    select dl.data_source_id, ds.url
    into v_ds_id, v_ds_url
    from data_layers dl
    left join data_sources ds on ds.id = dl.data_source_id
    where dl.id = old.data_layer_id;
  end if;

  v_from_blob := jsonb_build_object(
    'data_source_type', old.data_source_type,
    'data_layer_id', old.data_layer_id,
    'data_source_id', v_ds_id,
    'stable_id', old.stable_id,
    'parent_stable_id', old.parent_stable_id,
    'path', old.path::text
  );
  if v_ds_url is not null then
    v_from_blob := v_from_blob || jsonb_build_object('url', v_ds_url);
  end if;

  perform record_changelog(
    old.project_id,
    v_editor,
    'table_of_contents_items',
    old.id,
    v_field_group,
    jsonb_build_object('title', old.title, 'is_folder', old.is_folder),
    '{}'::jsonb,
    v_from_blob,
    null,
    null
  );

  return old;
end;
$$;
