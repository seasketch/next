--! Previous: sha1:09532ee08a6abd672c0fbed235e5b2c3d6e8fdcf
--! Hash: sha1:6bb7e77902519cb8af23ff3e71d98c944520112a

-- Enter migration here
alter type data_upload_output_type add value if not exists 'CSV';

alter table data_upload_tasks add column if not exists processing_options jsonb;

comment on column data_upload_tasks.processing_options is 'Format-specific processing instructions supplied by the client at upload time (e.g. column mapping and CRS for delimited text uploads). Consumed by the spatial-uploads-handler.';

drop function if exists create_data_upload(text, integer, text, integer);
CREATE OR REPLACE FUNCTION public.create_data_upload(filename text, project_id integer, content_type text, replace_table_of_contents_item_id integer, processing_options jsonb default null) RETURNS public.data_upload_tasks
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      upload data_upload_tasks;
      used bigint;
      quota bigint;
      job project_background_jobs;
    begin
      if session_is_admin(project_id) then
        select projects_data_hosting_quota_used(projects.*), projects_data_hosting_quota(projects.*) into used, quota from projects where id = project_id;
        if replace_table_of_contents_item_id is not null and (select exists(
          select 
            data_upload_tasks.id 
          from 
            data_upload_tasks 
          inner join 
            project_background_jobs 
          on 
            data_upload_tasks.project_background_job_id = project_background_jobs.id 
          where 
            data_upload_tasks.replace_table_of_contents_item_id is not null and 
            project_background_jobs.state in ('queued', 'running') and
            data_upload_tasks.replace_table_of_contents_item_id = create_data_upload.replace_table_of_contents_item_id
        )) then
          raise exception 'There is already an active upload task for this layer';
        end if;
        if quota - used > 0 then
          insert into project_background_jobs (
            project_id, 
            title, 
            user_id, 
            type,
            timeout_at
          ) values (
            project_id, 
            (
              case when replace_table_of_contents_item_id is not null then 'Replacement upload ' else '' end
            ) || filename, 
            nullif(current_setting('session.user_id', TRUE), '')::integer, 
            'data_upload',
            timezone('utc'::text, now()) + interval '15 minutes'
          )
          returning * into job;
          insert into data_upload_tasks(
            filename, 
            content_type, 
            project_background_job_id,
            replace_table_of_contents_item_id,
            processing_options
          ) values (
            create_data_upload.filename, 
            create_data_upload.content_type, 
            job.id,
            create_data_upload.replace_table_of_contents_item_id,
            create_data_upload.processing_options
          ) returning * into upload;
          return upload;
        else
          raise exception 'data hosting quota exceeded';
        end if;
      else
        raise exception 'permission denied';
      end if;
    end;
  $$;

grant execute on function create_data_upload to seasketch_user;

drop table if exists overlay_data_table_uploads cascade;
drop table if exists overlay_data_tables cascade;

create table if not exists overlay_data_tables (
  id integer generated always as identity primary key,
  table_of_contents_item_id integer not null references table_of_contents_items(id) on delete cascade,
  project_id integer not null references projects(id) on delete cascade,
  name text not null,
  join_column text not null,
  overlay_join_column text not null,
  row_count integer not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by integer not null references users(id),
  deleted_at timestamptz,
  replaced_by_id integer references overlay_data_tables(id),
  version integer not null default 1,
  parquet_remote text not null,
  column_stats_remote text not null
);


create table if not exists overlay_data_table_uploads (
  id uuid primary key default uuid_generate_v4(),
  project_background_job_id uuid not null references project_background_jobs(id) on delete cascade,
  table_of_contents_item_id integer not null references table_of_contents_items(id) on delete cascade,
  filename text not null,
  content_type text not null,
  processing_options jsonb not null default '{}',
  overlay_geostats jsonb not null,
  overlay_join_column text,
  replace_overlay_data_table_id integer references overlay_data_tables(id),
  error_details jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint overlay_data_table_uploads_unique_project_background_job unique (project_background_job_id)
);

-- Indexes and constraints
create unique index if not exists overlay_data_tables_active_name_per_toc
  on overlay_data_tables (table_of_contents_item_id, name)
  where deleted_at is null;

create index if not exists overlay_data_tables_toc_active_idx
  on overlay_data_tables (table_of_contents_item_id)
  where deleted_at is null;

create index if not exists overlay_data_tables_project_idx
  on overlay_data_tables (project_id);

do $$ begin
  alter table overlay_data_tables
    add constraint overlay_data_tables_version_positive check (version > 0);
exception
  when duplicate_object then null;
end $$;

alter type project_background_job_type add value if not exists 'data_table_upload';

-- Changelog field groups
do $$ begin
  if not exists (
    select 1 from pg_enum e
    inner join pg_type t on t.oid = e.enumtypid
    where t.typname = 'change_log_field_group' and e.enumlabel = 'data_table:created'
  ) then
    alter type change_log_field_group add value 'data_table:created';
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_enum e
    inner join pg_type t on t.oid = e.enumtypid
    where t.typname = 'change_log_field_group' and e.enumlabel = 'data_table:deleted'
  ) then
    alter type change_log_field_group add value 'data_table:deleted';
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_enum e
    inner join pg_type t on t.oid = e.enumtypid
    where t.typname = 'change_log_field_group' and e.enumlabel = 'data_table:renamed'
  ) then
    alter type change_log_field_group add value 'data_table:renamed';
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_enum e
    inner join pg_type t on t.oid = e.enumtypid
    where t.typname = 'change_log_field_group' and e.enumlabel = 'data_table:replaced'
  ) then
    alter type change_log_field_group add value 'data_table:replaced';
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_enum e
    inner join pg_type t on t.oid = e.enumtypid
    where t.typname = 'change_log_field_group' and e.enumlabel = 'data_table:rollback'
  ) then
    alter type change_log_field_group add value 'data_table:rollback';
  end if;
end $$;

comment on table overlay_data_tables is '@omit delete';
comment on table overlay_data_table_uploads is '@omit delete';

alter table overlay_data_tables enable row level security;
alter table overlay_data_table_uploads enable row level security;

grant select on overlay_data_tables to anon;
grant select on overlay_data_tables to seasketch_user;
grant select on overlay_data_table_uploads to seasketch_user;

create or replace function public.overlay_data_table_linked_toc_is_draft(
  toc_item_id integer,
  pid integer
) returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from table_of_contents_items
    where id = toc_item_id
      and project_id = pid
      and is_draft = true
  );
$$;

grant execute on function public.overlay_data_table_linked_toc_is_draft(integer, integer) to seasketch_user;

drop policy if exists overlay_data_tables_select on overlay_data_tables;
create policy overlay_data_tables_select on overlay_data_tables
  for select using (
    session_is_admin(project_id)
    or (
      exists (
        select 1 from table_of_contents_items toc
        where toc.id = overlay_data_tables.table_of_contents_item_id
          and toc.is_draft = false
          and _session_on_toc_item_acl(toc.path)
      )
    )
  );

drop policy if exists overlay_data_tables_insert on overlay_data_tables;
create policy overlay_data_tables_insert on overlay_data_tables
  for insert with check (
    session_is_admin(project_id)
    and overlay_data_table_linked_toc_is_draft(
      table_of_contents_item_id,
      project_id
    )
  );

drop policy if exists overlay_data_tables_update on overlay_data_tables;
create policy overlay_data_tables_update on overlay_data_tables
  for update using (
    session_is_admin(project_id)
    and overlay_data_table_linked_toc_is_draft(
      table_of_contents_item_id,
      project_id
    )
  );

drop policy if exists overlay_data_tables_delete on overlay_data_tables;
create policy overlay_data_tables_delete on overlay_data_tables
  for delete using (
    session_is_admin(project_id)
    and overlay_data_table_linked_toc_is_draft(
      table_of_contents_item_id,
      project_id
    )
  );

drop policy if exists overlay_data_table_uploads_select on overlay_data_table_uploads;
create policy overlay_data_table_uploads_select on overlay_data_table_uploads
  for select using (
    session_is_admin((
      select project_id from table_of_contents_items where id = overlay_data_table_uploads.table_of_contents_item_id
    ))
  );

drop policy if exists overlay_data_table_uploads_insert on overlay_data_table_uploads;
create policy overlay_data_table_uploads_insert on overlay_data_table_uploads
  for insert with check (
    session_is_admin((
      select project_id from table_of_contents_items where id = overlay_data_table_uploads.table_of_contents_item_id
    ))
  );

create or replace function overlay_data_tables_draft_toc_has_changes()
returns trigger
language plpgsql
security definer
as $$
declare
  pid int;
  toc_is_draft boolean;
begin
  if tg_op = 'DELETE' then
    select project_id, table_of_contents_items.is_draft into pid, toc_is_draft
    from table_of_contents_items where id = old.table_of_contents_item_id;
  else
    select project_id, table_of_contents_items.is_draft into pid, toc_is_draft
    from table_of_contents_items where id = new.table_of_contents_item_id;
  end if;
  if toc_is_draft then
    update projects set draft_table_of_contents_has_changes = true where id = pid;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists overlay_data_tables_draft_toc_has_changes on overlay_data_tables;
create trigger overlay_data_tables_draft_toc_has_changes
  after insert or update or delete on overlay_data_tables
  for each row execute function overlay_data_tables_draft_toc_has_changes();

create or replace function trg_publish_overlay_data_tables_for_toc_item()
returns trigger
language plpgsql
security definer
as $$
declare
  draft_toc_id int;
begin
  if new.is_draft = false and new.is_folder = false then
    select id into draft_toc_id
    from table_of_contents_items
    where stable_id = new.stable_id
      and project_id = new.project_id
      and table_of_contents_items.is_draft = true
    limit 1;
    if draft_toc_id is not null then
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
      )
      select
        new.id,
        odt.project_id,
        odt.name,
        odt.join_column,
        odt.overlay_join_column,
        odt.row_count,
        odt.created_by,
        odt.version,
        odt.parquet_remote,
        odt.column_stats_remote
      from overlay_data_tables odt
      where odt.table_of_contents_item_id = draft_toc_id
        and odt.deleted_at is null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists publish_overlay_data_tables_for_toc_item on table_of_contents_items;
create trigger publish_overlay_data_tables_for_toc_item
  after insert on table_of_contents_items
  for each row execute function trg_publish_overlay_data_tables_for_toc_item();

create or replace function table_of_contents_items_overlay_data_tables(item public.table_of_contents_items)
returns setof overlay_data_tables
language sql
stable
security definer
as $$
  select odt.*
  from overlay_data_tables odt
  where odt.table_of_contents_item_id = item.id
    and odt.deleted_at is null
    and (
      session_is_admin(item.project_id)
      or (item.is_draft = false and _session_on_toc_item_acl(item.path))
    );
$$;

comment on function table_of_contents_items_overlay_data_tables(public.table_of_contents_items) is '@simpleCollections only';

grant execute on function table_of_contents_items_overlay_data_tables(public.table_of_contents_items) to seasketch_user;

create or replace function public.table_of_contents_items_project_background_jobs(item public.table_of_contents_items)
returns setof public.project_background_jobs
language sql
stable
security definer
as $$
  select *
  from project_background_jobs
  where session_is_admin(item.project_id)
    and (
      id = (
        select project_background_job_id
        from esri_feature_layer_conversion_tasks
        where table_of_contents_item_id = item.id
        limit 1
      )
      or id in (
        select odtu.project_background_job_id
        from overlay_data_table_uploads odtu
        where odtu.table_of_contents_item_id = item.id
      )
    );
$$;

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
begin
  select project_id into pid
  from table_of_contents_items
  where id = toc_item_id and is_draft = true and is_folder = false;
  if pid is null then
    raise exception 'Draft layer table of contents item not found';
  end if;
  if not session_is_admin(pid) then
    raise exception 'permission denied';
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

  if exists (
    select 1
    from overlay_data_table_uploads odtu
    inner join project_background_jobs pbj on pbj.id = odtu.project_background_job_id
    where odtu.table_of_contents_item_id = toc_item_id
      and odtu.filename = create_overlay_data_table_upload.filename
      and pbj.state in ('queued', 'running')
  ) then
    raise exception 'There is already an active data table upload for this file';
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
    processing_options->>'overlayJoinColumn',
    replace_overlay_data_table_id
  ) returning * into upload;

  return upload;
end;
$$;

grant execute on function create_overlay_data_table_upload(integer, text, text, jsonb, integer) to seasketch_user;

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
  set state = 'running', progress_message = 'uploaded', started_at = now()
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

create or replace function rename_overlay_data_table(table_id integer, new_name text)
returns overlay_data_tables
language plpgsql
security definer
as $$
declare
  row overlay_data_tables;
  old_name text;
  editor_id int;
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
    raise exception 'Can only rename data tables on draft layers';
  end if;
  old_name := row.name;
  update overlay_data_tables
  set name = new_name, updated_at = now()
  where id = table_id
  returning * into row;

  editor_id := nullif(current_setting('session.user_id', true), '')::int;
  if editor_id is not null then
    perform record_changelog(
      row.project_id,
      editor_id,
      'overlay_data_table',
      row.id,
      'data_table:renamed'::change_log_field_group,
      jsonb_build_object('name', old_name),
      jsonb_build_object('name', new_name),
      null, null,
      jsonb_build_object('table_of_contents_item_id', row.table_of_contents_item_id, 'version', row.version)
    );
  end if;
  return row;
end;
$$;

grant execute on function rename_overlay_data_table(integer, text) to seasketch_user;

create or replace function soft_delete_overlay_data_table(table_id integer)
returns overlay_data_tables
language plpgsql
security definer
as $$
declare
  row overlay_data_tables;
  editor_id int;
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
    raise exception 'Can only delete data tables on draft layers';
  end if;

  update overlay_data_tables
  set deleted_at = now(), updated_at = now()
  where id = table_id
  returning * into row;

  editor_id := nullif(current_setting('session.user_id', true), '')::int;
  if editor_id is not null then
    perform record_changelog(
      row.project_id,
      editor_id,
      'overlay_data_table',
      row.id,
      'data_table:deleted'::change_log_field_group,
      jsonb_build_object('name', row.name, 'version', row.version),
      '{}'::jsonb,
      null, null,
      jsonb_build_object('table_of_contents_item_id', row.table_of_contents_item_id)
    );
  end if;
  return row;
end;
$$;

grant execute on function soft_delete_overlay_data_table(integer) to seasketch_user;

create or replace function rollback_overlay_data_table_version(table_id integer)
returns overlay_data_tables
language plpgsql
security definer
as $$
declare
  target overlay_data_tables;
  successor overlay_data_tables;
  editor_id int;
begin
  select * into target from overlay_data_tables where id = table_id;
  if target is null then
    raise exception 'Data table not found';
  end if;
  if target.deleted_at is null then
    select * into target
    from overlay_data_tables
    where replaced_by_id = table_id
      and deleted_at is not null
    order by version desc
    limit 1;
    if target is null then
      raise exception 'No previous version found to rollback to';
    end if;
  end if;
  if not session_is_admin(target.project_id) then
    raise exception 'permission denied';
  end if;
  if not exists (
    select 1 from table_of_contents_items
    where id = target.table_of_contents_item_id and is_draft = true
  ) then
    raise exception 'Can only rollback data tables on draft layers';
  end if;

  select * into successor
  from overlay_data_tables
  where id = target.replaced_by_id
    and deleted_at is null
  limit 1;
  if successor is null then
    raise exception 'No successor version found to rollback from';
  end if;

  delete from overlay_data_tables where id = successor.id;

  update overlay_data_tables
  set deleted_at = null, replaced_by_id = null, updated_at = now()
  where id = target.id
  returning * into target;

  editor_id := nullif(current_setting('session.user_id', true), '')::int;
  if editor_id is not null then
    perform record_changelog(
      target.project_id,
      editor_id,
      'overlay_data_table',
      target.id,
      'data_table:rollback'::change_log_field_group,
      jsonb_build_object('removed_version', successor.version),
      jsonb_build_object('name', target.name, 'version', target.version),
      null, null,
      jsonb_build_object(
        'table_of_contents_item_id', target.table_of_contents_item_id,
        'removed_id', successor.id
      )
    );
  end if;
  return target;
end;
$$;

grant execute on function rollback_overlay_data_table_version(integer) to seasketch_user;

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

    editor_id := nullif(current_setting('session.user_id', true), '')::int;
    if editor_id is not null then
      perform record_changelog(
        new_row.project_id,
        editor_id,
        'overlay_data_table',
        new_row.id,
        'data_table:replaced'::change_log_field_group,
        jsonb_build_object('name', old_row.name, 'version', old_row.version, 'id', old_row.id),
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

create or replace function fail_overlay_data_table_upload(
  job_id uuid,
  error_message text,
  error_details jsonb default null
) returns void
language plpgsql
security definer
as $$
begin
  update overlay_data_table_uploads
  set error_details = coalesce(fail_overlay_data_table_upload.error_details, error_details),
      updated_at = now()
  where project_background_job_id = job_id;

  update project_background_jobs
  set state = 'failed', progress_message = 'failed', error_message = fail_overlay_data_table_upload.error_message
  where id = job_id;
end;
$$;

revoke all on function fail_overlay_data_table_upload(uuid, text, jsonb) from public;
