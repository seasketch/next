--! Previous: sha1:8d0b7f1b2d42ef83de5c4c1835088a7cc3111e2a
--! Hash: sha1:69255ad304c205eab43cd0db6d0193bc403b8f8a

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

create or replace function table_of_contents_items_has_metadata(toc table_of_contents_items)
  returns boolean
  language sql
  security definer
  stable
  as $$
    select metadata is not null from table_of_contents_items where id = toc.id;
  $$;

grant execute on function table_of_contents_items_has_metadata(table_of_contents_items) to anon;
