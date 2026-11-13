--! Previous: sha1:ea5df722213b0672c01c7cbaaba352b1d84fb4df
--! Hash: sha1:86fc49f222eb6694e249d5d8e17d1aaabb9b0645

-- Lock survey sketch-class geometry once any sketch has been saved.
-- Planning sketch classes stay immutable. Empty survey questions can still
-- switch between polygon and point.

CREATE OR REPLACE FUNCTION public.before_update_sketch_class_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    begin
      if NEW.geometry_type != OLD.geometry_type then
        if NEW.form_element_id is null then
          raise exception 'Cannot change geometry type of a sketch class';
        elsif exists (
          select 1 from sketches where sketch_class_id = NEW.id
        ) then
          raise exception 'Cannot change geometry type after sketches have been collected';
        end if;
      end if;
      return NEW;
    end;
  $$;

GRANT ALL ON FUNCTION public.sketch_classes_sketch_count(sketch_class public.sketch_classes) TO seasketch_user;
