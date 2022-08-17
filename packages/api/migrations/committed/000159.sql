--! Previous: sha1:ea9607da5dc03734489ade69c1cc9b9dbe77e811
--! Hash: sha1:e8ea97ce8262aaa3b9ca1cc62962191b5298839f

-- Enter migration here
CREATE OR REPLACE FUNCTION public.projects_session_participation_status(p public.projects) RETURNS public.participation_status
    LANGUAGE sql STABLE
    SECURITY DEFINER
    AS $$
    select users_participation_status(users.*, p.id) from users where it_me(users.id);
$$;

grant execute on function projects_session_participation_status to anon;
