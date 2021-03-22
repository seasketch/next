--! Previous: sha1:5173931e593ac45dce778294dc74b9fbfb35fa10
--! Hash: sha1:12fe1d500a9f3721cc49a531f8bb61af37dc5d5f

-- Enter migration here
drop policy if exists interactivity_settings_select on interactivity_settings;
create policy interactivity_settings_select on interactivity_settings using (
  true
);
