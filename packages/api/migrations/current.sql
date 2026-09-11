-- Enter migration here

-- Organism identity on overlay data tables (design-docs/data-tables/organism-identity.md).

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'change_log_field_group' and e.enumlabel = 'data_table:organism'
  ) then
    alter type change_log_field_group add value 'data_table:organism';
  end if;
end
$$;

alter table overlay_data_tables
  add column if not exists organism jsonb;

comment on column overlay_data_tables.organism is '@omit';

alter table overlay_data_table_uploads
  add column if not exists organism_config jsonb;

comment on column overlay_data_table_uploads.organism_config is
  'Ephemeral DataTableOrganismConfig for an enrichment job. Not copied onto overlay_data_tables until the job succeeds.';

create or replace function public.update_overlay_data_table_organism(
  p_overlay_data_table_id integer,
  p_organism jsonb
) returns public.overlay_data_tables
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_row public.overlay_data_tables;
  v_old jsonb;
  v_editor int;
begin
  select * into v_row from overlay_data_tables where id = p_overlay_data_table_id;
  if v_row.id is null then
    raise exception 'Overlay data table not found';
  end if;
  if not session_is_admin(v_row.project_id) then
    raise exception 'Permission denied. Must be a project admin';
  end if;
  if not overlay_data_table_linked_toc_is_draft(
    v_row.table_of_contents_item_id,
    v_row.project_id
  ) then
    raise exception 'Can only update organism identity on draft data tables';
  end if;
  v_old := v_row.organism;
  if v_old is not distinct from p_organism then
    return v_row;
  end if;
  update overlay_data_tables
    set organism = p_organism, updated_at = now()
    where id = p_overlay_data_table_id
    returning * into v_row;
  v_editor := nullif(current_setting('session.user_id', true), '')::int;
  if v_editor is not null then
    perform record_changelog(
      v_row.project_id,
      v_editor,
      'overlay_data_table',
      v_row.id,
      'data_table:organism'::change_log_field_group,
      jsonb_build_object(
        'name', v_row.name,
        'version', v_row.version,
        'id', v_row.id,
        'organism', v_old
      ),
      jsonb_build_object(
        'name', v_row.name,
        'version', v_row.version,
        'id', v_row.id,
        'organism', v_row.organism
      ),
      null, null,
      jsonb_build_object(
        'table_of_contents_item_id', v_row.table_of_contents_item_id,
        'reprocessed', false
      )
    );
  end if;
  return v_row;
end;
$$;

comment on function public.update_overlay_data_table_organism(integer, jsonb) is '@omit';
revoke all on function public.update_overlay_data_table_organism(integer, jsonb) from public;
grant execute on function public.update_overlay_data_table_organism(integer, jsonb) to seasketch_user;

create or replace function public.create_overlay_data_table_organism_reprocess(
  table_id integer,
  organism_config jsonb,
  class_csv_filename text default null,
  class_csv_content_type text default null
) returns public.overlay_data_table_uploads
language plpgsql
security definer
as $$
declare
  upload overlay_data_table_uploads;
  job project_background_jobs;
  tbl overlay_data_tables;
  pid int;
  geostats jsonb;
  join_col text;
  enabled boolean;
  has_class_csv boolean;
  filename text;
  content_type text;
begin
  select *
    into tbl
  from overlay_data_tables
  where id = table_id
    and deleted_at is null;
  if tbl is null then
    raise exception 'Data table not found or not active';
  end if;

  select project_id, enable_data_tables, data_table_join_column
    into pid, enabled, join_col
  from table_of_contents_items
  where id = tbl.table_of_contents_item_id
    and is_draft = true
    and is_folder = false;
  if pid is null then
    raise exception 'Can only enrich data tables on draft layers';
  end if;
  if not session_is_admin(pid) then
    raise exception 'permission denied';
  end if;
  if not coalesce(enabled, false) then
    raise exception 'Data tables are not enabled for this layer';
  end if;

  if organism_config is null or jsonb_typeof(organism_config) <> 'object' then
    raise exception 'organism_config must be an object';
  end if;
  if coalesce(organism_config->>'column', '') = '' then
    raise exception 'organism_config.column is required';
  end if;

  select ds.geostats into geostats
  from table_of_contents_items toc
  inner join data_layers dl on dl.id = toc.data_layer_id
  inner join data_sources ds on ds.id = dl.data_source_id
  where toc.id = tbl.table_of_contents_item_id;
  if geostats is null then
    raise exception 'Overlay layer has no geostats';
  end if;

  if exists (
    select 1
    from overlay_data_table_uploads odtu
    inner join project_background_jobs pbj on pbj.id = odtu.project_background_job_id
    where (
      odtu.replace_overlay_data_table_id = tbl.id
      or odtu.reprocess_of_overlay_data_table_id = tbl.id
    )
      and pbj.state in ('queued', 'running')
  ) then
    raise exception 'There is already an active upload or reprocess for this data table';
  end if;

  has_class_csv := nullif(btrim(coalesce(class_csv_filename, '')), '') is not null;
  if has_class_csv then
    filename := class_csv_filename;
    content_type := coalesce(nullif(btrim(class_csv_content_type), ''), 'text/csv');
  else
    filename := 'organism-reprocess-' || tbl.stable_id::text || '.parquet';
    content_type := 'application/vnd.apache.parquet';
  end if;

  insert into project_background_jobs (
    project_id,
    title,
    user_id,
    type,
    timeout_at
  ) values (
    pid,
    'Enrich data table organisms ' || tbl.name,
    nullif(current_setting('session.user_id', true), '')::integer,
    'data_table_upload',
    timezone('utc', now()) + interval '15 minutes'
  ) returning * into job;

  insert into overlay_data_table_uploads (
    project_background_job_id,
    table_of_contents_item_id,
    filename,
    content_type,
    processing_options,
    overlay_geostats,
    overlay_join_column,
    reprocess_of_overlay_data_table_id,
    organism_config
  ) values (
    job.id,
    tbl.table_of_contents_item_id,
    filename,
    content_type,
    jsonb_build_object(
      'joinColumn', tbl.join_column,
      'overlayJoinColumn', tbl.overlay_join_column,
      'name', tbl.name
    ),
    geostats,
    coalesce(join_col, tbl.overlay_join_column),
    tbl.id,
    organism_config
  ) returning * into upload;

  if has_class_csv then
    return upload;
  end if;

  update project_background_jobs
  set
    state = 'running',
    progress_message = 'queued',
    started_at = now(),
    timeout_at = timezone('utc', now()) + interval '15 minutes'
  where id = job.id;

  perform graphile_worker.add_job(
    'processDataTableUpload',
    json_build_object('jobId', job.id),
    max_attempts := 1
  );

  return upload;
end;
$$;

comment on function public.create_overlay_data_table_organism_reprocess(integer, jsonb, text, text) is
  'Admin-only. Starts a draft organism-enrichment job. Optional class CSV is uploaded to the returned presigned URL, then submitOverlayDataTableUpload. Does not rewrite data.parquet. Queue wait matches other data-table jobs (15 minutes). Running timeout is 15 minutes for WoRMS per-id details on large class tables.';
revoke all on function public.create_overlay_data_table_organism_reprocess(integer, jsonb, text, text) from public;
grant execute on function public.create_overlay_data_table_organism_reprocess(integer, jsonb, text, text) to seasketch_user;

create or replace function public.complete_overlay_data_table_organism_reprocess(
  job_id uuid,
  p_organism jsonb
) returns public.overlay_data_tables
language plpgsql
security definer
as $$
declare
  upload overlay_data_table_uploads;
  job project_background_jobs;
  v_row overlay_data_tables;
  v_old jsonb;
  editor_id int;
begin
  select * into upload
  from overlay_data_table_uploads
  where project_background_job_id = job_id;
  if upload is null then
    raise exception 'Upload not found for job';
  end if;

  select * into job from project_background_jobs where id = job_id;
  if job.state not in ('queued', 'running') then
    raise exception 'Job is no longer active (state: %)', job.state;
  end if;

  if upload.reprocess_of_overlay_data_table_id is null then
    raise exception 'Organism reprocess is missing reprocess_of_overlay_data_table_id';
  end if;
  if upload.organism_config is null then
    raise exception 'Organism reprocess is missing organism_config';
  end if;

  select * into v_row
  from overlay_data_tables
  where id = upload.reprocess_of_overlay_data_table_id
    and deleted_at is null;
  if v_row is null then
    raise exception 'Source data table is no longer active';
  end if;

  v_old := v_row.organism;
  update overlay_data_tables
    set organism = p_organism, updated_at = now()
    where id = v_row.id
    returning * into v_row;

  editor_id := coalesce(job.user_id, nullif(current_setting('session.user_id', true), '')::int);
  if editor_id is not null and v_old is distinct from p_organism then
    perform record_changelog(
      v_row.project_id,
      editor_id,
      'overlay_data_table',
      v_row.id,
      'data_table:organism'::change_log_field_group,
      jsonb_build_object(
        'name', v_row.name,
        'version', v_row.version,
        'id', v_row.id,
        'organism', v_old
      ),
      jsonb_build_object(
        'name', v_row.name,
        'version', v_row.version,
        'id', v_row.id,
        'organism', v_row.organism
      ),
      null, null,
      jsonb_build_object(
        'table_of_contents_item_id', v_row.table_of_contents_item_id,
        'reprocessed', true
      )
    );
  end if;

  update project_background_jobs
  set state = 'complete', progress = 1, progress_message = 'complete', error_message = null
  where id = job_id;

  return v_row;
end;
$$;

comment on function public.complete_overlay_data_table_organism_reprocess(uuid, jsonb) is '@omit';
revoke all on function public.complete_overlay_data_table_organism_reprocess(uuid, jsonb) from public;

CREATE OR REPLACE FUNCTION public.complete_overlay_data_table_upload(job_id uuid, p_name text, p_join_column text, p_overlay_join_column text, p_row_count integer, p_parquet_remote text, p_column_stats_remote text, p_temporal jsonb DEFAULT NULL::jsonb, p_nodata_values jsonb DEFAULT NULL::jsonb, p_source_parquet_remote text DEFAULT NULL::text) RETURNS public.overlay_data_tables
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  upload overlay_data_table_uploads;
  job project_background_jobs;
  new_row overlay_data_tables;
  old_row overlay_data_tables;
  editor_id int;
  new_version int := 1;
  next_nodata jsonb;
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

  next_nodata := coalesce(p_nodata_values, old_row.nodata_values, '[]'::jsonb);
  if jsonb_typeof(next_nodata) <> 'array' then
    next_nodata := '[]'::jsonb;
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
    hidden_filter_columns,
    filter_column_labels,
    stable_id,
    temporal,
    organism,
    nodata_values,
    source_parquet_remote,
    description
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
    coalesce(old_row.hidden_filter_columns, '{}'),
    coalesce(old_row.filter_column_labels, '{}'::jsonb),
    coalesce(old_row.stable_id, uuid_generate_v4()),
    p_temporal,
    old_row.organism,
    next_nodata,
    coalesce(p_source_parquet_remote, old_row.source_parquet_remote, p_parquet_remote),
    old_row.description
  ) returning * into new_row;

  if upload.replace_overlay_data_table_id is not null then
    update overlay_data_tables
    set replaced_by_id = new_row.id, updated_at = now()
    where id = old_row.id;

    editor_id := coalesce(job.user_id, nullif(current_setting('session.user_id', true), '')::int);
    if editor_id is not null then
      if upload.reprocess_of_overlay_data_table_id is not null
         and upload.nodata_config is not null then
        perform record_changelog(
          new_row.project_id,
          editor_id,
          'overlay_data_table',
          new_row.id,
          'data_table:nodata'::change_log_field_group,
          jsonb_build_object(
            'name', old_row.name,
            'version', old_row.version,
            'id', old_row.id,
            'nodata_values', old_row.nodata_values,
            'parquet_url', overlay_data_table_parquet_public_url(old_row.parquet_remote)
          ),
          jsonb_build_object(
            'name', new_row.name,
            'version', new_row.version,
            'id', new_row.id,
            'nodata_values', new_row.nodata_values
          ),
          null, null,
          jsonb_build_object(
            'table_of_contents_item_id', new_row.table_of_contents_item_id,
            'reprocessed', true
          )
        );
      elsif upload.reprocess_of_overlay_data_table_id is not null then
        perform record_changelog(
          new_row.project_id,
          editor_id,
          'overlay_data_table',
          new_row.id,
          'data_table:temporal'::change_log_field_group,
          jsonb_build_object(
            'name', old_row.name,
            'version', old_row.version,
            'id', old_row.id,
            'temporal', old_row.temporal,
            'parquet_url', overlay_data_table_parquet_public_url(old_row.parquet_remote)
          ),
          jsonb_build_object(
            'name', new_row.name,
            'version', new_row.version,
            'id', new_row.id,
            'temporal', new_row.temporal
          ),
          null, null,
          jsonb_build_object(
            'table_of_contents_item_id', new_row.table_of_contents_item_id,
            'reprocessed', true
          )
        );
      else
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

CREATE OR REPLACE FUNCTION public.publish_table_of_contents("projectId" integer) RETURNS SETOF public.table_of_contents_items
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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

  -- Never delete shared data library sources; they are referenced by the
  -- canonical template and by draft/published copies in other projects.
  delete from data_sources where data_sources.data_library_template_id is null and data_sources.id in (
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
      data_table_join_column,
      copied_from_data_library_template_id,
      hide_arcgis_rest_link
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
      item.data_table_join_column,
      item.copied_from_data_library_template_id,
      item.hide_arcgis_rest_link
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
    odt.hidden_filter_columns,
    odt.filter_column_labels,
    odt.temporal,
    odt.organism,
    odt.nodata_values,
    odt.source_parquet_remote,
    odt.stable_id,
    odt.description
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

  -- one-by-one, copy related sources and update foreign keys of layers.
  -- Data library sources are skipped: published layers keep referencing the
  -- shared source so library updates are visible to end-users immediately
  -- ("live" layers), without requiring a republish.
  for source_id in
    select distinct(data_layers.data_source_id) from data_layers
    inner join data_sources
      on data_sources.id = data_layers.data_source_id
    where data_sources.data_library_template_id is null and data_layers.id in (
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
      temporal,
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
      temporal,
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
