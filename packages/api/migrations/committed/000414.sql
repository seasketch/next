--! Previous: sha1:deda86fed4084042d4eba07a6eef3a610f6f1356
--! Hash: sha1:00b013be5df3d75815b4265eda681bd8171ce6a2

-- Enter migration here
create or replace function table_of_contents_items_change_logs(item table_of_contents_items)
  returns setof change_logs
  language sql
  security definer
  stable
  as $$
    select * from change_logs where entity_id = item.id and entity_type = 'table_of_contents_items' and net_zero_changes = false order by last_at desc;
  $$;

grant execute on function table_of_contents_items_change_logs(item table_of_contents_items) to seasketch_user;

comment on function table_of_contents_items_change_logs(item table_of_contents_items) is '@simpleCollections only';

create or replace function change_logs_editor_profile(changelog change_logs)
  returns user_profiles
  language sql
  security definer
  stable
  as $$
    select * from user_profiles where user_id = changelog.editor_id;
  $$;

grant execute on function change_logs_editor_profile(changelog change_logs) to seasketch_user;

drop function if exists trg_changelog_access_control_list_groups_layer_interactivity_ai cascade;

drop function if exists trg_changelog_access_control_list_groups_layer_interactivity_ad cascade;
