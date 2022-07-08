--! Previous: sha1:0bf0f833cbc2c8b521f37439c9a61ea326608164
--! Hash: sha1:cdab6fb5c678d83b7c7a983609bc0e8f0f8469ce

-- Enter migration here
drop function if exists public.update_basemap_offline_tile_settings;
CREATE OR REPLACE FUNCTION public.update_basemap_offline_tile_settings("projectId" integer, "basemapId" integer, use_default boolean, "maxZ" integer, "maxShorelineZ" integer) RETURNS basemaps
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      existing_settings_id int;
      return_value basemaps;
    begin
      if session_is_admin("projectId") then
        update basemaps set use_default_offline_tile_settings = use_default where id = "basemapId";
        if use_default then
          select id into existing_settings_id from offline_tile_settings where project_id = "projectId" and basemap_id is null;
          if existing_settings_id is null then
            insert into offline_tile_settings (project_id, max_z, max_shoreline_z, region) values ("projectId", "maxZ", "maxShorelineZ", (select region from projects where id = "projectId"));
          else
            update offline_tile_settings set max_z = "maxZ", max_shoreline_z = "maxShorelineZ" where id = existing_settings_id;
          end if;
        else
          select id into existing_settings_id from offline_tile_settings where project_id = "projectId" and basemap_id = "basemapId";
          if existing_settings_id is null then
            insert into offline_tile_settings (project_id, basemap_id, max_z, max_shoreline_z, region) values ("projectId", "basemapId", "maxZ", "maxShorelineZ", (select region from projects where id = "projectId"));
          else
            update offline_tile_settings set max_z = "maxZ", max_shoreline_z = "maxShorelineZ" where id = existing_settings_id;
          end if;
        end if;
        select * into return_value from basemaps where id = "basemapId" and session_is_admin(basemaps.project_id);
        return return_value;
      else
        raise exception 'Permission denied';
      end if;
    end;
  $$;

grant execute on function public.update_basemap_offline_tile_settings to seasketch_user;
