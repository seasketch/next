--! Previous: sha1:3cacb43cdebf3337d693c9db7d887ce2c27d8fcc
--! Hash: sha1:e30b288ff540e0832271bd94dbfa6b856535ad8b

-- Enter migration here
CREATE OR REPLACE FUNCTION public.before_update_sketch_class_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    begin
      if NEW.geometry_type != OLD.geometry_type and NEW.form_element_id is null then
        raise exception 'Cannot change geometry type of a sketch class';
      end if;
      return NEW;
    end;
  $$;
