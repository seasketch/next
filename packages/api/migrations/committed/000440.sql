--! Previous: sha1:e1ab02ace2fa760c02b7cd359117344b18739748
--! Hash: sha1:7c0f7e63ef65b27bf6e05fb0fda4115f4bf4aefe

-- Data table temporal reprocess: ephemeral config lives on the job/upload
-- row, not on overlay_data_tables. TemporalInfo is written to the new
-- version only when complete_overlay_data_table_upload succeeds.

-- Distinct from data_table:replaced (new CSV / source file). In-place
-- temporal saves and parquet reprocess share this field group.
do $$ begin
  if not exists (
    select 1 from pg_enum e
    inner join pg_type t on t.oid = e.enumtypid
    where t.typname = 'change_log_field_group' and e.enumlabel = 'data_table:temporal'
  ) then
    alter type change_log_field_group add value 'data_table:temporal';
  end if;
end $$;

alter table public.overlay_data_table_uploads
  add column if not exists temporal_config jsonb;

alter table public.overlay_data_table_uploads
  add column if not exists reprocess_of_overlay_data_table_id integer
    references public.overlay_data_tables(id);

comment on column public.overlay_data_table_uploads.temporal_config is
  'Ephemeral DataTableTemporalConfig for a reprocess (or CSV replace) job. Not copied onto overlay_data_tables until the job completes successfully.';

comment on column public.overlay_data_table_uploads.reprocess_of_overlay_data_table_id is
  'When set, the processor reads the current parquet for this table instead of a newly uploaded CSV.';

create or replace function public.create_overlay_data_table_reprocess(
  table_id integer,
  temporal_config jsonb
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
    raise exception 'Can only reprocess data tables on draft layers';
  end if;
  if not session_is_admin(pid) then
    raise exception 'permission denied';
  end if;
  if not coalesce(enabled, false) then
    raise exception 'Data tables are not enabled for this layer';
  end if;
  if temporal_config is null or jsonb_typeof(temporal_config) <> 'object' then
    raise exception 'temporal_config is required';
  end if;
  if temporal_config->'sourceColumns' is null then
    raise exception 'temporal_config.sourceColumns is required';
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

  insert into project_background_jobs (
    project_id,
    title,
    user_id,
    type,
    timeout_at
  ) values (
    pid,
    'Reprocess data table temporal ' || tbl.name,
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
    temporal_config
  ) values (
    job.id,
    tbl.table_of_contents_item_id,
    'reprocess-' || tbl.stable_id::text || '.parquet',
    'application/vnd.apache.parquet',
    jsonb_build_object(
      'joinColumn', tbl.join_column,
      'overlayJoinColumn', tbl.overlay_join_column,
      'name', tbl.name
    ),
    geostats,
    coalesce(join_col, tbl.overlay_join_column),
    tbl.id,
    tbl.id,
    temporal_config
  ) returning * into upload;

  update project_background_jobs
  set
    state = 'running',
    progress_message = 'queued',
    started_at = now(),
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

comment on function public.create_overlay_data_table_reprocess(integer, jsonb) is
  'Admin-only. Starts a draft reprocess job that derives _when_* columns from the current parquet using an ephemeral temporal_config. Does not write overlay_data_tables.temporal until the job succeeds.';

revoke all on function public.create_overlay_data_table_reprocess(integer, jsonb) from public;
grant execute on function public.create_overlay_data_table_reprocess(integer, jsonb) to seasketch_user;

drop function if exists public.complete_overlay_data_table_upload(uuid, text, text, text, integer, text, text);
drop function if exists public.complete_overlay_data_table_upload(uuid, text, text, text, integer, text, text, jsonb);

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

create or replace function public.update_overlay_data_table_temporal(
  p_overlay_data_table_id integer,
  p_temporal jsonb
) returns public.overlay_data_tables
language plpgsql
security definer
set search_path to public, pg_temp
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
    raise exception 'Can only update temporal coverage on draft data tables';
  end if;
  v_old := v_row.temporal;
  if v_old is not distinct from p_temporal then
    return v_row;
  end if;
  update overlay_data_tables
    set temporal = p_temporal
    where id = p_overlay_data_table_id
    returning * into v_row;
  v_editor := nullif(current_setting('session.user_id', true), '')::int;
  if v_editor is not null then
    perform record_changelog(
      v_row.project_id,
      v_editor,
      'overlay_data_table',
      v_row.id,
      'data_table:temporal'::change_log_field_group,
      jsonb_build_object(
        'name', v_row.name,
        'version', v_row.version,
        'id', v_row.id,
        'temporal', v_old
      ),
      jsonb_build_object(
        'name', v_row.name,
        'version', v_row.version,
        'id', v_row.id,
        'temporal', v_row.temporal
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

comment on function public.update_overlay_data_table_temporal(integer, jsonb) is
  '@omit';
revoke all on function public.update_overlay_data_table_temporal(integer, jsonb) from public;
grant execute on function public.update_overlay_data_table_temporal(integer, jsonb) to seasketch_user;
