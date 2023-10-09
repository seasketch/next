--! Previous: sha1:23ddb518a2e6237f93687cd59c8f61886b489bff
--! Hash: sha1:d58147ce1546fa0b224b83bedd7ae4add0861a88

-- Enter migration here
CREATE OR REPLACE FUNCTION public.before_insert_or_update_table_of_contents_items_trigger() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  begin
    if old.is_folder != new.is_folder then
      raise 'Cannot change is_folder. Create a new table of contents item';
    end if;
    if old.is_draft = false then
      raise 'Cannot alter table of contents items after they are published';
    end if;
    if new.sort_index is null then
      new.sort_index = (select coalesce(max(sort_index), -1) + 1 from table_of_contents_items where is_draft = true and project_id = new.project_id and parent_stable_id = new.parent_stable_id or (parent_stable_id is null and new.parent_stable_id is null));
    end if;
    if old is null and new.is_draft = true then -- inserting
      -- verify that stable_id is unique among draft items
      if (select count(id) from table_of_contents_items where stable_id = new.stable_id and is_draft = true) > 0 then
        raise '% is not a unique stable_id.', new.stable_id;
      end if;
      -- set path
      if new.parent_stable_id is null then
        new.path = new.stable_id;
      else
        if (select count(id) from table_of_contents_items where is_draft = true and stable_id = new.parent_stable_id) > 0 then
          -- set path, finding path of parent and appending to it
          new.path = (select path from table_of_contents_items where is_draft = true and stable_id = new.parent_stable_id) || new.stable_id;
        else
          raise 'Cannot find parent item with stable_id=%', new.parent_stable_id;
        end if;
      end if;
    end if;
    if new.is_folder then
      if new.data_layer_id is not null then
        raise 'Folders cannot have data_layer_id set';
      end if;
      if new.metadata is not null then
        raise 'Folders cannot have metadata set';
      end if;
      if new.bounds is not null then
        raise 'Folders cannot have bounds set';
      end if;
    else
      if new.data_layer_id is null then
        raise 'data_layer_id must be set if is_folder=false';
      end if;
      if new.show_radio_children then
        raise 'show_radio_children must be false if is_folder=false';
      end if;
      if new.is_click_off_only then
        raise 'is_click_off_only must be false if is_folder=false';
      end if;
    end if;
    if length(trim(new.title)) = 0 then
      raise 'title cannot be empty';
    end if;
    return new;
  end;
$$;
