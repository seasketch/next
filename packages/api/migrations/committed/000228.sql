--! Previous: sha1:b236b5c769cf958ca1cacc6521ed45e7b4ae75af
--! Hash: sha1:423bbf448047127c3efe3d3f707c3bf292c5bdf5

-- Enter migration here
alter table sketches drop constraint if exists sketches_response_id_fkey;
alter table sketches add constraint sketches_response_id_fkey FOREIGN KEY (response_id) REFERENCES survey_responses(id) ON DELETE CASCADE DEFERRABLE;
