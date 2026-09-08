--! Previous: sha1:7c0f7e63ef65b27bf6e05fb0fda4115f4bf4aefe
--! Hash: sha1:7fd9ad8fd36fdaaffd1f3c0b7deb63dcdbed4b75

-- Enter migration here

alter table overlay_data_tables
  add column if not exists hidden_filter_columns text[] default '{}';
comment on column overlay_data_tables.hidden_filter_columns is
  'Filter columns omitted from the end-user Add filter list. Required filters cannot be hidden.';

alter table overlay_data_tables
  add column if not exists filter_column_labels jsonb default '{}'::jsonb;
comment on column overlay_data_tables.filter_column_labels is
  'Custom display labels for filter columns, keyed by original column name. Empty or missing keys use the column name.';

create or replace function public.complete_overlay_data_table_upload(
  job_id uuid,
  p_name text,
  p_join_column text,
  p_overlay_join_column text,
  p_row_count integer,
  p_parquet_remote text,
  p_column_stats_remote text,
  p_temporal jsonb default null
) returns public.overlay_data_tables
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
    hidden_filter_columns,
    filter_column_labels,
    stable_id,
    temporal
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
    p_temporal
  ) returning * into new_row;

  if upload.replace_overlay_data_table_id is not null then
    update overlay_data_tables
    set replaced_by_id = new_row.id, updated_at = now()
    where id = old_row.id;

    editor_id := coalesce(job.user_id, nullif(current_setting('session.user_id', true), '')::int);
    if editor_id is not null then
      if upload.reprocess_of_overlay_data_table_id is not null then
        -- Temporal reprocess: distinct from a CSV/source replacement.
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

comment on function public.complete_overlay_data_table_upload(uuid, text, text, text, integer, text, text, jsonb) is
  '@omit';

revoke all on function public.complete_overlay_data_table_upload(uuid, text, text, text, integer, text, text, jsonb) from public;

CREATE OR REPLACE FUNCTION public.publish_table_of_contents("projectId" integer)
 RETURNS SETOF table_of_contents_items
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
    odt.hidden_filter_columns,
    odt.filter_column_labels,
    odt.temporal,
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
$function$
;

-- Signature change (added hidden_filter_columns, filter_column_labels); replace rather than overload.
drop function if exists set_overlay_data_table_visualization_settings(integer, text[], text[], text[]);

create or replace function set_overlay_data_table_visualization_settings(
  table_id integer,
  visualization_columns text[],
  visualization_ops text[],
  required_filter_columns text[] default '{}',
  hidden_filter_columns text[] default '{}',
  filter_column_labels jsonb default '{}'::jsonb
)
returns overlay_data_tables
language plpgsql
security definer
as $$
declare
  row overlay_data_tables;
  old_columns text[];
  old_ops text[];
  old_required text[];
  old_hidden text[];
  old_labels jsonb;
  editor_id int;
  invalid_ops text[];
  new_required text[];
  new_hidden text[];
  new_labels jsonb;
begin
  select * into row from overlay_data_tables where id = table_id and deleted_at is null;
  if row is null then
    raise exception 'Active data table not found';
  end if;
  if not session_is_admin(row.project_id) then
    raise exception 'permission denied';
  end if;
  if not exists (
    select 1 from table_of_contents_items
    where id = row.table_of_contents_item_id and is_draft = true
  ) then
    raise exception 'Can only update visualization settings on draft layers';
  end if;

  select array_agg(op) into invalid_ops
  from unnest(coalesce(set_overlay_data_table_visualization_settings.visualization_ops, '{}')) op
  where op not in ('count', 'sum', 'mean', 'min', 'max', 'median');
  if invalid_ops is not null and array_length(invalid_ops, 1) > 0 then
    raise exception 'Invalid visualization op(s): %', array_to_string(invalid_ops, ', ');
  end if;

  if set_overlay_data_table_visualization_settings.filter_column_labels is not null
     and jsonb_typeof(set_overlay_data_table_visualization_settings.filter_column_labels) is distinct from 'object' then
    raise exception 'filter_column_labels must be a JSON object';
  end if;

  select coalesce(array_agg(c order by ordinality), '{}')
    into new_required
  from unnest(coalesce(set_overlay_data_table_visualization_settings.required_filter_columns, '{}')) with ordinality as t(c, ordinality)
  where c is not null and c <> '';

  select coalesce(array_agg(c order by ordinality), '{}')
    into new_hidden
  from unnest(coalesce(set_overlay_data_table_visualization_settings.hidden_filter_columns, '{}')) with ordinality as t(c, ordinality)
  where c is not null and c <> ''
    and not (c = any(new_required));

  select coalesce(
    (
      select jsonb_object_agg(key, trim(val))
      from jsonb_each_text(
        coalesce(set_overlay_data_table_visualization_settings.filter_column_labels, '{}'::jsonb)
      ) as labels(key, val)
      where length(key) > 0 and length(trim(val)) > 0
    ),
    '{}'::jsonb
  ) into new_labels;

  old_columns := row.visualization_columns;
  old_ops := row.visualization_ops;
  old_required := row.required_filter_columns;
  old_hidden := row.hidden_filter_columns;
  old_labels := row.filter_column_labels;

  update overlay_data_tables
  set visualization_columns = coalesce(set_overlay_data_table_visualization_settings.visualization_columns, '{}'),
      visualization_ops = coalesce(set_overlay_data_table_visualization_settings.visualization_ops, '{}'),
      required_filter_columns = new_required,
      hidden_filter_columns = new_hidden,
      filter_column_labels = new_labels,
      updated_at = now()
  where id = table_id
  returning * into row;

  editor_id := nullif(current_setting('session.user_id', true), '')::int;
  if editor_id is not null then
    perform record_changelog(
      row.project_id,
      editor_id,
      'overlay_data_table',
      row.id,
      'data_table:visualization_settings_updated'::change_log_field_group,
      jsonb_build_object(
        'name', row.name,
        'version', row.version,
        'visualizationColumns', old_columns,
        'visualizationOps', old_ops,
        'requiredFilterColumns', old_required,
        'hiddenFilterColumns', old_hidden,
        'filterColumnLabels', old_labels
      ),
      jsonb_build_object(
        'name', row.name,
        'version', row.version,
        'visualizationColumns', row.visualization_columns,
        'visualizationOps', row.visualization_ops,
        'requiredFilterColumns', row.required_filter_columns,
        'hiddenFilterColumns', row.hidden_filter_columns,
        'filterColumnLabels', row.filter_column_labels
      ),
      null, null,
      jsonb_build_object('table_of_contents_item_id', row.table_of_contents_item_id, 'version', row.version)
    );
  end if;
  return row;
end;
$$;

grant execute on function set_overlay_data_table_visualization_settings(integer, text[], text[], text[], text[], jsonb) to seasketch_user;
