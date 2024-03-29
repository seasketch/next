--! Previous: sha1:12c8706b5c07264e77a5dbf2cda1735de89d2687
--! Hash: sha1:e3e075792f9c7f7a2a7bc846ae9e083d68c0b0de

alter table interactivity_settings drop column if exists data_source_id cascade;
alter table interactivity_settings drop column if exists source_layer cascade;

alter table data_layers add column if not exists interactivity_settings_id integer not null unique references interactivity_settings (id);

drop policy if exists interactivity_settings_select on interactivity_settings;
create policy interactivity_settings_select on interactivity_settings using (
  session_has_project_access(
    (select project_id from data_layers where interactivity_settings_id = id)
  )
);

drop policy if exists interactivity_settings_admin on interactivity_settings;
create policy interactivity_settings_admin on interactivity_settings using (
  session_is_admin(
    (select project_id from data_layers where interactivity_settings_id = id)
  )
) with check (
  session_is_admin(
    (select project_id from data_layers where interactivity_settings_id = id)
  )
);

comment on column data_layers.interactivity_settings_id is '@omit create';

CREATE or replace FUNCTION public.publish_table_of_contents("projectId" integer) RETURNS SETOF public.table_of_contents_items
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
            interactivity_settings_id
          )
          select "projectId", 
            data_source_id, 
            source_layer, 
            sublayer, 
            render_under, 
            mapbox_gl_styles,
            new_interactivity_settings_id
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
          data_layer_id
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
          lid
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
          bucket_id,
          object_key,
          byte_length
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
          bucket_id,
          object_key,
          byte_length
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
      -- return items
      return query select * from table_of_contents_items 
        where project_id = "projectId" and is_draft = false;
    end;
  $$;


DROP TRIGGER IF EXISTS after_data_source_insert_create_interaction_settings ON data_sources;
drop function if exists after_data_source_insert_create_interaction_settings_trigger;


create or replace function before_layer_insert_create_interactivity_settings_func() 
  returns trigger 
  security definer
  language plpgsql
  as $$
    declare
      iid int;
    begin
      if new.interactivity_settings_id is null then
        insert into interactivity_settings (type) values ('NONE') returning id into iid;
        new.interactivity_settings_id = iid;
      end if;
      return new;
    end;
  $$;

DROP TRIGGER IF EXISTS before_layer_insert_create_interactivity_settings ON data_layers;
CREATE TRIGGER before_layer_insert_create_interactivity_settings
    BEFORE INSERT ON data_layers
    FOR EACH ROW EXECUTE PROCEDURE before_layer_insert_create_interactivity_settings_func();

CREATE INDEX ON data_layers (interactivity_settings_id);
