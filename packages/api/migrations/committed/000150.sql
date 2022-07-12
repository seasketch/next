--! Previous: sha1:cdab6fb5c678d83b7c7a983609bc0e8f0f8469ce
--! Hash: sha1:b517f6433954d9049e41c95884c622e63c2425bb

-- Enter migration here
alter table offline_tile_packages add column if not exists original_url_template text;
update offline_tile_packages set original_url_template = regexp_replace(data_source_url, 'mapbox://', 'https://api.mapbox.com/v4/') || '/{z}/{x}/{y}.vector.pbf' where is_mapbox_hosted = true and original_url_template is null;
alter table offline_tile_packages alter column original_url_template set not null;

drop function if exists generate_offline_tile_package;
CREATE FUNCTION public.generate_offline_tile_package("projectId" integer, "dataSourceUrl" text, "maxZ" integer, "maxShorelineZ" integer, "sourceType" public.offline_tile_package_source_type, "originalUrlTemplate" text) RETURNS public.offline_tile_packages
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      pkg offline_tile_packages;
    begin
      if session_is_admin("projectId") and (select is_offline_enabled from projects where id = "projectId") = true then
        insert into offline_tile_packages (project_id, region, data_source_url, is_mapbox_hosted, max_z, max_shoreline_z, source_type, original_url_template) values (
          "projectId",
          (select region from projects where id = "projectId"),
          "dataSourceUrl",
          true,
          "maxZ",
          "maxShorelineZ",
          "sourceType",
          "originalUrlTemplate"
        ) returning * into pkg;
        return pkg;
      else
        raise exception 'Permission denied';  
      end if;
      return pkg;
    end;
  $$;

grant execute on function generate_offline_tile_package to seasketch_user;
