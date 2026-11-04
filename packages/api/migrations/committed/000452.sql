--! Previous: sha1:d9ab2b4d5877c7f8914ce68e361025c81ea28052
--! Hash: sha1:fec99f029baa5b60c5f7804f17cca2630ded296c

-- Restore the profile-only editor lookup. Do not copy users.canonical_email
-- onto profile.email.
create or replace function public.change_logs_editor_profile(changelog public.change_logs)
  returns public.user_profiles
  language sql
  stable
  security definer
as $$
  select * from public.user_profiles where user_id = changelog.editor_id;
$$;

grant execute on function public.change_logs_editor_profile(changelog public.change_logs) to seasketch_user;

-- Same visibility as users_canonical_email: admins of a project the editor has joined.
create or replace function public.change_logs_editor_canonical_email(changelog public.change_logs)
  returns text
  language sql
  stable
  security definer
as $$
  select public.users_canonical_email(users)
  from public.users
  where users.id = changelog.editor_id;
$$;

comment on function public.change_logs_editor_canonical_email(changelog public.change_logs) is '
Account address for the editor. Returned only to admins of a project that person has joined, same as users_canonical_email. Not part of the profile.
';

grant execute on function public.change_logs_editor_canonical_email(changelog public.change_logs) to seasketch_user;
