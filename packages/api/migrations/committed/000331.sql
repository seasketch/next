--! Previous: sha1:f0e164d25df9fdd663014da142e4e6e1de5e9c7d
--! Hash: sha1:28c45bbfc20775c66b3bebee36be1798e9af2f66

-- Enter migration here
CREATE or replace FUNCTION public.data_sources_author_profile(source public.data_sources) RETURNS public.user_profiles
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select
      user_profiles.*
    from
      user_profiles
    inner join
      project_participants
    on
      project_participants.user_id = coalesce(source.created_by, source.uploaded_by)
    where
      session_is_admin(source.project_id) and
      (project_participants.is_admin = true or (
      project_participants.share_profile = true and
      project_participants.project_id = source.project_id)) and
      user_profiles.user_id = coalesce(source.created_by, source.uploaded_by)
    limit 1;
  $$;

grant execute on function data_sources_author_profile to seasketch_user;
