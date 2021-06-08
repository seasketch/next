--! Previous: sha1:8a06277df4812d3f63dbb6956d1c4c9663d5aaec
--! Hash: sha1:baeb3e1d916a2602b914a7c8ee12ea9197ad4304

-- Enter migration here
CREATE OR REPLACE FUNCTION public.after_insert_or_update_or_delete_project_invite_email() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    pid int;
    iid int;
  begin
    if NEW is null then
      -- deleting
      select id, project_id into iid, pid from project_invites where id = OLD.project_invite_id;
      if pid is not null and iid is not null then
        perform pg_notify(concat('graphql:project:', pid, ':project_invite_status_change'), json_build_object('inviteId', iid)::text);
        return NEW;
      else
        -- Don't raise error to prevent issues with DELETE CASCADE on project_invites
        -- raise exception 'Could not find project_invite';
        return NEW;
      end if;
    elsif NEW.project_invite_id is null then
      -- surveys
      return NEW;
    elsif OLD.status != NEW.status then
      select id, project_id into iid, pid from project_invites where id = NEW.project_invite_id;
      if pid is not null and iid is not null then
        perform pg_notify(concat('graphql:project:', pid, ':project_invite_status_change'), json_build_object('inviteId', iid)::text);
        return NEW;
      else
        raise exception 'Could not find project_invite';
      end if;
    else
      return NEW;
    end if;
  end;
  $$;



CREATE OR REPLACE FUNCTION public.send_project_invites("inviteIds" integer[]) RETURNS SETOF public.invite_emails
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      emails int[];
    begin
      if exists(
        select 1 from projects where id = any(
          select distinct(project_id) from project_invites where project_invites.id = any("inviteIds")
        ) and session_is_admin(id) = false
      ) then
        raise exception 'Must be project administrator';
      end if;
      with new_emails (id) as (
        insert into invite_emails (project_invite_id) select unnest("inviteIds") returning *
      ) select array_agg(id) into emails from new_emails;
      perform graphile_worker.add_job('sendProjectInviteEmail', json_build_object('emailId', id), max_attempts := 13, job_key := concat('project_invite_', invite_emails.project_invite_id)) from invite_emails where id = any(emails);
      return query select * from invite_emails where id = any(emails);
    end;
  $$;

-- Enable graphile_worker to manage it's own schema
GRANT CREATE ON DATABASE seasketch to graphile;


CREATE OR REPLACE FUNCTION public.before_invite_emails_insert() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  begin
    -- assigning to_address
    if NEW.project_invite_id is not null then
      NEW.to_address = (select email from project_invites where id = NEW.project_invite_id);
    end if;

    -- check if user has compained in any other emails
    if exists (
      select 
        1
      from 
        invite_emails
      where
        to_address = NEW.to_address and
        status = 'COMPLAINT'
    ) then
      return NULL;
    end if;

    if NEW.project_invite_id is not null then
      if exists (
        select 1 from invite_emails 
        where project_invite_id = new.project_invite_id and
        status = 'QUEUED'
      ) then
        return NULL;
      end if;
    end if;
    if NEW.survey_invite_id is not null then
      if exists (
        select 1 from invite_emails where 
        survey_invite_id = new.survey_invite_id and
        status = 'QUEUED'
      ) then
        return NULL;
      end if;
    end if;
    return new;
  end;
$$;


CREATE OR REPLACE FUNCTION public.before_invite_emails_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  begin
    NEW.updated_at = now();
    return new;
  end;
$$;
