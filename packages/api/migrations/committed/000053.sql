--! Previous: sha1:7daa5c215a6d374838be8c8cae401fe03c88a449
--! Hash: sha1:6810d9d4ad9004e629a636e3abed543c135b2fac

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
      end if;
    elsif NEW.project_invite_id is null then
      -- surveys
      return NEW;
    elsif OLD is null or OLD.status != NEW.status then
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
