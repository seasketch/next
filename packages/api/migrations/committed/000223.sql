--! Previous: sha1:ded79908099093a62a388b51993e90170cedfcb9
--! Hash: sha1:b9b45afa60d466397e8a3729e1920a303549adb2

-- Enter migration here
drop trigger if exists set_parent_collection_updated_at on sketches;

CREATE OR REPLACE FUNCTION public.trigger_update_collection_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
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
$$;

create trigger set_parent_collection_updated_at after INSERT OR DELETE OR UPDATE ON sketches FOR EACH ROW WHEN (pg_trigger_depth() = 0) EXECUTE FUNCTION trigger_update_collection_updated_at();
