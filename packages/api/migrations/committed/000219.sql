--! Previous: sha1:2625e85cb8ef2b588685b85596c2fa7a540f228b
--! Hash: sha1:675e27f08d64b1e07cf9e41b4a908019c7c04dd9

-- Enter migration here
CREATE OR REPLACE FUNCTION public.copy_sketch_toc_item_recursive(parent_id integer, type public.sketch_child_type, append_copy_to_name boolean) RETURNS integer
    LANGUAGE plpgsql
    AS $$
    declare
      copy_id int;
      child_copy_id int;
      is_collection boolean;
      child record;
    begin
      if type = 'sketch' then
        -- copy it and get the copy id
        select id, is_collection(sketch_class_id) from copy_sketch(parent_id) into copy_id, is_collection;
        -- When copying a sketch from the forum, make sure its folder_id and collection_id are cleared
        if ((select shared_in_forum from sketches where id = parent_id)) then
          update sketches set collection_id = null, folder_id = null where id = copy_id;
        end if;
        if append_copy_to_name = true then
          update sketches set name = name || ' (copy)' where id = copy_id;
        end if;
        if is_collection then
          -- copy subfolders and sub-sketches
          FOR child IN SELECT * FROM get_children_of_collection(parent_id)
          LOOP
            raise notice 'copying %', child.type;
            select copy_sketch_toc_item_recursive(child.id, child.type, false) into child_copy_id;
            raise notice 'assigning collection_id=%', copy_id;
            if child.type = 'sketch_folder' then
              update sketch_folders set collection_id = copy_id, folder_id = null where id = child_copy_id;
            else
              update sketches set collection_id = copy_id, folder_id = null where id = child_copy_id;
            end if;
          END LOOP;
        end if;
      elsif type = 'sketch_folder' then
        -- copy it and get the copy id
        select id from copy_sketch_folder(parent_id) into copy_id;
        -- When copying a sketch from the forum, make sure its folder_id and collection_id are cleared
        if ((select shared_in_forum from sketch_folders where id = parent_id)) then
          update sketch_folders set collection_id = null, folder_id = null where id = copy_id;
        end if;
        if append_copy_to_name = true then
          update sketch_folders set name = name || ' (copy)' where id = copy_id;
        end if;
        -- copy subfolders and sub-sketches
        FOR child IN SELECT * FROM get_children_of_folder(parent_id)
          LOOP
            raise notice 'copying %', child.type;
            select copy_sketch_toc_item_recursive(child.id, child.type, false) into child_copy_id;
            raise notice 'assigning folder_id=%', copy_id;
            if child.type = 'sketch_folder' then
              update sketch_folders set folder_id = copy_id, collection_id = null where id = child_copy_id;
            else
              update sketches set folder_id = copy_id, collection_id = null where id = child_copy_id;
            end if;
          END LOOP;
      end if;
      return copy_id;
    end;
  $$;
