--! Previous: sha1:9fa95ed7e44ca0954ad43975fea3d58453d6bcfe
--! Hash: sha1:f12f07e682b190e645b2c78917af02de997a1fef

-- Enter migration here
CREATE OR REPLACE FUNCTION public.session_is_admin("projectId" integer) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    AS $$
    select session_is_superuser() or (
      -- current_setting('session.email_verified', true) = 'true' and
      is_admin("projectId", nullif(current_setting('session.user_id', TRUE), '')::integer));
$$;
