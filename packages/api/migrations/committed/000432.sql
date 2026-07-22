--! Previous: sha1:bb8c6bd2247a8005d6dbb3ccae1f3c0e85f54760
--! Hash: sha1:9d7cf102f1004e681cf9a6a0461123ee670222b2

-- Enter migration here

-- =============================================================================
-- overlay_data_tables.stable_id: logical identity across replace + publish
-- =============================================================================

-- Public/anonymous viewers need this computed collection on published TOC items
-- (table select is already granted to anon; execute was seasketch_user-only).
grant execute on function table_of_contents_items_overlay_data_tables(public.table_of_contents_items) to anon;

alter table overlay_data_tables
  add column if not exists stable_id uuid;

update overlay_data_tables
set stable_id = uuid_generate_v4()
where stable_id is null;

alter table overlay_data_tables
  alter column stable_id set default uuid_generate_v4(),
  alter column stable_id set not null;

comment on column overlay_data_tables.stable_id is
  'Stable logical identity for a data table across version replace and TOC publish. Draft and published copies share the same UUID.';

create unique index if not exists overlay_data_tables_active_stable_id_per_toc
  on overlay_data_tables (table_of_contents_item_id, stable_id)
  where deleted_at is null;

-- Preserve stable_id on replace; new uploads get the column default.
create or replace function complete_overlay_data_table_upload(
  job_id uuid,
  p_name text,
  p_join_column text,
  p_overlay_join_column text,
  p_row_count integer,
  p_parquet_remote text,
  p_column_stats_remote text
) returns overlay_data_tables
language plpgsql
security definer
as $$
declare
  upload overlay_data_table_uploads;
  job project_background_jobs;
  new_row overlay_data_tables;
  old_row overlay_data_tables;
  editor_id int;
  new_version int := 1;
begin
  select * into upload
  from overlay_data_table_uploads
  where project_background_job_id = job_id;
  if upload is null then
    raise exception 'Upload not found for job';
  end if;

  select * into job from project_background_jobs where id = job_id;
  -- Don't resurrect a job that already timed out or was cancelled.
  if job.state not in ('queued', 'running') then
    raise exception 'Job is no longer active (state: %)', job.state;
  end if;

  if upload.replace_overlay_data_table_id is not null then
    select * into old_row
    from overlay_data_tables
    where id = upload.replace_overlay_data_table_id
      and deleted_at is null;
    if old_row is null then
      raise exception 'Replace target no longer active';
    end if;
    new_version := old_row.version + 1;
    update overlay_data_tables
    set deleted_at = now(), updated_at = now()
    where id = old_row.id;
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
    column_stats_remote,
    visualization_columns,
    visualization_ops,
    required_filter_columns,
    stable_id
  ) values (
    upload.table_of_contents_item_id,
    job.project_id,
    p_name,
    p_join_column,
    p_overlay_join_column,
    p_row_count,
    coalesce(job.user_id, nullif(current_setting('session.user_id', true), '')::integer),
    new_version,
    p_parquet_remote,
    p_column_stats_remote,
    coalesce(old_row.visualization_columns, '{}'),
    coalesce(old_row.visualization_ops, '{mean}'),
    coalesce(old_row.required_filter_columns, '{}'),
    coalesce(old_row.stable_id, uuid_generate_v4())
  ) returning * into new_row;

  if upload.replace_overlay_data_table_id is not null then
    update overlay_data_tables
    set replaced_by_id = new_row.id, updated_at = now()
    where id = old_row.id;

    editor_id := coalesce(job.user_id, nullif(current_setting('session.user_id', true), '')::int);
    if editor_id is not null then
      perform record_changelog(
        new_row.project_id,
        editor_id,
        'overlay_data_table',
        new_row.id,
        'data_table:replaced'::change_log_field_group,
        jsonb_build_object(
          'name', old_row.name,
          'version', old_row.version,
          'id', old_row.id,
          'parquet_url', overlay_data_table_parquet_public_url(old_row.parquet_remote)
        ),
        jsonb_build_object('name', new_row.name, 'version', new_row.version, 'id', new_row.id),
        null, null,
        jsonb_build_object('table_of_contents_item_id', new_row.table_of_contents_item_id)
      );
    end if;
  else
    editor_id := coalesce(job.user_id, nullif(current_setting('session.user_id', true), '')::int);
    if editor_id is not null then
      perform record_changelog(
        new_row.project_id,
        editor_id,
        'overlay_data_table',
        new_row.id,
        'data_table:created'::change_log_field_group,
        '{}'::jsonb,
        jsonb_build_object('name', new_row.name, 'version', new_row.version),
        null, null,
        jsonb_build_object('table_of_contents_item_id', new_row.table_of_contents_item_id)
      );
    end if;
  end if;

  update project_background_jobs
  set state = 'complete', progress = 1, progress_message = 'complete', error_message = null
  where id = job_id;

  return new_row;
end;
$$;

-- Copy stable_id when publishing draft overlay data tables.
create or replace function public.publish_table_of_contents("projectId" integer)
returns setof public.table_of_contents_items
language plpgsql
security definer
as $$
declare
  v_editor int;
  v_layer_count int;
  lid int;
  item table_of_contents_items;
  source_id int;
  copied_source_id int;
  acl_type access_control_list_type;
  acl_id int;
  orig_acl_id int;
  new_toc_id int;
  new_interactivity_settings_id int;
begin
  -- check permissions
  if session_is_admin("projectId") = false then
    raise 'Permission denied. Must be a project admin';
  end if;

  -- delete existing published table of contents items, layers, sources, and interactivity settings
  -- (published overlay_data_tables cascade-delete with their TOC rows)
  delete from
    interactivity_settings
  where
    id in (
      select
        data_layers.interactivity_settings_id
      from
        data_layers
      inner join
        table_of_contents_items
      on
        data_layers.id = table_of_contents_items.data_layer_id
      where
        table_of_contents_items.project_id = "projectId" and
        is_draft = false
    );

  delete from data_sources where data_sources.id in (
    select
      data_source_id
    from
      data_layers
    inner join
      table_of_contents_items
    on
      data_layers.id = table_of_contents_items.data_layer_id
    where
      table_of_contents_items.project_id = "projectId" and
      is_draft = false
  );
  delete from data_layers where id in (
    select
      data_layer_id
    from
      table_of_contents_items
    where
      project_id = "projectId" and
      is_draft = false
  );
  delete from
    table_of_contents_items
  where
    project_id = "projectId" and
    is_draft = false;

  -- one-by-one, copy related layers and link table of contents items
  for item in
    select
      *
    from
      table_of_contents_items
    where
      is_draft = true and
      project_id = "projectId"
  loop
    if item.is_folder = false then
      -- copy interactivity settings first
      insert into interactivity_settings (
        type,
        short_template,
        long_template,
        cursor,
        title
      ) select
          type,
          short_template,
          long_template,
          cursor,
          title
        from
          interactivity_settings
        where
          interactivity_settings.id = (
            select interactivity_settings_id from data_layers where data_layers.id = item.data_layer_id
          )
        returning
          id
        into
          new_interactivity_settings_id;

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
      select "projectId",
        data_source_id,
        source_layer,
        sublayer,
        sublayer_type,
        render_under,
        mapbox_gl_styles,
        new_interactivity_settings_id,
        z_index
      from
        data_layers
      where
        id = item.data_layer_id
      returning id into lid;
    else
      lid = item.data_layer_id;
    end if;
    -- TODO: this will have to be modified with the addition of any columns
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
      data_table_join_column
    ) values (
      false,
      "projectId",
      item.path,
      item.stable_id,
      item.parent_stable_id,
      item.title,
      item.is_folder,
      item.show_radio_children,
      item.is_click_off_only,
      item.metadata,
      item.bounds,
      lid,
      item.sort_index,
      item.hide_children,
      item.geoprocessing_reference_id,
      item.translated_props,
      item.enable_download,
      item.enable_data_tables,
      item.data_table_join_column
    ) returning id into new_toc_id;
    select
      type, id into acl_type, orig_acl_id
    from
      access_control_lists
    where
      table_of_contents_item_id = (
        select
          id
        from
          table_of_contents_items
        where is_draft = true and stable_id = item.stable_id
      );
    -- copy access control list settings
    if acl_type != 'public' then
      update
        access_control_lists
      set type = acl_type
      where table_of_contents_item_id = new_toc_id
      returning id into acl_id;
      if acl_type = 'group' then
        insert into
          access_control_list_groups (
            access_control_list_id,
            group_id
          )
        select
          acl_id,
          group_id
        from
          access_control_list_groups
        where
          access_control_list_id = orig_acl_id;
      end if;
    end if;
  end loop;

  -- Copy active draft overlay data tables onto newly published TOC items in one
  -- statement (matched by TOC stable_id). Soft-deleted draft history is skipped.
  -- Data table stable_id is preserved so bookmarks/prefs survive publish.
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
    column_stats_remote,
    visualization_columns,
    visualization_ops,
    required_filter_columns,
    stable_id
  )
  select
    published_toc.id,
    odt.project_id,
    odt.name,
    odt.join_column,
    odt.overlay_join_column,
    odt.row_count,
    odt.created_by,
    odt.version,
    odt.parquet_remote,
    odt.column_stats_remote,
    odt.visualization_columns,
    odt.visualization_ops,
    odt.required_filter_columns,
    odt.stable_id
  from overlay_data_tables odt
  inner join table_of_contents_items draft_toc
    on draft_toc.id = odt.table_of_contents_item_id
  inner join table_of_contents_items published_toc
    on published_toc.project_id = draft_toc.project_id
    and published_toc.stable_id = draft_toc.stable_id
    and published_toc.is_draft = false
  where draft_toc.project_id = "projectId"
    and draft_toc.is_draft = true
    and draft_toc.is_folder = false
    and odt.deleted_at is null;

  -- one-by-one, copy related sources and update foreign keys of layers
  for source_id in
    select distinct(data_source_id) from data_layers where id in (
      select
        data_layer_id
      from
        table_of_contents_items
      where
        is_draft = false and
        project_id = "projectId" and
        is_folder = false
    )
  loop
    -- TODO: This function will have to be updated whenever the schema
    -- changes since these columns are hard coded... no way around it.
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
      created_by
    )
      select
        "projectId",
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
      created_by
      from
        data_sources
      where
        id = source_id
      returning id into copied_source_id;
    -- copy data_upload_outputs
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
    ) select
        copied_source_id,
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
      from
        data_upload_outputs
      where
        data_source_id = source_id;
    -- update data_layers that should now reference the copy
    update
      data_layers
    set data_source_id = copied_source_id
    where
      data_source_id = source_id and
      data_layers.id in ((
        select distinct(data_layer_id) from table_of_contents_items where is_draft = false and
        project_id = "projectId" and
        is_folder = false
      ));
  end loop;
  update
    projects
  set
    draft_table_of_contents_has_changes = false,
    table_of_contents_last_published = now()
  where
    id = "projectId";

  v_editor := nullif(current_setting('session.user_id', true), '')::int;
  if v_editor is not null then
    select count(*)::int into v_layer_count
    from table_of_contents_items
    where project_id = "projectId"
      and is_draft = true
      and is_folder = false;

    perform record_changelog(
      "projectId",
      v_editor,
      'projects',
      "projectId",
      'layers:published'::change_log_field_group,
      '{}'::jsonb,
      jsonb_build_object('layer_count', v_layer_count),
      null,
      null,
      null
    );
  end if;
  -- return items
  return query select * from table_of_contents_items
    where project_id = "projectId" and is_draft = false;
end;
$$;

-- =============================================================================
-- map_bookmarks.data_table_states
-- =============================================================================

alter table map_bookmarks
  add column if not exists data_table_states jsonb not null default '{}'::jsonb;

comment on column map_bookmarks.data_table_states is
  'JSON map of TOC stableId -> { stableId, column?, op?, filters? } for activated overlay data tables.';

grant select(data_table_states) on table map_bookmarks to anon;

drop function if exists create_map_bookmark(text, boolean, jsonb, text[], integer, jsonb, jsonb, integer[], integer[], jsonb, text, jsonb, jsonb, text);

create or replace function public.create_map_bookmark(
  slug text,
  "isPublic" boolean,
  style jsonb,
  "visibleDataLayers" text[],
  "selectedBasemap" integer,
  "basemapOptionalLayerStates" jsonb,
  "cameraOptions" jsonb,
  "mapDimensions" integer[],
  "visibleSketches" integer[],
  "sidebarState" jsonb,
  "basemapName" text,
  "layerNames" jsonb,
  "sketchNames" jsonb,
  "clientGeneratedThumbnail" text,
  "dataTableStates" jsonb default '{}'::jsonb
) returns public.map_bookmarks
language plpgsql
security definer
as $$
declare
  bookmark map_bookmarks;
  pid int;
begin
  select id into pid from projects where projects.slug = create_map_bookmark.slug;
  if session_has_project_access(pid) then
    insert into map_bookmarks (
      project_id,
      user_id,
      is_public,
      style,
      visible_data_layers,
      selected_basemap,
      basemap_optional_layer_states,
      camera_options,
      map_dimensions,
      visible_sketches,
      sidebar_state,
      basemap_name,
      layer_names,
      sketch_names,
      client_generated_thumbnail,
      data_table_states
    ) values (
      pid,
      nullif(current_setting('session.user_id', TRUE), '')::int,
      "isPublic",
      create_map_bookmark.style,
      "visibleDataLayers",
      "selectedBasemap",
      "basemapOptionalLayerStates",
      "cameraOptions",
      "mapDimensions",
      "visibleSketches",
      "sidebarState",
      "basemapName",
      "layerNames",
      "sketchNames",
      "clientGeneratedThumbnail",
      coalesce("dataTableStates", '{}'::jsonb)
    ) returning * into bookmark;
    return bookmark;
  else
    raise exception 'Permission denied';
  end if;
end;
$$;

grant execute on function create_map_bookmark to seasketch_user;
