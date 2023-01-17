--! Previous: sha1:9f58404e9fa0dc6afd8dcea3ce196f7702f72b8a
--! Hash: sha1:47fb9e9e76460f6aef9720a4a2a5ec30b1a4e934

-- Enter migration here
CREATE OR REPLACE FUNCTION public.before_sketch_insert_or_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      class_geometry_type sketch_geometry_type;
      allow_multi boolean;
      incoming_geometry_type text;
      new_geometry_type text;
      parent_collection_id int;
    begin
      select 
        geometry_type, 
        sketch_classes.allow_multi
      into 
        class_geometry_type, 
        allow_multi, 
        incoming_geometry_type 
      from 
        sketch_classes 
      where 
        id = NEW.sketch_class_id;
      if NEW.folder_id is not null and NEW.collection_id is not null then
        raise exception 'Parent cannot be to both folder and collection';
      end if;
      if class_geometry_type = 'COLLECTION' then
        -- Also check for parent collection of parent folder (recursively)
        if NEW.collection_id is not null then
          if (select get_parent_collection_id('sketch', NEW.collection_id)) is not null then
            raise exception 'Nested collections are not allowed';
          end if;
        elsif NEW.folder_id is not null then
          if (select get_parent_collection_id('sketch_folder', NEW.folder_id)) is not null then
            raise exception 'Nested collections are not allowed';
          end if;
        end if;
        -- geom must be present unless a collection
        if NEW.geom is not null or NEW.user_geom is not null then
          raise exception 'Collections should not have geometry';
        else
          -- no nested collections
          if NEW.collection_id is not null then
            raise exception 'Nested collections are not allowed';
          else
            return NEW;
          end if;
        end if;
      else
        select geometrytype(NEW.user_geom) into new_geometry_type;
        -- geometry type must match sketch_class.geometry_type and sketch_class.allow_multi
        if (new_geometry_type = class_geometry_type::text) or (allow_multi and new_geometry_type like '%' || class_geometry_type::text) then
          -- if specifying a collection_id, must be in it's valid_children
          if NEW.collection_id is null or not exists(select 1 from sketch_classes_valid_children where parent_id in (select sketch_class_id from sketches where id = NEW.collection_id)) or exists(select 1 from sketch_classes_valid_children where parent_id in (select sketch_class_id from sketches where id = NEW.collection_id) and child_id = NEW.sketch_class_id) then
            return NEW;
          else
            raise exception 'Sketch is not a valid child of collection';
          end if;
        else
          raise exception 'Geometry type does not match sketch class';
        end if;
      end if;
    end
  $$;


CREATE OR REPLACE FUNCTION public.before_sketch_folders_insert_or_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    declare
      parent_project_id int;
      child_collection_count int;
    begin
      if NEW.folder_id = NEW.id then
        raise exception 'Cannot make a folder a child of itself';
      end if;
      if NEW.folder_id is null and NEW.collection_id is null then
        return NEW;
      else
        if NEW.folder_id is not null then
          select 
            project_id 
          into 
            parent_project_id 
          from 
            sketch_folders 
          where 
            id = NEW.folder_id;
        end if;
        if NEW.collection_id is not null then
          select 
            project_id 
          into 
            parent_project_id 
          from 
            sketch_classes 
          where 
            id in (
              select 
                sketch_class_id 
              from 
                sketches 
              where 
                id = NEW.collection_id
            );
        end if;
        -- Check to make sure there are no child_collections if this has a parent collection
        select count(*) from sketches where id = any(get_child_sketches_and_collections_recursive(NEW.id, 'sketch_folder')) and is_collection(sketches.sketch_class_id) into child_collection_count;
        if child_collection_count > 0 then
          if NEW.collection_id is not null or (select get_parent_collection_id('sketch_folder', NEW.folder_id)) is not null then
            raise exception 'Nested collections are not allowed';
          end if;
        end if;
        if NEW.project_id is null or NEW.project_id = parent_project_id then
          return NEW;
        else
          raise exception 'project_id of parent does not match % %', NEW.project_id, parent_project_id;
        end if;
      end if;
    end
  $$;
