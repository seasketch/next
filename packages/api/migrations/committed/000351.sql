--! Previous: sha1:e5fd6b75c80686206effb13920537659cf26a874
--! Hash: sha1:b42f2f8b7680d88a9705e6fe3fe10d963a5e2615

-- Enter migration here
drop function if exists copy_sketch(integer);
drop function if exists copy_sketch(integer, boolean);
CREATE FUNCTION public.copy_sketch(sketch_id integer, clear_parent boolean) RETURNS public.sketches
    LANGUAGE plpgsql
    AS $$
    declare 
      output sketches;
    begin
      -- this will check RLS policy. DO NOT use security definer!
      if (select exists (select id from sketches where id = sketch_id)) then
        insert into sketches (
          user_id,
          copy_of,
          name,
          sketch_class_id,
          collection_id,
          folder_id,
          user_geom,
          geom,
          properties
        ) select
          nullif(current_setting('session.user_id', TRUE), '')::int,
          sketch_id,
          name,
          sketch_class_id,
          CASE WHEN clear_parent THEN NULL ELSE collection_id END,
          CASE WHEN clear_parent THEN NULL ELSE folder_id END,
          user_geom,
          geom,
          properties
        from sketches where id = sketch_id returning * into output;
        return output;
      else
        raise exception 'Permission denied';
      end if;
    end;
  $$;

create or replace function copy_sketch(sketch_id integer)
  returns public.sketches
    language sql
    as $$
      select * from public.copy_sketch(sketch_id, false);
    $$;

grant execute on function copy_sketch(integer) to seasketch_user;
grant execute on function copy_sketch(integer, boolean) to seasketch_user;

DROP FUNCTION IF EXISTS copy_sketch_folder(integer);
DROP FUNCTION IF EXISTS copy_sketch_folder(integer, boolean);
CREATE FUNCTION public.copy_sketch_folder(folder_id integer, clear_parent boolean) RETURNS public.sketch_folders
    LANGUAGE plpgsql
    AS $$
    declare 
      output sketch_folders;
    begin
      -- this will check RLS policy. DO NOT use security definer!
      if (select exists (select id from sketch_folders where id = copy_sketch_folder.folder_id)) then
        insert into sketch_folders (
          user_id,
          name,
          project_id,
          collection_id,
          folder_id
        ) select
          nullif(current_setting('session.user_id', TRUE), '')::int,
          name,
          project_id,
          CASE WHEN clear_parent THEN NULL ELSE collection_id END,
          CASE WHEN clear_parent THEN NULL ELSE sketch_folders.folder_id END
        from sketch_folders where id = copy_sketch_folder.folder_id returning * into output;
        return output;
      else
        raise exception 'Permission denied';
      end if;
    end;
  $$;

create function copy_sketch_folder(folder_id integer)
  returns public.sketch_folders
    language sql
    as $$
      select * from public.copy_sketch_folder(folder_id, false);
    $$;

grant execute on function copy_sketch_folder(integer) to seasketch_user;
grant execute on function copy_sketch_folder(integer, boolean) to seasketch_user;


CREATE OR REPLACE FUNCTION public.copy_sketch_toc_item_recursive(parent_id integer, type public.sketch_child_type, append_copy_to_name boolean) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      copy_id int;
      child_copy_id int;
      is_collection boolean;
      child record;
      policy_passed BOOLEAN;
      is_shared_in_forum boolean;
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
        is_shared_in_forum := (select shared_in_forum from sketches where id = parent_id);
        -- copy it and get the copy id
        select id, is_collection(sketch_class_id) from copy_sketch(parent_id, is_shared_in_forum) into copy_id, is_collection;
        -- When copying a sketch from the forum, make sure its folder_id and collection_id are cleared
        if (is_shared_in_forum) then
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
        select id from copy_sketch_folder(parent_id, true) into copy_id;
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
