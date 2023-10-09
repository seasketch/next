--! Previous: sha1:ea8ae304e156cf71e4f10e14405185beed90fd3f
--! Hash: sha1:367bf26983ec140b3c29c999cbde0ea4551a93f3

-- Enter migration here
-- create an after update trigger that monitors data_layers
-- and sets the draft_table_of_contents_has_changes column on the
-- related projects of the table_of_contents_items that are related to the
-- data_source based on table_of_contents_item.data_layer_id
create or replace function after_data_layers_update_or_delete_set_draft_table_of_contents_has_changes()
returns trigger 
security definer
as $$
begin
  update projects
  set draft_table_of_contents_has_changes = true
  where id in (
    select 
      tocs.project_id
    from 
      table_of_contents_items as tocs
    where 
      tocs.data_layer_id = old.id
  );
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists after_data_layers_update_or_delete_set_draft_table_of_contents_has_changes on data_layers;
create trigger after_data_layers_update_or_delete_set_draft_table_of_contents_has_changes
after update or delete on data_layers
for each row execute procedure after_data_layers_update_or_delete_set_draft_table_of_contents_has_changes();

-- Do the same for data_sources
create or replace function after_data_sources_update_or_delete_set_draft_table_of_contents_has_changes()
returns trigger 
security definer
as $$
begin
  update projects
  set draft_table_of_contents_has_changes = true
  where id in (
    select 
      tocs.project_id
    from 
      table_of_contents_items as tocs
    where 
      tocs.data_layer_id in (
        select data_layers.id from data_layers where data_layers.data_source_id = old.id
      )
    );
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists after_data_sources_update_or_delete_set_draft_table_of_contents_has_changes on data_sources;
create trigger after_data_sources_update_or_delete_set_draft_table_of_contents_has_changes
after update or delete on data_sources
for each row execute procedure after_data_sources_update_or_delete_set_draft_table_of_contents_has_changes();
