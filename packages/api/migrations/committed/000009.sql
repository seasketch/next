--! Previous: sha1:96bf38928c5f1b4dddc231ac80fd72269f39f903
--! Hash: sha1:c4deb590c7e0dcbcd7f1bb501c47b205f8ed1bb6

create or replace function session_is_admin ("projectId" int)
  returns boolean
  security definer
  language sql
  as $$
    select is_admin("projectId", current_setting('session.user_id', true)::integer);
$$;

GRANT execute on function session_is_admin to seasketch_user;

create or replace function session_is_superuser ()
  returns boolean
  security definer
  language sql
  as $$
    select is_superuser();
$$;

GRANT execute on function session_is_superuser () to seasketch_user;

comment on function session_is_superuser () is E'@omit';
comment on function session_is_admin is E'@omit';


CREATE OR REPLACE FUNCTION auto_create_profile() RETURNS TRIGGER AS
$$
BEGIN
  INSERT INTO
    user_profiles(user_id)
    VALUES(new.id);
      RETURN new;
END;
$$
language plpgsql;


DROP TRIGGER if exists trig_auto_create_profile on public.users;

CREATE TRIGGER trig_auto_create_profile
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE PROCEDURE auto_create_profile();

alter table user_profiles enable row level security;

-- Users should have access to a profile if:
-- it is their own
-- if they are an admin of a project where it has been shared
-- if accessing it through a forum message... that might be solved later with a plugin

drop policy if exists select_user_profile on public.user_profiles;

create policy select_user_profile on public.user_profiles for select to seasketch_user using (
  user_id = nullif(current_setting('session.user_id', true), '')::integer 
  OR EXISTS (
    SELECT 
      1
    FROM
      project_participants
    WHERE
      project_participants.user_id = user_profiles.user_id AND
      project_participants.share_profile = true and
      project_participants.project_id in (
        select 
          project_id 
        from 
          project_participants 
        where 
          user_id = current_setting('session.user_id', true)::int and 
          is_admin = true
      )
  )
);

comment on column users.onboarded is E'Indicates whether the user has seen post-registration information. Mostly a tool for the client UI to use if needed.';

drop function if exists onboarded;

create or replace function onboarded() returns void as $$
BEGIN
  IF current_setting('session.user_id', true)::int > 0 THEN
    update public.users set onboarded = now() where users.id = current_setting('session.user_id', true)::int;
  else
    raise exception 'session.user_id must be set';
  end if;
END;
$$
security definer
language plpgsql;

GRANT EXECUTE ON FUNCTION onboarded to seasketch_user;

comment on function onboarded is E'Mark that the user represented in the current session has been shown post-user-registration content.';

drop function if exists users_participation_status;
DROP type if exists participation_status;
CREATE TYPE participation_status AS enum (
  'none',
  'participant',
  'pending_approval'
);

create or replace function public.users_participation_status (u users, "projectId" int)
returns participation_status 
language sql 
stable
as $$
  select case when exists(
    select 
      1 
    from 
      project_participants 
    where 
      project_participants.user_id = u.id and 
      project_participants.project_id = "projectId"
  ) then 
    case when exists(
      select
        project_participants.approved,
        projects.access_control
      from 
        project_participants
      inner join
        projects
      on
        project_participants.project_id = projects.id
      where
        project_participants.user_id = u.id and
        project_participants.project_id = "projectId" and
        (project_participants.approved = true or access_control = 'public')
    ) then 
      'participant'::participation_status
    else
      'pending_approval'::participation_status
    end
  else
    'none'::participation_status
  end
$$;

GRANT execute on function users_participation_status to seasketch_user;

alter table project_participants enable row level security;


drop policy if exists select_project_participants on project_participants;


create policy select_project_participants on project_participants using (
  current_setting('session.user_id', true)::integer = user_id or 
  session_is_admin(project_id) or
  session_is_superuser()
);

drop function if exists join_project;

create function join_project ( project_id int)
  returns void
  security definer
  language sql
  as $$
    insert into project_participants (user_id, project_id, share_profile) values (current_setting('session.user_id', true)::integer, project_id, true) on conflict on constraint project_participants_pkey do update set share_profile = true;
  $$;

GRANT execute on function join_project to seasketch_user;

COMMENT on function is_admin is E'@omit';

COMMENT on function join_project is E'Adds current user to the list of participants for a project, sharing their profile with administrators. Their profile will also be shared in public or group discussion forum posts.';

COMMENT on function delete_project is E'Marks project as deleted. Will remain in database but not accessible to anyone. Function can only be accessed by project administrators.';

drop function if exists leave_project;
create function leave_project ( project_id int)
  returns void
  security definer
  language sql
  as $$
    insert into project_participants (user_id, project_id, share_profile) values (current_setting('session.user_id', true)::integer, project_id, false) on conflict on constraint project_participants_pkey do update set share_profile = false;
  $$;

GRANT execute on function leave_project to seasketch_user;
COMMENT on function leave_project is E'Stops sharing of user profile with the given project.';

drop function if exists approve_participant;
create function approve_participant ( "projectId" int, "userId" int)
  returns void
  security definer
  language plpgsql
  as $$
    BEGIN
      IF session_is_admin("projectId") or session_is_superuser() THEN
        update project_participants set approved = true where user_id = "userId" and project_id = "projectId";
      ELSE
        raise exception 'You must be a project administrator';
      END IF;
    END
  $$;

GRANT execute on function approve_participant to seasketch_user;
COMMENT on function leave_project is E'Approve a user for use of an invite_only project.';

drop function if exists grant_admin_access;
create function grant_admin_access ( "projectId" int, "userId" int)
  returns void
  security definer
  language plpgsql
  as $$
    BEGIN
      IF session_is_admin("projectId") or session_is_superuser() THEN
        IF exists(select 1 from project_participants where user_id = "userId" and project_id = "projectId" and share_profile = true) THEN
          update project_participants set is_admin = true where user_id = "userId" and project_id = "projectId";
        ELSE
          raise exception 'User must join the project and share their user profile first.';
        END IF;
      ELSE
        raise exception 'You must be a project administrator';
      END IF;
    END
  $$;

GRANT execute on function grant_admin_access to seasketch_user;
COMMENT on function grant_admin_access is E'Give a user admin access to a project. User must have already joined the project and shared their user profile.';

grant update on table user_profiles to seasketch_user;
alter table user_profiles enable row level security;

drop policy if exists user_profile_read on user_profiles;
create policy user_profile_read on user_profiles for select using (
  user_id = current_setting('session.user_id', true)::integer
);

drop policy if exists user_profile_update on user_profiles;
create policy user_profile_update on user_profiles for update using (user_id = current_setting('session.user_id', true)::integer);

alter table project_groups drop constraint if exists project_groups_unique_name_project_id;
alter table project_groups add constraint project_groups_unique_name_project_id unique(project_id, name);
alter table project_groups enable row level security;
drop policy if exists project_groups_admin on project_groups;
create policy project_groups_admin on project_groups for all using (session_is_admin(project_id)) with check (session_is_admin(project_id));
grant all on table project_groups to seasketch_user;

drop function if exists add_user_to_group;
create function add_user_to_group ( "groupId" int, "userId" int)
  returns void
  security definer
  language plpgsql
  as $$
    Declare
      pid int;
    BEGIN
      select project_id into pid from project_groups where id = "groupId";
      IF session_is_admin(pid) or session_is_superuser() THEN
        insert into project_group_members (group_id, user_id) values ("groupId", "userId");
      ELSE
        raise exception 'You must be a project administrator';
      END IF;
    END
  $$;

GRANT execute on function add_user_to_group to seasketch_user;

drop function if exists remove_user_from_group;
create function remove_user_from_group ( "groupId" int, "userId" int)
  returns void
  security definer
  language plpgsql
  as $$
    Declare
      pid int;
    BEGIN
      select project_id into pid from project_groups where id = "groupId";
      IF session_is_admin(pid) or session_is_superuser() THEN
        delete from project_group_members where group_id = "groupId" and user_id = "userId";
      ELSE
        raise exception 'You must be a project administrator';
      END IF;
    END
  $$;

GRANT execute on function remove_user_from_group to seasketch_user;
