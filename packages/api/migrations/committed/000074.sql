--! Previous: sha1:62b5e2158ca83a406b93f328d06dcf35e938cdb4
--! Hash: sha1:b5d8c88fbd2f3104dbb36adcb8af92d9bfa2e272

-- Enter migration here
COMMENT ON CONSTRAINT "form_fields_form_id_fkey" ON "public"."form_elements" IS E'@omit';
