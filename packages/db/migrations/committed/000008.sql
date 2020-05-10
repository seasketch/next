--! Previous: sha1:3d65159711ae83ef78f7dd05473065f17db3e757
--! Hash: sha1:96bf38928c5f1b4dddc231ac80fd72269f39f903

-- Enter migration here
ALTER TABLE projects enable ROW level SECURITY;

DROP POLICY IF EXISTS superuser_projects_select ON projects;

-- Allow superusers to see all projects that haven't been marked as deleted
CREATE POLICY superuser_projects_select ON projects FOR select TO seasketch_superuser USING (is_deleted = FALSE);

DROP POLICY IF EXISTS anon_projects_select_listed ON projects;

-- Allow any user to see listed projects that haven't been deleted
CREATE POLICY anon_projects_select_listed ON projects FOR SELECT TO anon USING (
  is_listed = TRUE AND 
  is_deleted = FALSE
);

-- Allow approved project participants to see invite-only, unlisted projects
DROP POLICY IF EXISTS seasketch_user_select_projects ON projects;

CREATE POLICY seasketch_user_select_projects ON projects FOR SELECT TO seasketch_user USING (
  is_deleted = FALSE
  AND (
    is_listed = TRUE OR EXISTS (
      SELECT 
        id
      FROM
        project_participants
      WHERE (
        project_participants.user_id = current_setting('session.user_id', TRUE)::int AND 
        project_participants.project_id = projects.id
      ) AND (
        project_participants.approved = TRUE OR 
        project_participants.is_admin = TRUE
      )
    )
  )
);

alter table projects drop constraint if exists disallow_unlisted_public_projects;
alter table projects add constraint disallow_unlisted_public_projects check (
  access_control != 'public' or is_listed = true);

create or replace function create_project (
  name text, 
  slug text, 
  OUT project projects
) 
  language plpgsql
  volatile
  strict
  security definer
as $$
  begin
    if current_setting('session.email_verified', true) = 'true' then
      insert into projects (name, slug, is_listed) 
        values (name, slug, false) returning * into project;
      insert into project_participants (
        user_id, 
        project_id, 
        is_admin, 
        approved, 
        share_profile
      ) values (
        current_setting('session.user_id', true)::int, 
        project.id, 
        true, 
        true, 
        true
      );
    else
      raise exception 'Email must be verified to create a project';
    end if;
  end
$$;

grant execute on function create_project to seasketch_user;

comment on function create_project is E'Users with verified emails can create new projects by choosing a unique name and url slug. This project will be unlisted with admin_only access and the user will be automatically added to the list of admins.';

-- TODO: Note that this will need to be updated whenever columns are added
GRANT update (
  name, 
  description, 
  access_control, 
  is_listed, 
  logo_url, 
  logo_link, 
  is_featured 
) on projects to seasketch_superuser;

drop policy if exists superuser_update_projects on projects;
create policy superuser_update_projects on projects for update to seasketch_superuser using (true);

-- TODO: This will need to be updated whenever columns are added
GRANT update (
  name, 
  description, 
  access_control, 
  is_listed, 
  logo_url, 
  logo_link
) on projects to seasketch_user;

drop policy if exists admin_update_projects on projects;
create policy admin_update_projects on projects for update to seasketch_user using (
  EXISTS (
    SELECT 
      id
    FROM
      project_participants
    WHERE (
      project_participants.user_id = current_setting('session.user_id', TRUE)::int AND 
      project_participants.project_id = projects.id
    ) AND (
      project_participants.is_admin = TRUE
    )
  )
);

drop function if exists is_admin;

create or replace function is_admin(_project_id int, _user_id int)
  returns boolean
  language sql
  as $$
    select exists (
      select 
        1 
      from 
        project_participants 
      where 
        project_participants.user_id = _user_id and 
        project_participants.project_id = _project_id and 
        project_participants.is_admin = true
    );
$$;

drop function if exists is_superuser;

create function is_superuser()
  returns boolean
  language sql
  stable
  security definer
  as $$
  select 'seasketch_superuser' = current_setting('role', true);
$$;


drop function if exists delete_project;
create function delete_project(project_id int, OUT project projects)
  language plpgsql
  volatile
  strict
  security definer
as $$
  begin
    if is_superuser() or is_admin(project_id, current_setting('session.user_id', true)::int) then
      update projects set deleted_at = now(), is_deleted = true where projects.id = project_id returning * into project;
    else
      raise exception 'You do not administer this project';
    end if;
  end
$$;

GRANT execute on function delete_project to seasketch_user;
