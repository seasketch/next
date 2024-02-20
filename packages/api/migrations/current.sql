-- Enter migration here
alter table data_sources add column if not exists uploaded_by integer references users(id) on delete set null;

update data_sources set uploaded_by = (
  select user_id from data_upload_tasks where id = data_sources.upload_task_id
);

CREATE OR REPLACE FUNCTION public.before_insert_or_update_table_of_contents_items_trigger() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  begin
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
    if old.is_draft = false then
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

drop table if exists project_background_jobs cascade;
drop type if exists project_background_job_type;
drop type if exists project_background_job_state;
create type project_background_job_type as enum (
  'data_upload',
  'arcgis_import',
  'consolidate_data_sources'
);

create type project_background_job_state as enum (
  'queued',
  'running',
  'complete',
  'failed'
);

create table project_background_jobs (
  id uuid DEFAULT public.uuid_generate_v4() NOT NULL primary key,
  project_id integer not null references projects(id) on delete cascade,
  title text not null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  started_at timestamp with time zone,
  user_id integer not null references users(id) on delete cascade,
  progress numeric CHECK (progress <= 1.0 AND progress >= 0.0),
  progress_message text not null default 'queued',
  error_message text,
  state project_background_job_state not null default 'queued',
  -- defaults to timing out after 3 minutes
  timeout_at timestamp with time zone not null default timezone('utc'::text, now()) + interval '3 minutes',
  type project_background_job_type not null default 'data_upload'
);

grant select on project_background_jobs to seasketch_user;
grant select on data_upload_tasks to seasketch_user;

alter table project_background_jobs enable row level security;

create policy project_background_jobs_select on project_background_jobs for select using (session_is_admin(project_id));

create index on project_background_jobs (project_id, state);

comment on table project_background_jobs is '@simpleCollections only';

delete from data_upload_tasks;
alter table data_upload_tasks drop column if exists project_background_job_id;
alter table data_upload_tasks add column if not exists project_background_job_id uuid not null references project_background_jobs(id) on delete cascade;

create or replace function data_upload_tasks_job(task data_upload_tasks)
  returns project_background_jobs
  language sql
  stable
  as $$
    select * from project_background_jobs where id = task.project_background_job_id;
  $$;

grant execute on function data_upload_tasks_job(data_upload_tasks) to seasketch_user;

create or replace function project_background_jobs_data_upload_task(job project_background_jobs)
  returns data_upload_tasks
  language sql
  stable
  as $$
    select * from data_upload_tasks where project_background_job_id = job.id limit 1;
  $$;

grant execute on function project_background_jobs_data_upload_task(project_background_jobs) to seasketch_user;

drop policy if exists data_upload_tasks_select on data_upload_tasks;
drop trigger if exists trigger_data_upload_ready on data_upload_tasks;
drop function if exists create_upload_task_job;

alter table data_upload_tasks drop column if exists progress;
alter table data_upload_tasks drop column if exists started_at;
alter table data_upload_tasks drop column if exists error_message;
alter table data_upload_tasks drop column if exists user_id;
alter table data_upload_tasks drop column if exists project_id;
alter table data_upload_tasks drop column if exists state;

drop function if exists submit_data_upload;
drop function if exists after_data_upload_task_insert_or_update_notify_subscriptions cascade;

CREATE OR REPLACE FUNCTION public.submit_data_upload(id uuid) RETURNS public.project_background_jobs
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      job project_background_jobs;
      pid integer;
    begin
      select 
        project_id 
      from 
        project_background_jobs 
      where 
        project_background_jobs.id = project_background_jobs.id 
      into pid;
      if session_is_admin(pid) then
        update 
          project_background_jobs 
        set 
          state = 'running', 
          progress_message = 'uploaded' 
        where 
          project_background_jobs.id = submit_data_upload.id 
        returning * into job;
        perform graphile_worker.add_job(
          'processDataUpload', 
          json_build_object('jobId', job.id), 
          max_attempts := 1
        );
        return job;
      else
        raise exception 'permission denied';
      end if;
    end;
  $$;

grant execute on function submit_data_upload(uuid) to seasketch_user;

drop function if exists cancel_data_upload;

CREATE OR REPLACE FUNCTION public.cancel_background_job(project_id integer, job_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    begin
      if session_is_admin(project_id) then
        delete from data_upload_tasks where project_background_job_id = job_id;
        delete from project_background_jobs where id = job_id;
      else
        raise exception 'permission denied';
      end if;
    end;
  $$;

grant execute on function cancel_background_job to seasketch_user;

create policy data_upload_tasks_select on data_upload_tasks for select using (session_is_admin((select project_id from project_background_jobs where project_background_jobs.id = data_upload_tasks.project_background_job_id)));

drop trigger if exists before_insert_or_update_data_upload_tasks_trigger on data_upload_tasks;
-- create a trigger on data_upload_tasks to create a related project_background_job before insert
create or replace function before_insert_or_update_data_upload_tasks_trigger()  returns trigger
    language plpgsql
    as $$
  declare
    job project_background_jobs;
  begin
    if new.project_background_job_id is null then
    insert into project_background_jobs (project_id, title, user_id, type) values (new.project_id, new.filename, new.user_id, 'data_upload') returning * into job;
      new.project_background_job_id = job.id;
    end if;
    return new;
  end;
  $$;

create trigger before_insert_or_update_data_upload_tasks_trigger before insert or update on data_upload_tasks for each row execute function before_insert_or_update_data_upload_tasks_trigger();

create index on data_upload_tasks (project_background_job_id);

comment on table project_background_jobs is '@simpleCollections only';

CREATE OR REPLACE FUNCTION public.create_data_upload(filename text, project_id integer, content_type text) RETURNS public.data_upload_tasks
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
        if quota - used > 0 then
          insert into project_background_jobs (
            project_id, 
            title, 
            user_id, 
            type,
            timeout_at
          ) values (
            project_id, 
            filename, 
            nullif(current_setting('session.user_id', TRUE), '')::integer, 
            'data_upload',
            timezone('utc'::text, now()) + interval '15 minutes'
          )
          returning * into job;
          insert into data_upload_tasks(
            filename, 
            content_type, 
            project_background_job_id
          ) values (
            create_data_upload.filename, 
            create_data_upload.content_type, 
            job.id
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


drop trigger if exists project_background_job_notify_subscriptions on project_background_jobs;

CREATE OR REPLACE FUNCTION public.after_project_background_jobs_insert_or_update_notify_subscriptions() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  DECLARE
    slug text;
    event_topic text;
  BEGIN
  select projects.slug into slug from projects where id = NEW.project_id;
  select concat('graphql:project:', slug, ':projectBackgroundJobs') into event_topic;
  if OLD is null then
    perform pg_notify(event_topic, json_build_object('id', NEW.id, 'projectId', NEW.project_id, 'previousState', null)::text);
  else
    perform pg_notify(event_topic, json_build_object('id', NEW.id, 'projectId', NEW.project_id, 'previousState', OLD.state)::text);
  end if;
  return NEW;
  END;
$$;

CREATE TRIGGER project_background_job_notify_subscriptions AFTER INSERT OR UPDATE ON public.project_background_jobs FOR EACH ROW EXECUTE FUNCTION public.after_project_background_jobs_insert_or_update_notify_subscriptions();


Drop function if exists dismiss_failed_upload;
drop function if exists dismiss_failed_job;
CREATE OR REPLACE FUNCTION public.dismiss_failed_job(id uuid) RETURNS public.project_background_jobs
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      job project_background_jobs;
    begin
      if session_is_admin((select project_id from project_background_jobs where project_background_jobs.id = dismiss_failed_job.id)) then
        delete from data_upload_tasks where project_background_job_id = dismiss_failed_job.id;
        delete from project_background_jobs where project_background_jobs.id = dismiss_failed_job.id returning * into job;
        return job;
      else
        raise exception 'permission denied';
      end if;
    end;
  $$;

grant execute on function dismiss_failed_job(uuid) to seasketch_user;

CREATE OR REPLACE FUNCTION public.data_sources_uploaded_by(data_source public.data_sources) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
  declare
    author text;
  begin
    if session_is_admin(data_source.project_id) then
      if data_source.uploaded_by is null then
        return null;
      else
        select coalesce(fullname, nickname, email) into author from user_profiles where user_id = data_source.uploaded_by;
        if author is null then
          select canonical_email into author from users where id = data_source.uploaded_by;
        end if;
        return author;
      end if;
    else
      raise exception 'Permission denied';
    end if;
  end
  $$;


COMMENT ON COLUMN "public"."data_sources"."uploaded_by" IS E'@omit';