--! Previous: sha1:34bba5d9e6dcba7e4de57df697d33c04c760aa76
--! Hash: sha1:1683d85c546802a54a712150f5991ca9f6b7655a

-- Enter migration here
CREATE OR REPLACE FUNCTION check_sketch_rls_policy(id int)
  returns boolean
  language plpgsql
  security invoker
  as $$
  BEGIN
    -- Try to select the resource under current user privileges
    PERFORM 1 FROM sketches WHERE sketches.id = check_sketch_rls_policy.id;
    RETURN TRUE; -- Resource is accessible
    EXCEPTION
        WHEN insufficient_privilege THEN
            RETURN FALSE; -- Resource is not accessible due to RLS
  END;
$$;

CREATE OR REPLACE FUNCTION public.copy_sketch_toc_item_recursive(parent_id integer, type public.sketch_child_type, append_copy_to_name boolean) RETURNS integer
    LANGUAGE plpgsql
    security definer
    AS $$
    declare
      copy_id int;
      child_copy_id int;
      is_collection boolean;
      child record;
      policy_passed BOOLEAN;
    begin
      policy_passed := check_sketch_rls_policy(parent_id);
      if type = 'sketch' then
        if policy_passed = false and it_me((select user_id from sketches where id = parent_id)) = false then
          raise exception 'Permission denied';
        end if;
      else
        if policy_passed = false and it_me((select user_id from sketch_folders where id = parent_id)) = false then
          raise exception 'Permission denied';
        end if;
      end if;
      SET session_replication_role = replica;
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
      SET session_replication_role = default;
      return copy_id;
    end;
  $$;
