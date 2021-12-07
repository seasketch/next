--! Previous: sha1:12e2f1de62cac0715dbce2bc942d5d1d104004b4
--! Hash: sha1:f69ac42284fe2f65421128f7d4eb2ff2e0fb01ba

-- Enter migration here
COMMENT ON TABLE "public"."posts" IS E'@omit create';

COMMENT ON TABLE "public"."projects" IS '
@omit create,delete
SeaSketch Project type. This root type contains most of the fields and queries
needed to drive the application.
';

COMMENT ON TABLE "public"."survey_responses" IS E'@omit create';

COMMENT ON TABLE "public"."topics" IS E'@omit create';
COMMENT ON TABLE "public"."posts" IS E'@omit create,update';

COMMENT ON FUNCTION _create_sketch_class is '@omit';
COMMENT ON FUNCTION _create_survey is '@omit';
COMMENT ON FUNCTION _delete_table_of_contents_item is '@omit';
