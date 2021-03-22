--! Previous: sha1:29d90e32fdb447d6d4ec6b9ec5218a695ec792e9
--! Hash: sha1:5173931e593ac45dce778294dc74b9fbfb35fa10

drop policy if exists interactivity_settings_select on interactivity_settings;
create policy interactivity_settings_select on interactivity_settings using (
  session_has_project_access(
    coalesce((select project_id from data_layers where interactivity_settings_id = id), (select project_id from basemaps where interactivity_settings_id = id))
  )
);
