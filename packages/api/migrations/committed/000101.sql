--! Previous: sha1:77c37f9c23934689b111565948ee7ad4acfdc082
--! Hash: sha1:952d5fec32088d94503930cc9941e6e44b59b689

-- Enter migration here
COMMENT ON CONSTRAINT "sketch_classes_form_element_id_fkey" ON "public"."sketch_classes" IS '@omit many';
