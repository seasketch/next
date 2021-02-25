--! Previous: sha1:ffffdd6d30627708d297ca735dbc4a40936252c4
--! Hash: sha1:6857c8d88fe890b06ae6e87f8be5c799f84eef06

drop policy if exists interactivity_settings_select on interactivity_settings;
create policy interactivity_settings_select on interactivity_settings using (
  session_has_project_access(
    coalesce((select project_id from data_layers where interactivity_settings_id = id), (select project_id from basemaps where interactivity_settings_id = id))
  )
);
