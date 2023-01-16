--! Previous: sha1:b54dde8fd34916cedc7807b2b6a51f9dd3f67043
--! Hash: sha1:9f58404e9fa0dc6afd8dcea3ce196f7702f72b8a

-- Enter migration here
drop function if exists get_parent_collection;
DROP TRIGGER IF EXISTS set_parent_collection_updated_at on sketches;
drop function if exists trigger_update_collection_updated_at;

CREATE OR REPLACE FUNCTION get_parent_collection_id(type sketch_child_type, parent_id integer)
  returns int
  language plpgsql
  security definer
  AS $$
    declare
      col int;
      folder int;
    begin
      if type = 'sketch' then
        select collection_id, folder_id into col, folder from sketches where id = parent_id;
      else
        select collection_id, folder_id into col, folder from sketch_folders where id = parent_id;
      end if;
      if col is not null then
        return col;
      elsif folder is not null then
        return get_parent_collection_id('sketch_folder', folder);
      else
        return null;
      end if;
    end;
  $$;


grant execute on function get_parent_collection_id to seasketch_user;
comment on function get_parent_collection_id is 'omit';

DROP TRIGGER IF EXISTS set_parent_collection_updated_at on sketches;

CREATE OR REPLACE FUNCTION trigger_update_collection_updated_at()
RETURNS TRIGGER 
security definer
AS $$
DECLARE
  sketch_collection_id int;
BEGIN
  -- get parent collection if exists
  select get_parent_collection_id('sketch', NEW.id) into sketch_collection_id;
  if sketch_collection_id is not null then
    update sketches set updated_at = now() where id = sketch_collection_id;
  end if;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_parent_collection_updated_at
AFTER UPDATE ON sketches
FOR EACH ROW
EXECUTE PROCEDURE trigger_update_collection_updated_at();

create or replace function sketches_parent_collection(sketch sketches)
  returns sketches
  security definer
  language sql
  stable
  as $$
    select * from sketches where id = get_parent_collection_id('sketch', sketch.id);
  $$;
  
grant execute on function sketches_parent_collection to anon;
