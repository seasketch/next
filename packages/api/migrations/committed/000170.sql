--! Previous: sha1:731e15baf31853c47519464eef9fc33e25aa8480
--! Hash: sha1:729f58c211f55507246713f24b16551f240ed43a

-- Enter migration here

alter table data_upload_tasks add column if not exists user_id int not null references users(id);

drop function if exists projects_active_data_uploads;
create or replace function projects_active_data_uploads(p projects)
  returns setof data_upload_tasks
  security definer
  language sql
  stable
  as $$
    select 
      * 
    from 
      data_upload_tasks 
    where 
      session_is_admin(p.id) and
      project_id = p.id and
      (
        (state = 'complete' and created_at > now() - interval '1 hour')
        or
        (state = 'failed' and created_at > now() - interval '3 days')
        or
        (state != 'failed' and state != 'complete' and state != 'failed_dismissed' and (state != 'awaiting_upload' or user_id = nullif(current_setting('session.user_id', TRUE), '')::integer))
      )
  $$;

grant execute on function projects_active_data_uploads to seasketch_user;

comment on function projects_active_data_uploads is '@simpleCollections only';


create or replace function create_data_upload(filename text, project_id int, content_type text)
  returns data_upload_tasks
  language plpgsql
  security definer
  as $$
    declare
      upload data_upload_tasks;
      used int;
      quota int;
    begin
      if session_is_admin(project_id) then
        select projects_data_hosting_quota_used(projects.*), projects_data_hosting_quota(projects.*) into used, quota from projects where id = project_id;
        if quota - used > 0 then
          insert into data_upload_tasks(project_id, filename, content_type, user_id) values (create_data_upload.project_id, create_data_upload.filename, create_data_upload.content_type, nullif(current_setting('session.user_id', TRUE), '')::integer) returning * into upload;
          return upload;
        else
          raise exception 'data hosting quota exceeded';
        end if;
      else
        raise exception 'permission denied';
      end if;
    end;
  $$;

create or replace function data_sources_uploaded_by(data_source data_sources)
  returns text
  language plpgsql
  stable
  security definer
  as $$
  declare
    uid int;
    author text;
  begin
    if session_is_admin(data_source.project_id) then
      select user_id into uid from data_upload_tasks where id = data_source.upload_task_id;
      if uid is null then
        return null;
      else
        select coalesce(fullname, nickname, email) into author from user_profiles where user_id = uid;
        if author is null then
          select canonical_email into author from users where id = uid;
        end if;
        return author;
      end if;
    else
      raise exception 'Permission denied';
    end if;
  end
  $$;

grant execute on function data_sources_uploaded_by to seasketch_user;

create or replace function fail_data_upload(id uuid, msg text)
  returns data_upload_tasks
  security definer
  language sql
  as $$
    update data_upload_tasks set state = 'failed', error_message = msg where id = fail_data_upload.id and session_is_admin(project_id) returning *;
  $$;

grant execute on function fail_data_upload to seasketch_user;

create or replace function data_upload_tasks_layers(upload data_upload_tasks)
  returns setof data_layers
  security definer
  language sql
  stable
  as $$
    select * from data_layers where data_source_id in ((select id from data_sources where upload_task_id = upload.id));
  $$;


grant execute on function data_upload_tasks_layers to seasketch_user;

comment on function data_upload_tasks_layers is '@simpleCollections only';

create or replace function cancel_data_upload(project_id int, upload_id uuid)
  returns void
  language plpgsql
  security definer
  as $$
    begin
      if session_is_admin(project_id) then
        delete from data_upload_tasks where id = upload_id and state = 'awaiting_upload';
      else
        raise exception 'permission denied';
      end if;
    end;
  $$;

grant execute on function cancel_data_upload to seasketch_user;

alter table projects add column if not exists data_hosting_quota int not null default 524288000;
comment on column projects.data_hosting_quota is '@omit';

CREATE OR REPLACE FUNCTION public.projects_data_hosting_quota(p public.projects) RETURNS integer
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    begin
    if session_is_admin(p.id) != true then
      raise 'Permission denied';
    end if;
    return (select data_hosting_quota from projects where id = p.id);
    end;
  $$;

grant update (data_hosting_quota) on projects to seasketch_superuser;
