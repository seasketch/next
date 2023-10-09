--! Previous: sha1:e3f0e93b74596af2758d245047060587ded98a81
--! Hash: sha1:ea8ae304e156cf71e4f10e14405185beed90fd3f

-- Enter migration here

alter table projects add column if not exists draft_table_of_contents_has_changes boolean not null default false;

grant select (draft_table_of_contents_has_changes) on table projects to anon;

create or replace function table_of_contents_items_project(t table_of_contents_items)
  returns projects
  language sql
  security definer
  stable
  as $$
    select * from projects where id = t.project_id;
  $$;

grant execute on function table_of_contents_items_project(t table_of_contents_items) to anon;

-- trigger function sets project.draft_table_of_contents_has_changes to true when table_of_contents_items
-- are inserted, updated, or deleted
drop function if exists table_of_contents_items_project_update cascade;
drop trigger if exists table_of_contents_items_project_update on projects;
create or replace function table_of_contents_items_project_update()
  returns trigger
  language plpgsql
  security definer
  as $$
    begin
      if tg_op = 'INSERT' or tg_op = 'UPDATE' or tg_op = 'DELETE' then
        update projects set draft_table_of_contents_has_changes = true where id = NEW.project_id;
      end if;
      return NEW;
    end;
  $$;

create trigger table_of_contents_items_project_update
  after insert or update or delete on table_of_contents_items
  for each row execute procedure table_of_contents_items_project_update();



CREATE OR REPLACE FUNCTION public.publish_table_of_contents("projectId" integer) RETURNS SETOF public.table_of_contents_items
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      lid int;
      item table_of_contents_items;
      source_id int;
      copied_source_id int;
      acl_type access_control_list_type;
      acl_id int;
      orig_acl_id int;
      new_toc_id int;
      new_interactivity_settings_id int;
    begin
      -- check permissions
      if session_is_admin("projectId") = false then
        raise 'Permission denied. Must be a project admin';
      end if;
      -- delete existing published table of contents items, layers, sources, and interactivity settings
      delete from 
        interactivity_settings 
      where
        id in (
          select 
            data_layers.interactivity_settings_id
          from
            data_layers
          inner JOIN
            table_of_contents_items
          on
            data_layers.id = table_of_contents_items.data_layer_id
          where
            table_of_contents_items.project_id = "projectId" and
            is_draft = false
        );

      delete from data_sources where data_sources.id in (
        select 
          data_source_id 
        from
          data_layers
        inner JOIN
          table_of_contents_items
        on
          data_layers.id = table_of_contents_items.data_layer_id
        where
          table_of_contents_items.project_id = "projectId" and
          is_draft = false
      );
      delete from data_layers where id in (
        select 
          data_layer_id 
        from 
          table_of_contents_items 
        where 
          project_id = "projectId" and
          is_draft = false
      );
      delete from 
        table_of_contents_items 
      where 
        project_id = "projectId" and 
        is_draft = false;

      -- one-by-one, copy related layers and link table of contents items
      for item in 
        select 
          * 
        from 
          table_of_contents_items 
        where 
          is_draft = true and 
          project_id = "projectId"
      loop
        if item.is_folder = false then
          -- copy interactivity settings first
          insert into interactivity_settings (
            type,
            short_template,
            long_template,
            cursor
          ) select
              type,
              short_template,
              long_template,
              cursor
            from
              interactivity_settings
            where
              interactivity_settings.id = (
                select interactivity_settings_id from data_layers where data_layers.id = item.data_layer_id
              )
            returning
              id
            into
              new_interactivity_settings_id;

          insert into data_layers (
            project_id,
            data_source_id,
            source_layer,
            sublayer,
            render_under,
            mapbox_gl_styles,
            interactivity_settings_id,
            z_index
          )
          select "projectId", 
            data_source_id, 
            source_layer, 
            sublayer, 
            render_under, 
            mapbox_gl_styles,
            new_interactivity_settings_id,
            z_index
          from 
            data_layers
          where 
            id = item.data_layer_id
          returning id into lid;
        else
          lid = item.data_layer_id;
        end if;
        -- TODO: this will have to be modified with the addition of any columns
        insert into table_of_contents_items (
          is_draft,
          project_id,
          path,
          stable_id,
          parent_stable_id,
          title,
          is_folder,
          show_radio_children,
          is_click_off_only,
          metadata,
          bounds,
          data_layer_id,
          sort_index,
          hide_children,
          geoprocessing_reference_id,
          translated_props
        ) values (
          false,
          "projectId",
          item.path,
          item.stable_id,
          item.parent_stable_id,
          item.title,
          item.is_folder,
          item.show_radio_children,
          item.is_click_off_only,
          item.metadata,
          item.bounds,
          lid,
          item.sort_index,
          item.hide_children,
          item.geoprocessing_reference_id,
          item.translated_props
        ) returning id into new_toc_id;
        select 
          type, id into acl_type, orig_acl_id 
        from 
          access_control_lists 
        where 
          table_of_contents_item_id = (
            select 
              id 
            from 
              table_of_contents_items 
            where is_draft = true and stable_id = item.stable_id
          );
        -- copy access control list settings
        if acl_type != 'public' then
          update 
            access_control_lists 
          set type = acl_type 
          where table_of_contents_item_id = new_toc_id 
          returning id into acl_id;
          if acl_type = 'group' then
            insert into 
              access_control_list_groups (
                access_control_list_id, 
                group_id
              ) 
            select 
              acl_id, 
              group_id 
            from 
              access_control_list_groups 
            where 
              access_control_list_id = orig_acl_id;
          end if;
        end if;
      end loop;
      -- one-by-one, copy related sources and update foreign keys of layers
      for source_id in
        select distinct(data_source_id) from data_layers where id in (
          select 
            data_layer_id 
          from 
            table_of_contents_items 
          where 
            is_draft = false and 
            project_id = "projectId" and 
            is_folder = false
        )
      loop
        -- TODO: This function will have to be updated whenever the schema 
        -- changes since these columns are hard coded... no way around it.
        insert into data_sources (
          project_id,
          type,
          attribution,
          bounds,
          maxzoom,
          minzoom,
          url,
          scheme,
          tiles,
          tile_size,
          encoding,
          buffer,
          cluster,
          cluster_max_zoom,
          cluster_properties,
          cluster_radius,
          generate_id,
          line_metrics,
          promote_id,
          tolerance,
          coordinates,
          urls,
          query_parameters,
          use_device_pixel_ratio,
          import_type,
          original_source_url,
          enhanced_security,
          byte_length,
          supports_dynamic_layers,
          uploaded_source_filename,
          uploaded_source_layername,
          normalized_source_object_key,
          normalized_source_bytes,
          geostats,
          upload_task_id,
          translated_props
        )
          select 
            "projectId", 
          type,
          attribution,
          bounds,
          maxzoom,
          minzoom,
          url,
          scheme,
          tiles,
          tile_size,
          encoding,
          buffer,
          cluster,
          cluster_max_zoom,
          cluster_properties,
          cluster_radius,
          generate_id,
          line_metrics,
          promote_id,
          tolerance,
          coordinates,
          urls,
          query_parameters,
          use_device_pixel_ratio,
          import_type,
          original_source_url,
          enhanced_security,
          byte_length,
          supports_dynamic_layers,
          uploaded_source_filename,
          uploaded_source_layername,
          normalized_source_object_key,
          normalized_source_bytes,
          geostats,
          upload_task_id,
          translated_props
          from 
            data_sources 
          where
            id = source_id
          returning id into copied_source_id;
        -- update data_layers that should now reference the copy
        update 
          data_layers 
        set data_source_id = copied_source_id 
        where 
          data_source_id = source_id and
          data_layers.id in ((
            select distinct(data_layer_id) from table_of_contents_items where is_draft = false and 
            project_id = "projectId" and 
            is_folder = false
          ));
      end loop;
      update projects set draft_table_of_contents_has_changes = false where id = "projectId";
      -- return items
      return query select * from table_of_contents_items 
        where project_id = "projectId" and is_draft = false;
    end;
  $$;

-- Create a database trigger which monitors for changes of the value of draft_table_of_contents_has_changes column on projects
-- and calls pg_notify() to notify the application of the change.
drop trigger if exists draft_table_of_contents_has_changes_trigger on projects;
create or replace function draft_table_of_contents_has_changes_notify()
  returns trigger as
  $$
  begin
    if NEW.draft_table_of_contents_has_changes != OLD.draft_table_of_contents_has_changes then
      perform pg_notify(concat('graphql:project:', NEW.slug, ':toc_draft_changed'), json_build_object('projectId', NEW.id, 'hasChanges', NEW.draft_table_of_contents_has_changes)::text);
    end if;
    return NEW;
  end;
  $$ language plpgsql;


create trigger draft_table_of_contents_has_changes_trigger
  after update of draft_table_of_contents_has_changes
  on projects
  for each row
  execute procedure draft_table_of_contents_has_changes_notify();



-- create an after update trigger that monitors access_control_lists with a related table_of_contents_item_id
-- and set the draft_table_of_contents_has_changes column on projects to true 
-- if the access_control_lists table is updated
create or replace function acl_update_draft_toc_has_changes()
  returns trigger 
  security definer
  as
  $$
  begin
    update projects set draft_table_of_contents_has_changes = true where id = (
      select project_id from table_of_contents_items where id = (
        select table_of_contents_item_id from access_control_lists where id = NEW.id
      )
    );
    return NEW;
  end;
  $$ language plpgsql;

drop trigger if exists acl_update_draft_toc_has_changes_trigger on access_control_lists;
create trigger acl_update_draft_toc_has_changes_trigger
  after update
  on access_control_lists
  for each row
  execute procedure acl_update_draft_toc_has_changes();
