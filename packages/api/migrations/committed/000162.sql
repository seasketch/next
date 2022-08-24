--! Previous: sha1:7b108d1301658819009805cadf2edce9b9a8a178
--! Hash: sha1:daa9e94c64ecf1f0c84c53af6419a887a35538cb

-- Enter migration here
CREATE OR REPLACE FUNCTION public.join_project(project_id integer) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    AS $$
    insert into project_participants (user_id, project_id, share_profile, approved) values (current_setting('session.user_id', true)::integer, project_id, true, session_is_superuser()) on conflict on constraint project_participants_pkey do update set share_profile = true;
  $$;
