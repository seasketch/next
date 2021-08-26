--! Previous: sha1:8903611b0533033c5c45800339c9ff8e7fd3c712
--! Hash: sha1:c354d555d8a60c48d49b40a143c053f4691e53ea

-- Enter migration here
alter table projects add column if not exists creator_id int references users (id);
update projects set creator_id = (select id from users where canonical_email = projects.support_email limit 1);
ALTER TABLE projects ALTER COLUMN creator_id SET NOT NULL;

CREATE OR REPLACE FUNCTION public.create_project(name text, slug text, OUT project public.projects) RETURNS public.projects
    LANGUAGE plpgsql STRICT SECURITY DEFINER
    AS $$
  begin
    if current_setting('session.email_verified', true) = 'true' then
      insert into projects (name, slug, is_listed, creator_id, support_email) 
        values (name, slug, false, current_setting('session.user_id', true)::int, current_setting('session.canonical_email', true)) returning * into project;
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
