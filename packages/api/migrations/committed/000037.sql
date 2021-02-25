--! Previous: sha1:6857c8d88fe890b06ae6e87f8be5c799f84eef06
--! Hash: sha1:31f7edc657ff6f958fe8f428a9f3de3141b9da78

-- Enter migration here
drop policy if exists interactivity_settings_select on interactivity_settings;
create policy interactivity_settings_select on interactivity_settings using (
  true
);
