--! Previous: sha1:952d5fec32088d94503930cc9941e6e44b59b689
--! Hash: sha1:12e2f1de62cac0715dbce2bc942d5d1d104004b4

-- Enter migration here
COMMENT ON CONSTRAINT "sketch_classes_form_element_id_fkey" ON "public"."sketch_classes" IS '
@foreignSingleFieldName sketchClassFk
@omit many
';
