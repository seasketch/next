--! Previous: sha1:b902a63dcd37833df44fe36cc671ecfcffbc3587
--! Hash: sha1:b236b5c769cf958ca1cacc6521ed45e7b4ae75af

-- Enter migration here
drop index if exists projects_name_idx;
-- Adding so that we can get orderBy working on projects connection
create index projects_name_idx on projects(name);
