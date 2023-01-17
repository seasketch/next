--! Previous: sha1:47fb9e9e76460f6aef9720a4a2a5ec30b1a4e934
--! Hash: sha1:02f8bb1d550c151d80a2fd11fd5a065b7518171c

-- Enter migration here
CREATE OR REPLACE FUNCTION public.before_sketch_folders_insert_or_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    declare
      parent_project_id int;
      child_collection_count int;
      child_ids int[];
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
        select get_child_sketches_and_collections_recursive(NEW.id, 'sketch_folder') into child_ids;
        select count(*) from sketches where id = any(child_ids) and is_collection(sketches.sketch_class_id) into child_collection_count;
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
