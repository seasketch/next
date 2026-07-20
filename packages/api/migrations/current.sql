-- Enter migration here

alter table table_of_contents_items
  add column if not exists enable_data_tables boolean not null default false,
  add column if not exists data_table_join_column text;

alter table table_of_contents_items
  drop constraint if exists table_of_contents_items_data_tables_join_column_required;

alter table table_of_contents_items
  add constraint table_of_contents_items_data_tables_join_column_required
  check (
    not enable_data_tables
    or (
      data_table_join_column is not null
      and length(trim(data_table_join_column)) > 0
    )
  );

grant select (enable_data_tables, data_table_join_column) on table_of_contents_items to anon;
grant update (enable_data_tables, data_table_join_column) on table_of_contents_items to seasketch_user;

comment on column table_of_contents_items.enable_data_tables is
  'When true, admins can attach CSV data tables linked to this layer by a canonical join column.';
comment on column table_of_contents_items.data_table_join_column is
  'Overlay attribute name used as the canonical feature ID for linked data tables. Required when enable_data_tables is true.';

create or replace function trg_copy_data_table_settings_from_draft_toc()
returns trigger
language plpgsql
as $$
begin
  if new.is_draft = false and not new.is_folder then
    select
      draft.enable_data_tables,
      draft.data_table_join_column
    into
      new.enable_data_tables,
      new.data_table_join_column
    from table_of_contents_items draft
    where
      draft.project_id = new.project_id
      and draft.stable_id = new.stable_id
      and draft.is_draft = true;
  end if;
  return new;
end;
$$;

drop trigger if exists copy_data_table_settings_from_draft_toc on table_of_contents_items;
create trigger copy_data_table_settings_from_draft_toc
  before insert on table_of_contents_items
  for each row execute function trg_copy_data_table_settings_from_draft_toc();

drop index if exists overlay_data_tables_active_name_per_toc;

create or replace function create_overlay_data_table_upload(
  toc_item_id integer,
  filename text,
  content_type text,
  processing_options jsonb default '{}'::jsonb,
  replace_overlay_data_table_id integer default null
) returns overlay_data_table_uploads
language plpgsql
security definer
as $$
declare
  upload overlay_data_table_uploads;
  job project_background_jobs;
  pid int;
  geostats jsonb;
  join_col text;
  enabled boolean;
begin
  select project_id, enable_data_tables, data_table_join_column
  into pid, enabled, join_col
  from table_of_contents_items
  where id = toc_item_id and is_draft = true and is_folder = false;
  if pid is null then
    raise exception 'Draft layer table of contents item not found';
  end if;
  if not session_is_admin(pid) then
    raise exception 'permission denied';
  end if;
  if not coalesce(enabled, false) then
    raise exception 'Data tables are not enabled for this layer';
  end if;
  if join_col is null or length(trim(join_col)) = 0 then
    raise exception 'Data table join column is not configured for this layer';
  end if;

  select ds.geostats into geostats
  from table_of_contents_items toc
  inner join data_layers dl on dl.id = toc.data_layer_id
  inner join data_sources ds on ds.id = dl.data_source_id
  where toc.id = toc_item_id;
  if geostats is null then
    raise exception 'Overlay layer has no geostats';
  end if;

  if replace_overlay_data_table_id is not null then
    if not exists (
      select 1 from overlay_data_tables
      where id = replace_overlay_data_table_id
        and table_of_contents_item_id = toc_item_id
        and deleted_at is null
    ) then
      raise exception 'Replace target data table not found or not active';
    end if;
  end if;

  insert into project_background_jobs (
    project_id,
    title,
    user_id,
    type,
    timeout_at
  ) values (
    pid,
    (case when replace_overlay_data_table_id is not null then 'Replacement data table ' else 'Data table ' end) || filename,
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
    replace_overlay_data_table_id
  ) values (
    job.id,
    toc_item_id,
    create_overlay_data_table_upload.filename,
    content_type,
    coalesce(processing_options, '{}'::jsonb),
    geostats,
    join_col,
    replace_overlay_data_table_id
  ) returning * into upload;

  return upload;
end;
$$;

grant execute on function create_overlay_data_table_upload(integer, text, text, jsonb, integer) to seasketch_user;

create or replace function fail_overlay_data_table_upload(
  job_id uuid,
  error_message text,
  error_details jsonb default null
) returns void
language plpgsql
security definer
as $$
begin
  update overlay_data_table_uploads odtu
  set error_details = coalesce(fail_overlay_data_table_upload.error_details, odtu.error_details),
      updated_at = now()
  where odtu.project_background_job_id = job_id;

  update project_background_jobs
  set
    state = 'failed',
    progress_message = case
      when fail_overlay_data_table_upload.error_message = 'Timed out' then 'timeout'
      else 'failed'
    end,
    error_message = fail_overlay_data_table_upload.error_message
  where id = job_id;
end;
$$;

revoke all on function fail_overlay_data_table_upload(uuid, text, jsonb) from public;

create or replace function submit_overlay_data_table_upload(job_id uuid)
returns project_background_jobs
language plpgsql
security definer
as $$
declare
  job project_background_jobs;
  pid int;
begin
  select project_id into pid
  from project_background_jobs
  where id = submit_overlay_data_table_upload.job_id;
  if not session_is_admin(pid) then
    raise exception 'permission denied';
  end if;
  if not exists (
    select 1 from overlay_data_table_uploads where project_background_job_id = job_id
  ) then
    raise exception 'Data table upload not found for job';
  end if;
  update project_background_jobs
  set
    state = 'running',
    progress_message = 'uploaded',
    started_at = now(),
    timeout_at = timezone('utc', now()) + interval '60 seconds'
  where id = job_id
  returning * into job;
  perform graphile_worker.add_job(
    'processDataTableUpload',
    json_build_object('jobId', job.id),
    max_attempts := 1
  );
  return job;
end;
$$;

grant execute on function submit_overlay_data_table_upload(uuid) to seasketch_user;

create or replace function table_of_contents_items_data_table_change_logs(item table_of_contents_items)
  returns setof change_logs
  language sql
  security definer
  stable
  as $$
    select * from change_logs
    where entity_type = 'overlay_data_table'
      and net_zero_changes = false
      and (meta->>'table_of_contents_item_id')::int = item.id
    order by last_at desc;
  $$;

grant execute on function table_of_contents_items_data_table_change_logs(item table_of_contents_items) to seasketch_user;

comment on function table_of_contents_items_data_table_change_logs(item table_of_contents_items) is '@simpleCollections only';

create or replace function overlay_data_table_parquet_public_url(p_remote text)
returns text
language plpgsql
stable
as $$
declare
  base text;
  key text;
begin
  if p_remote is null or length(trim(p_remote)) = 0 then
    return null;
  end if;

  -- Prefer an optional session override (tests); otherwise the public uploads host.
  base := coalesce(
    nullif(trim(current_setting('seasketch.uploads_base_url', true)), ''),
    'https://uploads.seasketch.org'
  );

  key := regexp_replace(p_remote, '^r2://[^/]+/', '');
  if key is null or length(trim(key)) = 0 then
    return null;
  end if;

  return rtrim(base, '/') || '/' || key;
end;
$$;

grant execute on function overlay_data_table_parquet_public_url(text) to seasketch_user;

-- Replacement uploads complete in the background worker without a session.
-- Use job.user_id for the changelog editor, same as the initial upload path.
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
    column_stats_remote
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
    p_column_stats_remote
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

revoke all on function complete_overlay_data_table_upload(uuid, text, text, text, integer, text, text) from public;

alter table overlay_data_tables add column if not exists visualization_columns text[] default '{}';
comment on column overlay_data_tables.visualization_columns is
  'Columns that may/should be used for creating thematic maps. For example `count` or `density`';

alter table overlay_data_tables add column if not exists visualization_ops text[] default '{mean}';
comment on column overlay_data_tables.visualization_ops is
  'Operations that may/should be used for creating thematic maps. For example `mean` or `max`';

do $$ begin
  if not exists (
    select 1 from pg_enum e
    inner join pg_type t on t.oid = e.enumtypid
    where t.typname = 'change_log_field_group' and e.enumlabel = 'data_table:visualization_settings_updated'
  ) then
    alter type change_log_field_group add value 'data_table:visualization_settings_updated';
  end if;
end $$;

create or replace function set_overlay_data_table_visualization_settings(
  table_id integer,
  visualization_columns text[],
  visualization_ops text[]
)
returns overlay_data_tables
language plpgsql
security definer
as $$
declare
  row overlay_data_tables;
  old_columns text[];
  old_ops text[];
  editor_id int;
  invalid_ops text[];
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

  old_columns := row.visualization_columns;
  old_ops := row.visualization_ops;

  update overlay_data_tables
  set visualization_columns = coalesce(set_overlay_data_table_visualization_settings.visualization_columns, '{}'),
      visualization_ops = coalesce(set_overlay_data_table_visualization_settings.visualization_ops, '{}'),
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
      jsonb_build_object('visualizationColumns', old_columns, 'visualizationOps', old_ops),
      jsonb_build_object('visualizationColumns', row.visualization_columns, 'visualizationOps', row.visualization_ops),
      null, null,
      jsonb_build_object('table_of_contents_item_id', row.table_of_contents_item_id, 'version', row.version)
    );
  end if;
  return row;
end;
$$;

grant execute on function set_overlay_data_table_visualization_settings(integer, text[], text[]) to seasketch_user;



