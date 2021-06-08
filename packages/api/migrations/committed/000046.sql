--! Previous: sha1:c0c5aad37487a70295f45f9c97cd6ade88e51f5e
--! Hash: sha1:32f255d8b7c2dd750009f0335e21d2808e226862

-- Enter migration here
alter table project_groups drop constraint if exists namechk;
alter table project_groups add constraint namechk CHECK (char_length(name) <= 32 and char_length(name) > 0);
