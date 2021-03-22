--! Previous: sha1:a3a9228335c887a67534b4e4d11ee87bbb5f8fbc
--! Hash: sha1:abb03e2cb26cae081514482d9ecb6df6961f91c9

-- Enter migration here
ALTER TABLE projects ALTER COLUMN access_control SET NOT NULL;
ALTER TABLE projects ALTER COLUMN is_listed SET NOT NULL;
ALTER TABLE projects ALTER COLUMN is_featured SET NOT NULL;
ALTER TABLE projects ALTER COLUMN is_deleted SET NOT NULL;
