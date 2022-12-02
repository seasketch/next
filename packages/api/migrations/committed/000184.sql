--! Previous: sha1:04e7567d7e062316e66d36e900769f99095ad9f9
--! Hash: sha1:8af51f902029b1256157f1d0635e62c903db1d2a

-- Enter migration here
comment on table sketch_folders is '@omit create';
grant insert on sketch_folders to seasketch_user;
