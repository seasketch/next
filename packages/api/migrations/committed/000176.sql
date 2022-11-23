--! Previous: sha1:5def7d83c1e2a810d3d9b20f4ee7fcdac614e843
--! Hash: sha1:3cacb43cdebf3337d693c9db7d887ce2c27d8fcc

-- Enter migration here
CREATE OR REPLACE FUNCTION public.before_update_sketch_class_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    begin
      if NEW.geometry_type != OLD.geometry_type then
        raise exception 'Cannot change geometry type of a sketch class';
      end if;
      return NEW;
    end;
  $$;

drop trigger if exists sketch_classes_before_update on sketch_classes;
CREATE TRIGGER sketch_classes_before_update BEFORE UPDATE ON public.sketch_classes FOR EACH ROW EXECUTE FUNCTION public.before_update_sketch_class_trigger();
