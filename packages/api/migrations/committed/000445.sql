--! Previous: sha1:cbb7ae9752adb764f1dd72b52ace9d2fb44175e6
--! Hash: sha1:c2c4158622c68705929b8521bf3ed21f0f88d14b

-- Calculation mode for data table map statistics.
-- simple: existing row-level ops. replicates: within-replicate collapse, then across-replicate ops.

alter table overlay_data_tables
  add column if not exists calculation_mode text not null default 'simple',
  add column if not exists additional_replicate_identifiers text[] not null default '{}',
  add column if not exists replicate_label text not null default 'replicate',
  add column if not exists replicate_label_custom text,
  add column if not exists within_replicate_operations jsonb not null default '{}'::jsonb,
  add column if not exists across_replicate_operations jsonb not null default '{}'::jsonb,
  add column if not exists subject_column text,
  add column if not exists observation_detail_columns text[] not null default '{}',
  add column if not exists coverage_mode text not null default 'all_surveyed',
  add column if not exists coverage_remote text,
  add column if not exists effort_marker_values text[] not null default '{}',
  add column if not exists excluded_values jsonb not null default '{}'::jsonb;

alter table overlay_data_tables
  drop constraint if exists overlay_data_tables_calculation_mode_check;
alter table overlay_data_tables
  add constraint overlay_data_tables_calculation_mode_check
  check (calculation_mode in ('simple', 'replicates'));

alter table overlay_data_tables
  drop constraint if exists overlay_data_tables_replicate_label_check;
alter table overlay_data_tables
  add constraint overlay_data_tables_replicate_label_check
  check (replicate_label in ('replicate', 'transect', 'quadrat', 'station', 'camera', 'sample', 'custom'));

alter table overlay_data_tables
  drop constraint if exists overlay_data_tables_replicate_label_custom_length;
alter table overlay_data_tables
  add constraint overlay_data_tables_replicate_label_custom_length
  check (replicate_label_custom is null or char_length(replicate_label_custom) <= 40);

alter table overlay_data_tables
  drop constraint if exists overlay_data_tables_coverage_mode_check;
alter table overlay_data_tables
  add constraint overlay_data_tables_coverage_mode_check
  check (coverage_mode in ('all_surveyed', 'rows_only', 'coverage_file'));

-- Subject column. Code name: subject_column. Backfilled from organism identity.
update overlay_data_tables
set subject_column = organism->>'column'
where subject_column is null
  and organism is not null
  and coalesce(organism->>'column', '') <> '';

comment on column overlay_data_tables.calculation_mode is
  'How to turn rows into a map value. simple: each row is already a summary. replicates: rows are observations inside replicates.';
comment on column overlay_data_tables.additional_replicate_identifiers is
  'Replicate columns. Code name: additional_replicate_identifiers. With the survey time and the join column, these identify one replicate.';
comment on column overlay_data_tables.replicate_label is
  'Replicate word shown in the legend. Code name: replicate_label. custom uses replicate_label_custom.';
comment on column overlay_data_tables.replicate_label_custom is
  'Custom replicate word. Code name: replicate_label_custom.';
comment on column overlay_data_tables.within_replicate_operations is
  'Within a replicate. Code name: within_replicate_operations. JSON object of value column to sum|mean|min|max. Missing columns default to sum.';
comment on column overlay_data_tables.across_replicate_operations is
  'Across replicates. Code name: across_replicate_operations. JSON object of value column to an array of sum|mean|min|max. Missing columns default to ["mean"].';
comment on column overlay_data_tables.subject_column is
  'Subject column. Code name: subject_column. Names what each row is an observation of. organism.column must equal this when organism enrichment is set.';
comment on column overlay_data_tables.observation_detail_columns is
  'Detail columns. Code name: observation_detail_columns. Columns that describe one observation rather than the replicate. Filtering them narrows what is counted and does not remove replicates.';
comment on column overlay_data_tables.coverage_mode is
  'When a subject is missing from a replicate. Code name: coverage_mode. all_surveyed: it was surveyed and none were seen. rows_only: nothing can be assumed. coverage_file: it depends on when and where.';
comment on column overlay_data_tables.coverage_remote is
  'Coverage file. Code name: coverage_remote. R2 key of coverage.json beside data.parquet.';
comment on column overlay_data_tables.effort_marker_values is
  'Nothing seen rows. Code name: effort_marker_values. Values in the subject or a detail column that mean the replicate was surveyed and nothing was seen.';
comment on column overlay_data_tables.excluded_values is
  'Rows to ignore. Code name: excluded_values. JSON object of column name to values whose rows are left out of replicates, observations, and effort.';
comment on column overlay_data_tables.visualization_columns is
  'Value columns. Code name: visualization_columns. Empty means any numeric column.';
comment on column overlay_data_tables.visualization_ops is
  'Calculations. Code name: visualization_ops. Used when each row is already a summary.';
comment on column overlay_data_tables.join_column is
  'Join column. Code name: join_column. Values match feature IDs.';


create or replace function public.complete_overlay_data_table_upload(job_id uuid, p_name text, p_join_column text, p_overlay_join_column text, p_row_count integer, p_parquet_remote text, p_column_stats_remote text, p_temporal jsonb DEFAULT NULL::jsonb, p_nodata_values jsonb DEFAULT NULL::jsonb, p_source_parquet_remote text DEFAULT NULL::text) RETURNS public.overlay_data_tables
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
    coalesce(old_row.calculation_mode, 'simple'),
    coalesce(old_row.additional_replicate_identifiers, '{}'),
    coalesce(old_row.replicate_label, 'replicate'),
    old_row.replicate_label_custom,
    coalesce(old_row.within_replicate_operations, '{}'::jsonb),
    coalesce(old_row.across_replicate_operations, '{}'::jsonb),
    old_row.subject_column,
    coalesce(old_row.observation_detail_columns, '{}'),
    coalesce(old_row.coverage_mode, 'all_surveyed'),
    case
      when old_row.coverage_remote is not null
        then regexp_replace(p_parquet_remote, '/[^/]+$', '/coverage.json')
      else null
    end,
    coalesce(old_row.effort_marker_values, '{}'),
    coalesce(old_row.excluded_values, '{}'::jsonb),
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

create or replace function public.copy_table_of_contents_item_recursive(item_id integer, copy_data_source boolean, append_copy_to_name boolean, project_id integer, lpath public.ltree, parent_stable_id text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  copy_id int;
  child record;
  new_stable_id text;
  old_stable_id text;
begin
  select stable_id into old_stable_id
  from table_of_contents_items
  where id = item_id;

  copy_id := copy_table_of_contents_item(
    item_id,
    copy_data_source,
    append_copy_to_name,
    project_id,
    lpath,
    parent_stable_id
  );

  -- copy_table_of_contents_item predates data tables and omits these TOC flags.
  update table_of_contents_items copied
  set enable_data_tables = source.enable_data_tables,
      data_table_join_column = source.data_table_join_column
  from table_of_contents_items source
  where copied.id = copy_id
    and source.id = item_id;

  -- Duplicate active tables onto the copied draft layer. Artifact remotes are
  -- shared until a table is replaced or reprocessed, so sidecar deletion must
  -- remain reference-aware.
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
    description
  )
  select
    copy_id,
    copy_table_of_contents_item_recursive.project_id,
    odt.name,
    odt.join_column,
    odt.overlay_join_column,
    odt.row_count,
    coalesce(
      nullif(current_setting('session.user_id', true), '')::integer,
      odt.created_by
    ),
    odt.version,
    odt.parquet_remote,
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
    odt.description
  from overlay_data_tables odt
  where odt.table_of_contents_item_id = item_id
    and odt.deleted_at is null;

  select stable_id into new_stable_id
  from table_of_contents_items
  where id = copy_id;

  for child in
    select *
    from table_of_contents_items
    where table_of_contents_items.parent_stable_id = old_stable_id
      and is_draft = true
  loop
    perform copy_table_of_contents_item_recursive(
      child.id,
      copy_data_source,
      false,
      project_id,
      lpath || new_stable_id,
      new_stable_id
    );
  end loop;
  return copy_id;
end;
$$;

create or replace function public.publish_table_of_contents("projectId" integer) RETURNS SETOF public.table_of_contents_items
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


drop function if exists public.set_overlay_data_table_visualization_settings(integer, text[], text[], text[], text[], jsonb);
drop function if exists public.set_overlay_data_table_visualization_settings(integer, text[], text[], text[], text[], jsonb, text, text[], text, text, jsonb, jsonb);

create or replace function public.set_overlay_data_table_visualization_settings(
  table_id integer,
  visualization_columns text[],
  visualization_ops text[],
  required_filter_columns text[] default '{}',
  hidden_filter_columns text[] default '{}',
  filter_column_labels jsonb default '{}'::jsonb,
  calculation_mode text default 'simple',
  additional_replicate_identifiers text[] default '{}',
  replicate_label text default 'replicate',
  replicate_label_custom text default null,
  within_replicate_operations jsonb default '{}'::jsonb,
  across_replicate_operations jsonb default '{}'::jsonb,
  subject_column text default null,
  observation_detail_columns text[] default '{}',
  coverage_mode text default 'all_surveyed',
  effort_marker_values text[] default '{}',
  excluded_values jsonb default '{}'::jsonb
) returns public.overlay_data_tables
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
  old_mode text;
  old_identifiers text[];
  old_label text;
  old_label_custom text;
  old_within jsonb;
  old_across jsonb;
  old_subject text;
  old_details text[];
  old_coverage text;
  old_markers text[];
  old_excluded jsonb;
  editor_id int;
  invalid_ops text[];
  new_required text[];
  new_hidden text[];
  new_labels jsonb;
  new_mode text;
  new_identifiers text[];
  new_label text;
  new_label_custom text;
  new_within jsonb;
  new_across jsonb;
  new_subject text;
  new_details text[];
  new_coverage text;
  new_markers text[];
  new_excluded jsonb;
  bad_within text;
  bad_across text;
  marker_overlap text;
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

  new_mode := coalesce(set_overlay_data_table_visualization_settings.calculation_mode, 'simple');
  if new_mode not in ('simple', 'replicates') then
    raise exception 'Invalid calculation_mode: %', new_mode;
  end if;

  select coalesce(array_agg(distinct c order by c), '{}')
    into new_identifiers
  from unnest(coalesce(set_overlay_data_table_visualization_settings.additional_replicate_identifiers, '{}')) as t(c)
  where c is not null and btrim(c) <> '';

  new_label := coalesce(set_overlay_data_table_visualization_settings.replicate_label, 'replicate');
  if new_label not in ('replicate', 'transect', 'quadrat', 'station', 'camera', 'sample', 'custom') then
    raise exception 'Invalid replicate_label: %', new_label;
  end if;
  new_label_custom := nullif(btrim(coalesce(set_overlay_data_table_visualization_settings.replicate_label_custom, '')), '');
  if new_label <> 'custom' then
    new_label_custom := null;
  elsif new_label_custom is not null and char_length(new_label_custom) > 40 then
    raise exception 'replicate_label_custom is too long';
  end if;

  if set_overlay_data_table_visualization_settings.within_replicate_operations is not null
     and jsonb_typeof(set_overlay_data_table_visualization_settings.within_replicate_operations) is distinct from 'object' then
    raise exception 'within_replicate_operations must be a JSON object';
  end if;
  if set_overlay_data_table_visualization_settings.across_replicate_operations is not null
     and jsonb_typeof(set_overlay_data_table_visualization_settings.across_replicate_operations) is distinct from 'object' then
    raise exception 'across_replicate_operations must be a JSON object';
  end if;

  select string_agg(key, ', ') into bad_within
  from jsonb_each_text(coalesce(set_overlay_data_table_visualization_settings.within_replicate_operations, '{}'::jsonb)) as ops(key, val)
  where val not in ('sum', 'mean', 'min', 'max');
  if bad_within is not null then
    raise exception 'Invalid within-replicate op for: %', bad_within;
  end if;

  select string_agg(entry.key, ', ') into bad_across
  from jsonb_each(coalesce(set_overlay_data_table_visualization_settings.across_replicate_operations, '{}'::jsonb)) as entry(key, val)
  where jsonb_typeof(val) <> 'array'
     or jsonb_array_length(val) = 0
     or exists (
       select 1 from jsonb_array_elements_text(val) op
       where op not in ('sum', 'mean', 'min', 'max')
     );
  if bad_across is not null then
    raise exception 'Invalid across-replicate ops for: %', bad_across;
  end if;

  new_within := coalesce(set_overlay_data_table_visualization_settings.within_replicate_operations, '{}'::jsonb);
  new_across := coalesce(set_overlay_data_table_visualization_settings.across_replicate_operations, '{}'::jsonb);

  new_subject := nullif(btrim(coalesce(set_overlay_data_table_visualization_settings.subject_column, '')), '');
  if row.organism is not null and coalesce(row.organism->>'column', '') <> '' then
    if new_subject is distinct from row.organism->>'column' then
      raise exception 'subject_column must equal organism.column';
    end if;
  end if;

  select coalesce(array_agg(distinct c order by c), '{}')
    into new_details
  from unnest(coalesce(set_overlay_data_table_visualization_settings.observation_detail_columns, '{}')) as t(c)
  where c is not null and btrim(c) <> '';

  new_coverage := coalesce(set_overlay_data_table_visualization_settings.coverage_mode, 'all_surveyed');
  if new_coverage not in ('all_surveyed', 'rows_only', 'coverage_file') then
    raise exception 'Invalid coverage_mode: %', new_coverage;
  end if;

  select coalesce(array_agg(distinct c order by c), '{}')
    into new_markers
  from unnest(coalesce(set_overlay_data_table_visualization_settings.effort_marker_values, '{}')) as t(c)
  where c is not null and btrim(c) <> '';

  if set_overlay_data_table_visualization_settings.excluded_values is not null
     and jsonb_typeof(set_overlay_data_table_visualization_settings.excluded_values) is distinct from 'object' then
    raise exception 'excluded_values must be a JSON object';
  end if;
  if exists (
    select 1
    from jsonb_each(coalesce(set_overlay_data_table_visualization_settings.excluded_values, '{}'::jsonb)) as entry(key, val)
    where jsonb_typeof(val) <> 'array'
       or exists (
         select 1 from jsonb_array_elements(val) item
         where jsonb_typeof(item) <> 'string' or btrim(item #>> '{}') = ''
       )
  ) then
    raise exception 'excluded_values values must be arrays of non-empty strings';
  end if;
  select coalesce(jsonb_object_agg(key, vals), '{}'::jsonb)
    into new_excluded
  from (
    select entry.key, jsonb_agg(distinct btrim(item #>> '{}') order by btrim(item #>> '{}')) as vals
    from jsonb_each(coalesce(set_overlay_data_table_visualization_settings.excluded_values, '{}'::jsonb)) as entry(key, val)
    cross join lateral jsonb_array_elements(val) item
    where btrim(entry.key) <> ''
    group by entry.key
  ) cleaned;
  new_excluded := coalesce(new_excluded, '{}'::jsonb);

  -- The subject column is locked while something saved with this call
  -- still refers to it. Clearing those references in the same save is fine.
  if new_subject is distinct from row.subject_column then
    if row.coverage_remote is not null then
      raise exception 'subject_column cannot change while a coverage file is attached';
    end if;
    if coalesce(array_length(new_markers, 1), 0) > 0 then
      raise exception 'subject_column cannot change while nothing-seen rows are configured';
    end if;
    if row.subject_column is not null and new_excluded ? row.subject_column then
      raise exception 'subject_column cannot change while rows to ignore reference it';
    end if;
  end if;

  select string_agg(distinct marker, ', ')
    into marker_overlap
  from unnest(new_markers) marker
  where exists (
    select 1
    from jsonb_each(new_excluded) as entry(key, val)
    where val ? marker
  );
  if marker_overlap is not null then
    raise exception 'A value cannot be both a nothing-seen row and a row to ignore: %', marker_overlap;
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
  old_mode := row.calculation_mode;
  old_identifiers := row.additional_replicate_identifiers;
  old_label := row.replicate_label;
  old_label_custom := row.replicate_label_custom;
  old_within := row.within_replicate_operations;
  old_across := row.across_replicate_operations;
  old_subject := row.subject_column;
  old_details := row.observation_detail_columns;
  old_coverage := row.coverage_mode;
  old_markers := row.effort_marker_values;
  old_excluded := row.excluded_values;

  update overlay_data_tables
  set visualization_columns = coalesce(set_overlay_data_table_visualization_settings.visualization_columns, '{}'),
      visualization_ops = coalesce(set_overlay_data_table_visualization_settings.visualization_ops, '{}'),
      required_filter_columns = new_required,
      hidden_filter_columns = new_hidden,
      filter_column_labels = new_labels,
      calculation_mode = new_mode,
      additional_replicate_identifiers = new_identifiers,
      replicate_label = new_label,
      replicate_label_custom = new_label_custom,
      within_replicate_operations = new_within,
      across_replicate_operations = new_across,
      subject_column = new_subject,
      observation_detail_columns = new_details,
      coverage_mode = new_coverage,
      effort_marker_values = new_markers,
      excluded_values = new_excluded,
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
        'filterColumnLabels', old_labels,
        'calculationMode', old_mode,
        'additionalReplicateIdentifiers', old_identifiers,
        'replicateLabel', old_label,
        'replicateLabelCustom', old_label_custom,
        'withinReplicateOperations', old_within,
        'acrossReplicateOperations', old_across,
        'subjectColumn', old_subject,
        'observationDetailColumns', old_details,
        'coverageMode', old_coverage,
        'effortMarkerValues', old_markers,
        'excludedValues', old_excluded
      ),
      jsonb_build_object(
        'name', row.name,
        'version', row.version,
        'visualizationColumns', row.visualization_columns,
        'visualizationOps', row.visualization_ops,
        'requiredFilterColumns', row.required_filter_columns,
        'hiddenFilterColumns', row.hidden_filter_columns,
        'filterColumnLabels', row.filter_column_labels,
        'calculationMode', row.calculation_mode,
        'additionalReplicateIdentifiers', row.additional_replicate_identifiers,
        'replicateLabel', row.replicate_label,
        'replicateLabelCustom', row.replicate_label_custom,
        'withinReplicateOperations', row.within_replicate_operations,
        'acrossReplicateOperations', row.across_replicate_operations,
        'subjectColumn', row.subject_column,
        'observationDetailColumns', row.observation_detail_columns,
        'coverageMode', row.coverage_mode,
        'effortMarkerValues', row.effort_marker_values,
        'excludedValues', row.excluded_values
      ),
      null, null,
      jsonb_build_object('table_of_contents_item_id', row.table_of_contents_item_id, 'version', row.version)
    );
  end if;
  return row;
end;
$$;

revoke all on function public.set_overlay_data_table_visualization_settings(integer, text[], text[], text[], text[], jsonb, text, text[], text, text, jsonb, jsonb, text, text[], text, text[], jsonb) from public;
grant all on function public.set_overlay_data_table_visualization_settings(integer, text[], text[], text[], text[], jsonb, text, text[], text, text, jsonb, jsonb, text, text[], text, text[], jsonb) to seasketch_user;

-- Subject column stays the organism identity column.
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
  v_organism jsonb;
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
  v_organism := p_organism;
  if v_organism is not null then
    if v_row.subject_column is null then
      raise exception 'Choose a subject column in Display settings first';
    end if;
    if coalesce(v_organism->>'column', '') <> ''
       and v_organism->>'column' is distinct from v_row.subject_column then
      raise exception 'organism.column must equal subject_column';
    end if;
    v_organism := jsonb_set(v_organism, '{column}', to_jsonb(v_row.subject_column));
  end if;
  v_old := v_row.organism;
  if v_old is not distinct from v_organism then
    return v_row;
  end if;
  update overlay_data_tables
    set organism = v_organism, updated_at = now()
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

-- Coverage file upload. The JSON is stored beside data.parquet; the table row is not replaced.
create or replace function public.create_overlay_data_table_coverage_upload(
  table_id integer,
  filename text,
  content_type text
) returns public.overlay_data_table_uploads
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  upload overlay_data_table_uploads;
  job project_background_jobs;
  tbl overlay_data_tables;
  pid int;
  geostats jsonb;
  join_col text;
  enabled boolean;
begin
  select * into tbl
  from overlay_data_tables
  where id = table_id and deleted_at is null;
  if tbl is null then
    raise exception 'Data table not found or not active';
  end if;
  if tbl.subject_column is null then
    raise exception 'Choose a subject column in Display settings first';
  end if;
  select project_id, enable_data_tables, data_table_join_column
    into pid, enabled, join_col
  from table_of_contents_items
  where id = tbl.table_of_contents_item_id
    and is_draft = true
    and is_folder = false;
  if pid is null then
    raise exception 'Can only upload coverage for draft data tables';
  end if;
  if not session_is_admin(pid) then
    raise exception 'permission denied';
  end if;
  if not coalesce(enabled, false) then
    raise exception 'Data tables are not enabled for this layer';
  end if;
  select ds.geostats into geostats
  from table_of_contents_items toc
  inner join data_layers dl on dl.id = toc.data_layer_id
  inner join data_sources ds on ds.id = dl.data_source_id
  where toc.id = tbl.table_of_contents_item_id;
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

  insert into project_background_jobs (
    project_id, title, user_id, type, timeout_at
  ) values (
    pid,
    'Upload coverage file ' || tbl.name,
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
    replace_overlay_data_table_id,
    reprocess_of_overlay_data_table_id
  ) values (
    job.id,
    tbl.table_of_contents_item_id,
    filename,
    coalesce(nullif(btrim(content_type), ''), 'application/json'),
    jsonb_build_object(
      'kind', 'coverage',
      'joinColumn', tbl.join_column,
      'overlayJoinColumn', tbl.overlay_join_column,
      'name', tbl.name,
      'subjectColumn', tbl.subject_column,
      'detailColumns', to_jsonb(tbl.observation_detail_columns),
      'visualizationColumns', to_jsonb(tbl.visualization_columns)
    ),
    geostats,
    coalesce(join_col, tbl.overlay_join_column),
    tbl.id,
    tbl.id
  ) returning * into upload;
  return upload;
end;
$$;

comment on function public.create_overlay_data_table_coverage_upload(integer, text, text) is
  'Admin-only. Starts a coverage-file upload. The client PUTs the JSON to the presigned URL, then calls submitOverlayDataTableUpload.';
revoke all on function public.create_overlay_data_table_coverage_upload(integer, text, text) from public;
grant execute on function public.create_overlay_data_table_coverage_upload(integer, text, text) to seasketch_user;

create or replace function public.complete_overlay_data_table_coverage(
  job_id uuid,
  p_coverage_remote text
) returns public.overlay_data_tables
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  upload overlay_data_table_uploads;
  job project_background_jobs;
  row overlay_data_tables;
begin
  select * into job from project_background_jobs where id = job_id;
  if job is null or job.state not in ('queued', 'running') then
    raise exception 'Job is no longer active';
  end if;
  select * into upload from overlay_data_table_uploads where project_background_job_id = job_id;
  if upload is null or upload.reprocess_of_overlay_data_table_id is null then
    raise exception 'Coverage upload not found';
  end if;
  update overlay_data_tables
  set coverage_remote = p_coverage_remote,
      coverage_mode = 'coverage_file',
      updated_at = now()
  where id = upload.reprocess_of_overlay_data_table_id
    and deleted_at is null
  returning * into row;
  if row is null then
    raise exception 'Active data table not found';
  end if;
  update project_background_jobs
  set state = 'complete', progress = 1, progress_message = 'complete', error_message = null
  where id = job_id;
  return row;
end;
$$;

comment on function public.complete_overlay_data_table_coverage(uuid, text) is '@omit';
revoke all on function public.complete_overlay_data_table_coverage(uuid, text) from public;
grant execute on function public.complete_overlay_data_table_coverage(uuid, text) to seasketch_user;

drop function if exists public.create_overlay_data_table_reprocess(integer, jsonb, jsonb);
drop function if exists public.create_overlay_data_table_reprocess(integer, jsonb, jsonb, boolean);

create function public.create_overlay_data_table_reprocess(
  table_id integer,
  temporal_config jsonb default null,
  nodata_config jsonb default null,
  cluster_only boolean default false
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
  job_title text;
begin
  select * into tbl from overlay_data_tables where id = table_id and deleted_at is null;
  if tbl is null then
    raise exception 'Data table not found or not active';
  end if;
  select project_id, enable_data_tables, data_table_join_column
    into pid, enabled, join_col
  from table_of_contents_items
  where id = tbl.table_of_contents_item_id and is_draft = true and is_folder = false;
  if pid is null then
    raise exception 'Can only reprocess data tables on draft layers';
  end if;
  if not session_is_admin(pid) then
    raise exception 'permission denied';
  end if;
  if not coalesce(enabled, false) then
    raise exception 'Data tables are not enabled for this layer';
  end if;
  if temporal_config is not null then
    if jsonb_typeof(temporal_config) <> 'object' then
      raise exception 'temporal_config must be an object';
    end if;
    if temporal_config->'sourceColumns' is null then
      raise exception 'temporal_config.sourceColumns is required';
    end if;
  end if;
  if nodata_config is not null then
    if jsonb_typeof(nodata_config) <> 'object' then
      raise exception 'nodata_config must be an object';
    end if;
    if jsonb_typeof(nodata_config->'values') <> 'array' then
      raise exception 'nodata_config.values must be an array';
    end if;
  end if;
  if temporal_config is null and nodata_config is null and not coalesce(cluster_only, false) then
    raise exception 'temporal_config or nodata_config is required';
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
    where odtu.replace_overlay_data_table_id = tbl.id
      and pbj.state in ('queued', 'running')
  ) then
    raise exception 'There is already an active upload or reprocess for this data table';
  end if;
  if coalesce(cluster_only, false) then
    job_title := 'Reindex data table ' || tbl.name;
  elsif nodata_config is not null and temporal_config is null then
    job_title := 'Reprocess data table no-data ' || tbl.name;
  elsif temporal_config is not null and nodata_config is null then
    job_title := 'Reprocess data table temporal ' || tbl.name;
  else
    job_title := 'Reprocess data table ' || tbl.name;
  end if;
  insert into project_background_jobs (
    project_id, title, user_id, type, timeout_at
  ) values (
    pid,
    job_title,
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
    replace_overlay_data_table_id,
    reprocess_of_overlay_data_table_id,
    temporal_config,
    nodata_config
  ) values (
    job.id,
    tbl.table_of_contents_item_id,
    'reprocess-' || tbl.stable_id::text || '.parquet',
    'application/vnd.apache.parquet',
    jsonb_build_object(
      'joinColumn', tbl.join_column,
      'overlayJoinColumn', tbl.overlay_join_column,
      'name', tbl.name,
      'clusterOnly', coalesce(cluster_only, false),
      'replicateColumns', to_jsonb(tbl.additional_replicate_identifiers),
      'subjectColumn', tbl.subject_column
    ),
    geostats,
    coalesce(join_col, tbl.overlay_join_column),
    tbl.id,
    tbl.id,
    temporal_config,
    nodata_config
  ) returning * into upload;
  update project_background_jobs
  set state = 'running', progress_message = 'queued', started_at = now(),
      timeout_at = timezone('utc', now()) + interval '60 seconds'
  where id = job.id;
  perform graphile_worker.add_job(
    'processDataTableUpload',
    json_build_object('jobId', job.id),
    max_attempts := 1
  );
  return upload;
end;
$$;

comment on function public.create_overlay_data_table_reprocess(integer, jsonb, jsonb, boolean) is
  'Admin-only. Reprocess nodata and/or temporal columns, or reindex parquet clustering when cluster_only is true.';
revoke all on function public.create_overlay_data_table_reprocess(integer, jsonb, jsonb, boolean) from public;
grant execute on function public.create_overlay_data_table_reprocess(integer, jsonb, jsonb, boolean) to seasketch_user;
