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
