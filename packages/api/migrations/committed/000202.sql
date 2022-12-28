--! Previous: sha1:100d97ce6f2c9dc82339f94f0d8de5e60220292e
--! Hash: sha1:c9154ab59aa6361af7982b363a381f65dc83b279

-- Enter migration here

create or replace function copy_sketch(sketch_id int)
  returns sketches
  language plpgsql
  as $$
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
          collection_id,
          folder_id,
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

grant execute on function copy_sketch to seasketch_user;

create or replace function copy_sketch_folder(folder_id int)
  returns sketch_folders
  language plpgsql
  as $$
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
          collection_id,
          sketch_folders.folder_id
        from sketch_folders where id = copy_sketch_folder.folder_id returning * into output;
        return output;
      else
        raise exception 'Permission denied';
      end if;
    end;
  $$;

grant execute on function copy_sketch_folder to seasketch_user;

create or replace function get_child_sketches_and_collections_recursive(parent_id int, child_type sketch_child_type)
  returns int[]
  language plpgsql
  as $$
  declare
    ids int[] = '{}';
    child_ids int[];
    child record;
  begin
    if child_type = 'sketch' then
      FOR child IN SELECT * FROM get_children_of_collection(parent_id)
      LOOP
      if child.type = 'sketch' then
        ids := ids || child.id;
      end if;
      if child.is_leaf = false then
        select get_child_sketches_and_collections_recursive(child.id, child.type) into child_ids;
        ids := ids || child_ids;
      end if;
      END LOOP;
    else
      FOR child IN SELECT * FROM get_children_of_folder(parent_id)
      LOOP
      if child.type = 'sketch' then
        ids := ids || child.id;
      end if;
      if child.is_leaf = false then
        select get_child_sketches_and_collections_recursive(child.id, child.type) into child_ids;
        ids := ids || child_ids;
      end if;
      END LOOP;
    end if;
    return ids;
  end;
  $$;


create or replace function get_child_folders_recursive(parent_id int, child_type sketch_child_type)
  returns int[]
  language plpgsql
  as $$
  declare
    ids int[] = '{}';
    child_ids int[];
    child record;
  begin
    if child_type = 'sketch' then
      FOR child IN SELECT * FROM get_children_of_collection(parent_id)
      LOOP
      if child.type = 'sketch_folder' then
        ids := ids || child.id;
      end if;
      if child.is_leaf = false then
        select get_child_folders_recursive(child.id, child.type) into child_ids;
        ids := ids || child_ids;
      end if;
      END LOOP;
    else
      FOR child IN SELECT * FROM get_children_of_folder(parent_id)
      LOOP
      if child.type = 'sketch_folder' then
        ids := ids || child.id;
      end if;
      if child.is_leaf = false then
        select get_child_folders_recursive(child.id, child.type) into child_ids;
        ids := ids || child_ids;
      end if;
      END LOOP;
    end if;
    return ids;
  end;
  $$;

grant execute on function get_child_folders_recursive to anon;

drop function if exists copy_sketch_toc_item_recursive;
create or replace function copy_sketch_toc_item_recursive(parent_id int, type sketch_child_type, append_copy_to_name boolean)
  returns int
  language plpgsql
  -- security definer
  as $$
    declare
      copy_id int;
      child_copy_id int;
      is_collection boolean;
      child record;
    begin
      if type = 'sketch' then
        -- copy it and get the copy id
        select id, is_collection(sketch_class_id) from copy_sketch(parent_id) into copy_id, is_collection;
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

grant execute on function copy_sketch_toc_item_recursive to seasketch_user;

comment on function copy_sketch_toc_item_recursive is '@omit';

grant execute on function get_child_sketches_and_collections_recursive to seasketch_user;
comment on function get_child_sketches_and_collections_recursive is '@omit';
