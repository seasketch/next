--! Previous: sha1:2c3687f0ef3ad551ea52c7259f1e8ed52677b2d1
--! Hash: sha1:ab079f30cd7bd38724ad2f66c10fb1c4add93c5b

-- Enter migration here
drop function if exists projects_downloadable_layers_count;
create or replace function projects_downloadable_layers_count(p projects)
  returns int
  language sql
  stable
  as $$
    select count(id)::int from table_of_contents_items where project_id = p.id and is_draft = true and is_folder = false and enable_download = true and table_of_contents_items_has_original_source_upload(table_of_contents_items.*);
  $$;

drop function if exists projects_eligable_downloadable_layers_count;
create or replace function projects_eligable_downloadable_layers_count(p projects)
  returns int
  language sql
  stable
  as $$
    select count(id)::int from table_of_contents_items where project_id = p.id and is_draft = true and is_folder = false and enable_download = false and table_of_contents_items_has_original_source_upload(table_of_contents_items.*);
  $$;

grant execute on function projects_downloadable_layers_count(projects) to seasketch_user;

grant execute on function projects_eligable_downloadable_layers_count(projects) to seasketch_user;
