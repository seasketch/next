--! Previous: sha1:2909fcb3ba5cfe63a2df0399a500636d8cc3ce5f
--! Hash: sha1:d2692d59e6e1def03a6986a27afdd152cd348d2e

-- Enter migration here
ALTER TABLE projects ALTER COLUMN access_control SET NOT NULL;
ALTER TABLE projects ALTER COLUMN is_listed SET NOT NULL;
ALTER TABLE projects ALTER COLUMN is_featured SET NOT NULL;
ALTER TABLE projects ALTER COLUMN is_deleted SET NOT NULL;
