--! Previous: sha1:bd8902de3b220ac9581d5b10d4c116386ba4970b
--! Hash: sha1:2eb7a66616b330a040e83062683185834e71b316

-- Enter migration here
DROP POLICY IF EXISTS sketches_select on sketches;
CREATE POLICY sketches_select ON public.sketches FOR SELECT USING (public.it_me(user_id) or session_is_admin(project_id_from_field_id(form_element_id)));
