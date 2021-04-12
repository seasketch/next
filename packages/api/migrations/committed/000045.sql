--! Previous: sha1:215e5f0ee69562bdda9fdaae4f45680fa019f83b
--! Hash: sha1:c0c5aad37487a70295f45f9c97cd6ade88e51f5e

-- Enter migration here
CREATE OR REPLACE FUNCTION public.update_table_of_contents_item_position("itemId" integer, "parentStableId" text, "sortIndex" integer) RETURNS public.table_of_contents_items
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      pid int;
      parent_path ltree;
      current_path ltree;
      item table_of_contents_items;
    begin
      select project_id into pid from table_of_contents_items where id = "itemId" and is_draft = true;
      if pid is null then
        raise 'Could not find draft item with id = %', "itemId";
      end if;
      if session_is_admin(pid) = false then
        raise 'Permission denied';
      end if;
      select path into current_path from table_of_contents_items where id = "itemId" and is_draft = true;

      update table_of_contents_items set parent_stable_id = "parentStableId", sort_index = "sortIndex" where id = "itemId";
      -- TODO: handle movement of item into the root
      if "parentStableId" is not null then
        select path into parent_path from table_of_contents_items where is_draft = true and project_id = pid and stable_id = "parentStableId";
        if parent_path is null then
          raise 'Could not find valid parent with stable_id=%', "parentStableId";
        else
          update 
            table_of_contents_items 
          set path = parent_path || subpath(path, nlevel(current_path)-1) 
          where 
            is_draft = true and
            path <@ current_path;
        end if;
      else
        update 
          table_of_contents_items 
        set path = subpath(path, nlevel(current_path)-1) 
        where 
          is_draft = true and
          path <@ current_path;
      end if;
      select * into item from table_of_contents_items where id = "itemId";
      return item;
    end;
  $$;
