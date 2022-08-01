--! Previous: sha1:1fab50febc4ee630896f37c4be785e21240e2753
--! Hash: sha1:812eecc4b9ad0f76d9746895dee7fbb0f04c88de

-- Enter migration here
comment on column projects.mapbox_secret_key is '@omit';

drop function if exists projects_mapbox_secret_key;

CREATE OR REPLACE FUNCTION public.projects_mapbox_secret_key(p public.projects) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
    begin
      if session_is_admin(p.id) then
        return (select mapbox_public_key from projects where projects.id = project.id and session_is_admin(project.id));
      else
        return '*********'::text;
        -- raise exception 'Must be project admin';
      end if;
    end;
  $$;

grant execute on function projects_mapbox_secret_key to anon;
