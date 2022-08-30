--! Previous: sha1:37463c2e2e71faeb884d8bd2ae2cb2c57f4be730
--! Hash: sha1:7b108d1301658819009805cadf2edce9b9a8a178

-- Enter migration here
alter table user_profiles drop column if exists bio;
