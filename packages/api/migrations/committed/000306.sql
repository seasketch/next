--! Previous: sha1:dc413a01d183f4ae248539e9d32ab3bdf99bd9f7
--! Hash: sha1:63ba0b9a11ac5bfd9fb712035ad2a0b6e050b7b4

-- Enter migration here
alter table data_sources drop column if exists user_id;
