--! Previous: sha1:feeb00d30f1a6e12bc26c3ed135a118d74611735
--! Hash: sha1:04e7567d7e062316e66d36e900769f99095ad9f9

-- Enter migration here
grant update(folder_id) on sketches to seasketch_user;

create or replace function before_sketch_folders_insert_or_update()
  returns trigger
  language plpgsql
  as $$
    declare
      parent_project_id int;
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
        if NEW.project_id is null or NEW.project_id = parent_project_id then
          return NEW;
        else
          raise exception 'project_id of parent does not match % %', NEW.project_id, parent_project_id;
        end if;
      end if;
    end
  $$;
