--! Previous: sha1:02f8bb1d550c151d80a2fd11fd5a065b7518171c
--! Hash: sha1:25d03ab81a704dcb20848a1724e13ae93acbde1d

-- Enter migration here
CREATE OR REPLACE FUNCTION create_bbox(geom public.geometry, sketch_id int) RETURNS real[]
    LANGUAGE plpgsql
    IMMUTABLE 
    SECURITY DEFINER
    AS $$
    declare
      child_ids int[];
      bbox real[];
      is_collection boolean;
      extent box2d;
    begin
      if geom is null then
        -- select is_collection(sketch_class_id) into is_collection from sketches where id = sketch_id;
        -- raise notice 'Is collection? %', is_collection;
        -- if sketch_id is not null and is_collection then
        --   -- calculate combined bbox of all children
        --   -- get child ids
        --   select get_child_sketches_recursive(sketch_id, 'sketch') into child_ids;
        --   -- get extend (box2d) from children
        --   if array_length(child_ids, 1) < 1 then
        --     return null;
        --   end if;
        --   select st_extent(coalesce(sketches.geom, sketches.user_geom)) into extent from sketches where id = any(child_ids);
        --   -- create real[] from box2d
        --   select array[st_xmin(extent)::real, st_ymin(extent)::real, st_xmax(extent)::real, st_ymax(extent)::real] into bbox;    
        --   return bbox;
        -- else
        --   return null;
        -- end if;
        return null;
      end if;
      select array[st_xmin(geom)::real, st_ymin(geom)::real, st_xmax(geom)::real, st_ymax(geom)::real] into bbox;
      return bbox;
    end;
  $$;

alter table sketches drop column if exists bbox;
alter table sketches add column bbox real[] generated always as (create_bbox(COALESCE(geom, user_geom), id)) stored;
