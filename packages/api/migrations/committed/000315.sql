--! Previous: sha1:e8c7237416717fb258be458aa353c2543f361341
--! Hash: sha1:9eb15c93c4ae2332846400a7c7750a68865026f6

-- Enter migration here
alter table projects alter column data_hosting_quota set default 10737418240;
