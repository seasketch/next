--! Previous: sha1:38f62a9cfc5d9c555f68f320b486722c2454c64c
--! Hash: sha1:a39327252c79d7c4093213cfa1f7c74b411ae2c3

-- Enter migration here
CREATE OR REPLACE FUNCTION public.update_z_indexes("dataLayerIds" integer[]) RETURNS SETOF public.data_layers
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    z int;
    pid int;
  begin
    if (select count(distinct(project_id)) from data_layers where id = any("dataLayerIds")) > 1 then
      raise 'Denied. Attempting to modify more than one project.';
    end if;
    if (session_is_admin((select project_id from data_layers where id = any("dataLayerIds") limit 1))) != true then
      raise 'Unauthorized';
    end if;
    -- Disable triggers to prevent unnecessary checks which could cause
    -- deadlocks if rapidly updating z-indexes on a large number of layers.
    SET session_replication_role = replica;
    z = 0;
    for i in array_lower("dataLayerIds", 1)..array_upper("dataLayerIds", 1) loop
      z = z + 1;
      update data_layers set z_index = z where id = "dataLayerIds"[i];
    end loop;
    SET session_replication_role = DEFAULT;
    return query (select * from data_layers where id = any("dataLayerIds"));
  end
$$;
