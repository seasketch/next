--! Previous: sha1:4bbe22071aa68c72dc111488125322e5b7dad9a2
--! Hash: sha1:a49e4c78cb3120798d0d6d8dd780581a982609e0

-- Enter migration here
drop function if exists users_groups;
create or replace function users_groups(u public.users, "projectSlug" text)
  returns setof project_groups
  language sql
  security definer
  stable
  as $$
    select 
      * 
    from 
      project_groups 
    where 
      project_id = (
        select id from projects where projects.slug = "projectSlug" limit 1
      ) and 
      ((select session_is_admin(projects.id) from projects where projects.slug = "projectSlug")) and
      id = any((
        select group_id from project_group_members where user_id = u.id
      ))
  $$;

grant execute on function users_groups to seasketch_user;

comment on function users_groups is '
@simpleCollections only
List of groups for the given project and user. Only available to project admins.
';

create or replace function projects_is_admin(p public.projects, "userId" int)
  returns boolean
  language sql
  security definer
  stable
  as $$
    select coalesce(is_admin, false) from project_participants where user_id = "userId" and project_id = p.id and session_is_admin(p.id);
  $$;

grant execute on function projects_is_admin to seasketch_user;

comment on function projects_is_admin is '
Returns true if the given user is an administrator of the project. Informaiton is only available administrators of the project and will otherwise always return false.
';

CREATE OR REPLACE FUNCTION public.toggle_admin_access("projectId" integer, "userId" integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    DECLARE
      already_admin boolean;
    BEGIN
      IF session_is_admin("projectId") or session_is_superuser() THEN
        IF exists(select 1 from project_participants where user_id = "userId" and project_id = "projectId" and share_profile = true) THEN
          select is_admin into already_admin from project_participants where user_id = "userId" and project_id = "projectId";
          update project_participants set is_admin = not(already_admin) where user_id = "userId" and project_id = "projectId";
          return not(already_admin);
        ELSE
          raise exception 'User must join the project and share their user profile first.';
        END IF;
      ELSE
        raise exception 'You must be a project administrator';
      END IF;
    END
  $$;

grant execute on function toggle_admin_access to seasketch_user;

comment on function toggle_admin_access is 'Toggle admin access for the given project and user. User must have already joined the project and shared their user profile.';

drop function if exists users_is_admin;
create or replace function users_is_admin(u public.users, "projectSlug" text)
  returns boolean
  language plpgsql
  security definer
  stable
  as $$
    declare
      "isAdmin" boolean;
    begin
      select coalesce(is_admin, false) into "isAdmin" from project_participants where user_id = u.id and project_id = (select id from projects where slug = "projectSlug") and session_is_admin((select id from projects where slug = "projectSlug"));
      return coalesce("isAdmin", false);
    end;
  $$;

grant execute on function users_is_admin(users, text) to seasketch_user;

create or replace function set_user_groups("userId" int, "projectId" int, groups int[])
  returns int[]
  language plpgsql
  security definer
  as $$
    begin 
      if session_is_admin("projectId") or session_is_superuser() THEN
        delete from project_group_members where user_id = "userId" and group_id in (select id from project_groups where project_id = "projectId");
        for i IN 1 ..coalesce(array_upper(groups, 1), 0) loop
          insert into project_group_members (user_id, group_id) values ("userId", groups[i]);
        end loop;
        return groups;
      else
        raise exception 'Permission denied';
      end if;
    end
  $$;

grant execute on function set_user_groups to seasketch_user;

comment on function set_user_groups is '
Sets the list of groups that the given user belongs to. Will clear all other group memberships in the project. Available only to admins.
';

alter table project_groups alter column name set not null;


CREATE OR REPLACE FUNCTION toggle_forum_posting_ban("userId" integer, "projectId" integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      is_banned boolean;
    begin
      if session_is_admin("projectId") then
        select is_banned_from_forums into is_banned from project_participants where project_id = "projectId" and user_id = "userId";
        update project_participants set is_banned_from_forums = not(is_banned) where project_id = "projectId" and user_id = "userId";
        return not(is_banned);
      else
        raise exception 'Must be project admin';
      end if;
    end;
  $$;

grant execute on function toggle_forum_posting_ban to seasketch_user;

COMMENT ON FUNCTION public.toggle_forum_posting_ban IS 'Ban a user from posting in the discussion forum';

drop function if exists public.users_banned_from_forums(public.users, text);

-- CREATE OR REPLACE FUNCTION public.users_banned_from_forums(u public.users, "projectSlug" text) RETURNS boolean
--     LANGUAGE plpgsql STABLE SECURITY DEFINER
--     AS $$
--     declare
--       is_banned boolean;
--       pid int;
--     begin
--       select id into pid from projects where slug = "projectSlug";
--       if session_is_admin("projectId") then
--         select is_banned_from_forums into is_banned from project_participants where project_id = "projectId" and user_id = u.id;
--         return is_banned;
--       else
--         raise exception 'Must be a project admin';
--       end if;
--     end;
--   $$;

-- grant execute on function public.users_banned_from_forums(public.users, text) to seasketch_user;

-- COMMENT ON FUNCTION public.users_banned_from_forums(u public.users, "projectSlug" text) IS 'Whether the user has been banned from the forums. Use `disableForumPosting()` and `enableForumPosting()` mutations to modify this state. Accessible only to admins.';

grant select on table survey_invited_groups to seasketch_user;


alter table project_invite_groups drop constraint project_invite_groups_invite_id_fkey;

alter table project_invite_groups add constraint project_invite_groups_invite_id_fkey foreign key (invite_id) references project_invites(id) on delete cascade;

alter table project_invite_groups drop constraint project_invite_groups_group_id_fkey;

alter table project_invite_groups add constraint project_invite_groups_group_id_fkey foreign key (group_id) references project_groups(id) on delete cascade;

drop function if exists update_project_invite;
create or replace function update_project_invite("inviteId" int, make_admin boolean, email text, fullname text, "groups" int[]) 
  returns project_invites
  language plpgsql
  security definer
  as $$
    declare
      pid int;
      status invite_status;
      current_email text;
      used boolean;
      _email text;
      _make_admin boolean;
      _fullname text;
      invite project_invites;
    begin
      select "email", "make_admin", "fullname" into _email, _make_admin, _fullname;
      select project_id, project_invites_status(project_invites.*), project_invites.email, was_used into pid, status, current_email, used from project_invites where project_invites.id = "inviteId";
      if session_is_admin(pid) then
        if status != 'UNSENT'::invite_status and current_email != _email then
          raise exception 'Cannot change email if invite has already been sent.';
        end if;
        if used is true then
          raise exception 'Cannot update invite if it has already been used.';
        end if;
        update project_invites set email = _email, fullname = _fullname, make_admin = _make_admin where id = "inviteId";
        delete from project_invite_groups where invite_id = "inviteId";
        for i IN 1 ..coalesce(array_upper(groups, 1), 0) loop
          insert into project_invite_groups (invite_id, group_id) values ("inviteId", "groups"[i]);
        end loop;
        select * into invite from project_invites where project_invites.id = "inviteId";
        return invite;
      else
        raise exception 'Must be a project admin';
      end if;
    end;
  $$;

grant execute on function update_project_invite to seasketch_user;


COMMENT ON TABLE public.project_invites IS '
@omit all,update
@simpleCollections only
Admins can invite users to their project, adding them to user groups and 
distributing admin privileges as needed. Invitations can be immediately sent via
email or they can be sent out later in batches. 

Use the `createProjectInvites()`
mutation to create one or more invitations and then use graphile generated 
mutations to update and delete them.

Details on [handling user ingress with invitation tokens](https://github.com/seasketch/next/wiki/User-Ingress#project-invites) and [the mailer subsystem](https://github.com/seasketch/next/wiki/User-and-Survey-Invite-Management) can be found on the wiki.
';

grant select (to_address, id, token_expires_at, error, updated_at) on invite_emails to seasketch_user;


DO
$$
BEGIN
CREATE EXTENSION IF NOT EXISTS aws_lambda CASCADE;
EXCEPTION 
WHEN OTHERS THEN 
NULL; 
END;
$$;

alter table projects drop column if exists invite_email_template_text;
alter table projects add column if not exists invite_email_template_text text not null default E'Hello {{name}},\nYou have been invited to join the {{projectName}} SeaSketch project. To sign up, just follow this link and you will be able to create an account and start exploring the application.\n\n{{inviteLink}}'; 

alter table projects add column if not exists invite_email_subject text not null default 'You have been invited to a SeaSketch project';

grant select (invite_email_template_text, invite_email_subject) on projects to seasketch_user;
grant update (invite_email_template_text, invite_email_subject) on projects to seasketch_user;
