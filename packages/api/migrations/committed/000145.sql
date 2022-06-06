--! Previous: sha1:812eecc4b9ad0f76d9746895dee7fbb0f04c88de
--! Hash: sha1:a5546bb7ff03e133021ddc98211ba6f7790b0940

-- Enter migration here
CREATE OR REPLACE FUNCTION public.projects_mapbox_secret_key(p public.projects) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    -- begin
      select mapbox_secret_key from projects where projects.id = p.id and session_is_admin(p.id);
      -- if session_is_admin(p.id) then
      --   return (select mapbox_secret_key from projects where projects.id = project.id and session_is_admin(project.id));
      -- else
      --   return '*********'::text;
      --   -- raise exception 'Must be project admin';
      -- end if;
    -- end;
  $$;

grant execute on function projects_mapbox_secret_key to anon;
