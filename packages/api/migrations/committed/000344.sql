--! Previous: sha1:7b3014cc9d2637d62f0fee1b2ea18fb6d5266dc1
--! Hash: sha1:78bf70518119fa25c1cf0cda3d23d47c4936ea0d

-- Enter migration here
CREATE OR REPLACE FUNCTION public.replace_data_source(data_layer_id integer, data_source_id integer, source_layer text, bounds numeric[], gl_styles jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      old_source_id integer;
      old_source_type text;
      old_metadata_is_dynamic boolean;
      dl_template_id text;
    begin
        -- first, determine if a related table_of_contents_item has
        -- data_library_template_id set. If so, we need to update the
        -- related Toc items that have copied_from_data_library_template_id
        -- matching.

        select data_library_template_id into dl_template_id from table_of_contents_items where table_of_contents_items.data_layer_id = replace_data_source.data_layer_id and data_library_template_id is not null limit 1;


        select data_layers.data_source_id into old_source_id from data_layers where id = replace_data_source.data_layer_id;
        select type into old_source_type from data_sources where id = old_source_id;
        select metadata is null and (old_source_type = 'arcgis-vector' or old_source_type = 'arcgis-dynamic-mapserver') into old_metadata_is_dynamic from table_of_contents_items where table_of_contents_items.data_layer_id = replace_data_source.data_layer_id limit 1;
        insert into archived_data_sources (
          data_source_id,
          data_layer_id,
          version,
          mapbox_gl_style,
          changelog,
          source_layer,
          bounds,
          sublayer,
          sublayer_type,
          dynamic_metadata,
          project_id
        ) values (
          old_source_id,
          replace_data_source.data_layer_id,
          (
            select 
              coalesce(max(version), 0) + 1 
            from 
              archived_data_sources 
            where archived_data_sources.data_layer_id = replace_data_source.data_layer_id
          ),
          (
            select 
              mapbox_gl_styles
            from 
              data_layers 
            where id = replace_data_source.data_layer_id
          ),
          (select changelog from data_sources where id = replace_data_source.data_source_id),
          (select data_layers.source_layer from data_layers where data_layers.id = replace_data_source.data_layer_id),
          (select table_of_contents_items.bounds from table_of_contents_items where table_of_contents_items.data_layer_id = replace_data_source.data_layer_id and table_of_contents_items.bounds is not null limit 1),
          (select sublayer from data_layers where id = data_layer_id),
          (select sublayer_type from data_layers where id = data_layer_id),
          old_metadata_is_dynamic,
          (select project_id from data_sources where id = replace_data_source.data_source_id)
        );
        
        if dl_template_id is not null then
          update 
            data_sources
          set data_library_template_id = dl_template_id
          where 
          id = replace_data_source.data_source_id or
          id = any((
            select
              data_layers.data_source_id
            from
              data_layers
            where
              id = any (
                select
                  table_of_contents_items.data_layer_id
                from
                  table_of_contents_items
                where
                  copied_from_data_library_template_id = dl_template_id or
                  data_library_template_id = dl_template_id
              )
          )) or id = any ((
            select 
              data_layers.data_source_id 
            from
              data_layers
            where
              id = replace_data_source.data_layer_id 
          ));
        end if;

        update 
          data_layers 
        set 
          data_source_id = replace_data_source.data_source_id, 
          source_layer = replace_data_source.source_layer, 
          mapbox_gl_styles = coalesce(
            gl_styles, data_layers.mapbox_gl_styles
          ), 
          sublayer = null 
        where 
          id = replace_data_source.data_layer_id;

        if dl_template_id is not null then
          update
            data_layers
          set
            data_source_id = replace_data_source.data_source_id,
            source_layer = replace_data_source.source_layer
          where
            id = any (
              select table_of_contents_items.data_layer_id from table_of_contents_items where copied_from_data_library_template_id = dl_template_id
            );
        end if;
        
        update 
          table_of_contents_items 
        set bounds = replace_data_source.bounds 
        where 
          table_of_contents_items.data_layer_id = replace_data_source.data_layer_id or (
            case 
              when dl_template_id is not null then copied_from_data_library_template_id = dl_template_id
              else false
            end
          );
    end;
  $$;
