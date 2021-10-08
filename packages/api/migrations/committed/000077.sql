--! Previous: sha1:7f5b241539c0a9fd52824ffce6def3d3fb3b021c
--! Hash: sha1:35a7f940539212d8afd860d3df772321d68c22ce

-- Enter migration here

CREATE OR REPLACE FUNCTION public.before_insert_form_elements_func() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    begin
      new.position = (select coalesce(max(position), 0) + 1 from form_elements where form_id = new.form_id);
      return new;
    end;
  $$;

DROP TRIGGER IF EXISTS before_insert_form_elements on form_elements;
CREATE TRIGGER before_insert_form_elements BEFORE INSERT ON public.form_elements FOR EACH ROW EXECUTE FUNCTION public.before_insert_form_elements_func();
