--! Previous: sha1:79b8e45c7b33774e6b61ff71a062d430eae3af38
--! Hash: sha1:3e66094de2ed6349dcd3c24d4b3cc0b3d3091a69

-- Enter migration here
-- TODO:
-- * [x] update collection updatedAt if child sketch is added
-- * [nope] update collection if child sketch is removed
-- * [] update collection if child sketch is deleted 
-- * [x] update collection if child sketch is edited
DROP trigger if exists set_parent_collection_updated_at on sketches; 

CREATE OR REPLACE FUNCTION bump_parent_collection_updated_at(folderId int, collectionId int)
  returns boolean
  language plpgsql
  security definer
  as $$
    declare
      fid int;
      cid int;
    begin
      if collectionId is not null then
        update sketches set updated_at = now() where id = collectionId;
        return true;
      end if;
      if folderId is not null then
        select folder_id, collection_id into fid, cid from sketch_folders where id = folderId;
        perform bump_parent_collection_updated_at(fid, cid);
      end if;
      return true;
    end;
  $$;

CREATE OR REPLACE FUNCTION public.trigger_update_collection_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  if TG_OP = 'UPDATE' or TG_OP = 'DELETE' then
    -- being deleted or updated. find the previous collection
    perform bump_parent_collection_updated_at(OLD.folder_id, OLD.collection_id);
  end if;
  if TG_OP = 'UPDATE' or TG_OP = 'INSERT' then
    -- being inserted or updated
    perform bump_parent_collection_updated_at(NEW.folder_id, NEW.collection_id);
  end if;
  if TG_OP = 'UPDATE' or TG_OP = 'INSERT' then
    RETURN NEW;
  else
    RETURN OLD;
  end if;
END;
$$;

CREATE TRIGGER set_parent_collection_updated_at BEFORE UPDATE OR INSERT OR DELETE ON public.sketches FOR EACH ROW WHEN (pg_trigger_depth() = 0) EXECUTE FUNCTION public.trigger_update_collection_updated_at();

-- * [] update collection if folder full of sketches is dropped into collection (or subfolder of collection)

CREATE OR REPLACE FUNCTION public.trigger_update_collection_updated_at_for_sketch_folder() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    has_sketches boolean;
  begin
    if TG_OP = 'UPDATE' or TG_OP = 'DELETE' then
      select array_length(get_child_sketches_recursive(OLD.id, 'sketch_folder'), 1) > 0 into has_sketches;
      if has_sketches then
        -- being deleted or updated. find the previous collection
        perform bump_parent_collection_updated_at(OLD.folder_id, OLD.collection_id);
      end if;
    end if;
    if TG_OP = 'UPDATE' or TG_OP = 'INSERT' then
      select array_length(get_child_sketches_recursive(OLD.id, 'sketch_folder'), 1) > 0 into has_sketches;
      -- being inserted or updated
      if has_sketches then
        perform bump_parent_collection_updated_at(NEW.folder_id, NEW.collection_id);
      end if;
    end if;
    if TG_OP = 'UPDATE' or TG_OP = 'INSERT' then
      RETURN NEW;
    else
      RETURN OLD;
    end if;
  END;
$$;

drop trigger if exists set_parent_collection_updated_at_sketch_folders on sketch_folders;

CREATE TRIGGER set_parent_collection_updated_at_sketch_folders BEFORE UPDATE OR INSERT OR DELETE ON public.sketch_folders FOR EACH ROW WHEN (pg_trigger_depth() = 0) EXECUTE FUNCTION public.trigger_update_collection_updated_at_for_sketch_folder();
