--! Previous: sha1:a49e4c78cb3120798d0d6d8dd780581a982609e0
--! Hash: sha1:bc6ce8856de8253945dda006e8f1704396c80149

-- Enter migration here
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
      BEGIN
        select 
          aws_lambda.invoke(
            aws_commons.create_lambda_function_arn('SendProjectInvites'), 
            json_build_object('emailId', id), 'Event'
          ) 
        from 
          invite_emails 
        where 
          id = any(emails);
      EXCEPTION WHEN others THEN
        -- Do nothing in dev environment
      end;
      return query select * from invite_emails where id = any(emails);
    end;
  $$;


create or replace function after_update_project_invite_email() 
  returns trigger
  language plpgsql
  security DEFINER
  as $$
  declare
    pid int;
    iid int;
  begin
    -- raise exception 'Oh shit %, %', OLD, NEW.project_invite_id;
    if OLD is null or NEW.project_invite_id is null then
      return NEW;
    else
      if OLD.status != NEW.status then
        select id, project_id into iid, pid from project_invites where id = NEW.project_invite_id;
        if pid is not null and iid is not null then
          perform pg_notify(concat('graphql:project:', pid, ':project_invite_status_change'), json_build_object('inviteId', iid)::text);
          perform pg_notify(concat('graphql:project:', pid, ':project_invite_counts_change'), json_build_object('event', 'updated')::text);
        else
          raise exception 'Could not find project_invite';
        end if;
      end if;
      return NEW;
    end if;
  end;
  $$;

drop trigger if exists _500_gql_update_project_invite_email on invite_emails;
CREATE TRIGGER _500_gql_update_project_invite_email
  AFTER UPDATE ON invite_emails
  FOR EACH ROW
  EXECUTE PROCEDURE after_update_project_invite_email();


CREATE OR REPLACE FUNCTION public.projects_invites(p public.projects, statuses public.invite_status[], "orderBy" public.invite_order_by, direction public.sort_by_direction) RETURNS SETOF public.project_invites
    LANGUAGE sql STABLE
    AS $$
    select 
      * 
    from 
      project_invites 
    where 
      session_is_admin(p.id) and 
      project_id = p.id and 
      (array_length(statuses, 1) is null or project_invites_status(project_invites.*) = any (statuses))
    order by
      (CASE WHEN "orderBy" = 'EMAIL' and "direction" = 'ASC' THEN email
            WHEN "orderBy" = 'NAME' and "direction" = 'ASC' THEN fullname
            else fullname
      END) ASC,
      (CASE WHEN "orderBy" = 'EMAIL' and "direction" = 'DESC' THEN email
            WHEN "orderBy" = 'NAME' and "direction" = 'DESC' THEN fullname
            ELSE fullname
      END) DESC
  $$;
