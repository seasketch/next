--! Previous: sha1:b89807a916c11b253f57bf81196798da001b67a5
--! Hash: sha1:7daa5c215a6d374838be8c8cae401fe03c88a449

-- Enter migration here
DROP TRIGGER IF EXISTS _500_gql_update_project_invite_email on invite_emails;
DROP FUNCTION IF EXISTS after_update_project_invite_email;

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
        raise exception 'Could not find project_invite';
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

DROP TRIGGER IF EXISTS _500_gql_insert_or_update_or_delete_project_invite_email on invite_emails;
CREATE TRIGGER _500_gql_insert_or_update_or_delete_project_invite_email AFTER UPDATE or INSERT or DELETE ON public.invite_emails FOR EACH ROW EXECUTE FUNCTION public.after_insert_or_update_or_delete_project_invite_email();
