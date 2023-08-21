--! Previous: sha1:a2d7e945f59ba9410fd788737c39b7fe309da953
--! Hash: sha1:acd2eb02f23d791fc4ea756a1a10237ad922559b

-- Enter migration here
--! Previous: sha1:ac2da08fddc58b86bf51f8e4cca890972fab5689
--! Hash: sha1:a2d7e945f59ba9410fd788737c39b7fe309da953

-- Enter migration here
drop trigger if exists before_sketch_update_touch_parent_updated_at_trigger on sketches;
CREATE OR REPLACE FUNCTION public.get_parent_collection_id(sketch sketches) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      col int;
      folder int;
    begin
      if sketch.collection_id is not null then
        return sketch.collection_id;
      elsif sketch.folder_id is not null then
        return get_parent_collection_id('sketch_folder', sketch.folder_id);
      else
        return null;
      end if;
    end;
  $$;

CREATE OR REPLACE FUNCTION public.trigger_update_collection_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  sketch_collection_id int;
  previous_sketch_collection_id int;
BEGIN
  -- get parent collection if exists
  select get_parent_collection_id(NEW) into sketch_collection_id;
  select get_parent_collection_id(OLD) into previous_sketch_collection_id;
  -- raise notice 'sketch_collection_id: %, previous_sketch_collection_id: %', sketch_collection_id, previous_sketch_collection_id;
  if sketch_collection_id is not null then
    -- raise exception 'passes! %, %', sketch_collection_id, now();
    update sketches set updated_at = now() where id = sketch_collection_id;
  end if;
  if previous_sketch_collection_id is not null and ((sketch_collection_id is null) or (previous_sketch_collection_id != sketch_collection_id)) then
    -- raise exception 'passes! b %', previous_sketch_collection_id;
    update sketches set updated_at = now() where id = previous_sketch_collection_id;
  end if;
  RETURN NEW;
END;
$$;

comment on function get_parent_collection_id(sketches) is '@omit';
comment on function get_parent_collection_id(sketch_child_type, int) is '@omit';
