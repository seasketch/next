--! Previous: sha1:ee3faa87e262b601b114b7407eeac3669bfc3a09
--! Hash: sha1:a2c3d56e79044e22cab47c18a8d1667aae68ac61

-- Enter migration here

comment on function _session_on_toc_item_acl is '@omit';

drop function if exists update_table_of_contents_item_parent;

CREATE OR REPLACE FUNCTION public.update_table_of_contents_item_position("itemId" integer, "parentStableId" text, "sortIndex" integer) 
    RETURNS public.table_of_contents_items
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      pid int;
      parent_path ltree;
      current_path ltree;
      item table_of_contents_items;
    begin
      select project_id into pid from table_of_contents_items where id = "itemId" and is_draft = true;
      if pid is null then
        raise 'Could not find draft item with id = %', "itemId";
      end if;
      if session_is_admin(pid) = false then
        raise 'Permission denied';
      end if;
      select path into current_path from table_of_contents_items where id = "itemId" and is_draft = true;

      update table_of_contents_items set parent_stable_id = "parentStableId", sort_index = "sortIndex" where id = "itemId";
      -- TODO: handle movement of item into the root
      if "parentStableId" is not null then
        select path into parent_path from table_of_contents_items where is_draft = true and project_id = pid and stable_id = "parentStableId";
        if parent_path is null then
          raise 'Could not find valid parent with stable_id=%', "parentStableId";
        else
          update 
            table_of_contents_items 
          set path = parent_path || subpath(path, nlevel(current_path)-1) 
          where path <@ current_path;
        end if;
      else
        update 
          table_of_contents_items 
        set path = subpath(path, nlevel(current_path)-1) 
        where path <@ current_path;
      end if;
      select * into item from table_of_contents_items where id = "itemId";
      return item;
    end;
  $$;

CREATE OR REPLACE FUNCTION public.update_table_of_contents_item_parent("itemId" integer, "parentStableId" text)
    RETURNS public.table_of_contents_items
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    begin
      return update_table_of_contents_item_position("itemId", "parentStableId", 0);
    end;
  $$;

grant execute on function update_table_of_contents_item_parent to seasketch_user;

comment on function update_table_of_contents_item_parent is '@omit';
comment on function update_table_of_contents_item_position is '@omit';

create or replace function update_table_of_contents_item_children("parentId" int, "childIds" int[])
  returns setof table_of_contents_items
  language plpgsql security definer
  as $$
    declare
      "parentStableId" text;
      "maxRootSortIndex" int;
      "projectId" int;
      item table_of_contents_items;
    begin
      select project_id into "projectId" from table_of_contents_items where id = "parentId" or id = "childIds"[1] limit 1;
      if "projectId" is null then
        raise 'Could not find draft item with id = %', "parentId";
      end if;
      if session_is_admin("projectId") = false then
        raise 'Permission denied';
      end if;
      if (select count(id) from table_of_contents_items where project_id != "projectId" and id = any("childIds")) > 0 then
        raise 'Permission denied. Not all items in project';
      end if;
      select stable_id into "parentStableId" from table_of_contents_items where id = "parentId";
      -- clear any parent id associations for children that are no longer in the list (unrooted)
      select max(sort_index) into "maxRootSortIndex" from table_of_contents_items where is_draft = true and project_id = "projectId" and parent_stable_id = null;
      -- update paths, sort index of "unrooted" items
      for item in select * from table_of_contents_items where parent_stable_id = "parentStableId" and is_draft = true and id != any("childIds") loop
        "maxRootSortIndex" = "maxRootSortIndex" + 1;
        perform update_table_of_contents_item_position(item.id, null, "maxRootSortIndex");
      end loop;
      -- Update position (parent & sort_index) of listed children
      for i in array_lower("childIds", 1)..array_upper("childIds", 1) loop
        perform update_table_of_contents_item_position("childIds"[i], "parentStableId", i - 1);
      end loop;
      -- select * into children from table_of_contents_items where id = any("childIds");
      -- return children;
      return query select * from table_of_contents_items where id = any("childIds");
    end;
$$;

grant execute on function update_table_of_contents_item_position to seasketch_user;
grant execute on function update_table_of_contents_item_children(int, int[]) to seasketch_user;

drop function if exists update_table_of_contents_item_children(int[]);
-- create or replace function update_table_of_contents_item_children("childIds" int[])
--   returns setof table_of_contents_items
--   language plpgsql security definer
--   as $$
--     declare
--       "maxRootSortIndex" int;
--       "projectId" int;
--       item table_of_contents_items;
--     begin
--       select project_id into "projectId" from table_of_contents_items where id = "childIds"[1];
--       if "projectId" is null then
--         raise 'Could not find draft item with id = %', "childIds"[1];
--       end if;
--       if session_is_admin("projectId") = false then
--         raise 'Permission denied';
--       end if;
--       if (select count(id) from table_of_contents_items where project_id != "projectId" and id = any("childIds")) > 0 then
--         raise 'Permission denied. Not all items in project';
--       end if;
--       select max(sort_index) into "maxRootSortIndex" from table_of_contents_items where is_draft = true and project_id = "projectId" and parent_stable_id = null and id != any("childIds");
--       for i in array_lower("childIds", 1)..array_upper("childIds", 1) loop
--         "maxRootSortIndex" = "maxRootSortIndex" + 1;
--         perform update_table_of_contents_item_position("childIds"[i], null, "maxRootSortIndex");
--       end loop;
--       return query select * from table_of_contents_items where id = any("childIds");
--     end;
-- $$;

-- grant execute on function update_table_of_contents_item_children(int[]) to seasketch_user;



-- alter table table_of_contents_items drop column if exists sort_index;
alter table table_of_contents_items add column if not exists sort_index int not null;
comment on column table_of_contents_items.sort_index is 'Position in the layer list';

grant select(sort_index) on table_of_contents_items to anon;
revoke insert(sort_index) on table_of_contents_items from seasketch_user;
revoke update(sort_index) on table_of_contents_items from seasketch_user;


CREATE or replace FUNCTION public.before_insert_or_update_table_of_contents_items_trigger() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  begin
    if old.is_folder != new.is_folder then
      raise 'Cannot change is_folder. Create a new table of contents item';
    end if;
    if old.is_draft = false then
      raise 'Cannot alter table of contents items after they are published';
    end if;
    if new.sort_index is null then
      new.sort_index = (select coalesce(max(sort_index), -1) + 1 from table_of_contents_items where is_draft = true and project_id = new.project_id and parent_stable_id = new.parent_stable_id or (parent_stable_id is null and new.parent_stable_id is null));
    end if;
    if old is null and new.is_draft = true then -- inserting
      -- verify that stable_id is unique among draft items
      if (select count(id) from table_of_contents_items where stable_id = new.stable_id and is_draft = true) > 0 then
        raise '% is not a unique stable_id.', new.stable_id;
      end if;
      -- set path
      if new.parent_stable_id is null then
        new.path = new.stable_id;
      else
        if (select count(id) from table_of_contents_items where is_draft = true and stable_id = new.parent_stable_id) > 0 then
          -- set path, finding path of parent and appending to it
          new.path = (select path from table_of_contents_items where is_draft = true and stable_id = new.parent_stable_id) || new.stable_id;
        else
          raise 'Cannot find parent item with stable_id=%', new.parent_stable_id;
        end if;
      end if;
    end if;
    if new.is_folder then
      if new.data_layer_id is not null then
        raise 'Folders cannot have data_layer_id set';
      end if;
      if new.metadata is not null then
        raise 'Folders cannot have metadata set';
      end if;
      if new.bounds is not null then
        raise 'Folders cannot have bounds set';
      end if;
    else
      if new.data_layer_id is null then
        raise 'data_layer_id must be set if is_folder=false';
      end if;
      if new.show_radio_children then
        raise 'show_radio_children must be false if is_folder=false';
      end if;
      if new.is_click_off_only then
        raise 'is_click_off_only must be false if is_folder=false';
      end if;
    end if;
    return new;
  end;
$$;


alter table table_of_contents_items add column if not exists hide_children boolean not null default false;

grant update (hide_children) on table_of_contents_items to seasketch_user;
grant insert (hide_children) on table_of_contents_items to seasketch_user;
grant select (hide_children) on table_of_contents_items to seasketch_user;


ALTER TABLE table_of_contents_items
  DROP CONSTRAINT if exists titlechk;

ALTER TABLE table_of_contents_items
  ADD CONSTRAINT titlechk CHECK (char_length(title) > 0);



CREATE or replace FUNCTION public.before_insert_or_update_data_sources_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  declare
    bucket_id text;
  begin
    if new.minzoom is not null and (new.type != 'vector' and new.type != 'raster' and new.type != 'raster-dem' ) then
      raise 'minzoom may only be set for tiled sources (vector, raster, raster-dem)';
    end if;
    if new.coordinates is null and (new.type = 'video' or new.type = 'image') then
      raise 'coordinates must be set on image and video sources';
    end if;
    if new.coordinates is not null and (new.type != 'video' and new.type != 'image') then
      raise 'coordinates property can only be set on image and video sources';
    end if;
    if new.maxzoom is not null and (new.type = 'image' or new.type = 'video') then
      raise 'maxzoom cannot be set for image and video sources';
    end if;
    if new.url is null and (new.type = 'geojson' or new.type = 'image' or new.type = 'arcgis-dynamic-mapserver' or new.type = 'arcgis-vector') then
      raise 'url must be set for "%" sources', (new.type);
    end if;
    if new.scheme is not null and (new.type != 'raster' and new.type != 'raster-dem' and new.type != 'vector') then
      raise 'scheme property is not allowed for "%" sources', (new.type);
    end if;
    if new.tiles is not null and (new.type != 'raster' and new.type != 'raster-dem' and new.type != 'vector' and new.type != 'seasketch-vector') then
      raise 'tiles property is not allowed for "%" sources', (new.type);
    end if;
    if new.encoding is not null and new.type != 'raster-dem' then
      raise 'encoding property only allowed on raster-dem sources';
    end if;
    if new.tile_size is not null and (new.type != 'raster' and new.type != 'raster-dem' and new.type != 'vector') then
      raise 'tile_size property is not allowed for "%" sources', (new.type);
    end if;
    if (new.type != 'geojson' and new.type != 'seasketch-vector') and (new.buffer is not null or new.cluster is not null or new.cluster_max_zoom is not null or new.cluster_properties is not null or new.cluster_radius is not null or new.generate_id is not null or new.line_metrics is not null or new.promote_id is not null or new.tolerance is not null) then
      raise 'geojson props such as buffer, cluster, generate_id, etc not allowed on % sources', (new.type);
    end if;
    if (new.byte_length is not null and new.type != 'seasketch-vector') then
      raise 'byte_length can only be set on seasketch-vector sources';
    end if;
    if (new.type = 'seasketch-vector' and new.byte_length is null) then
      raise 'seasketch-vector sources must have byte_length set to an approximate value';
    end if;
    if new.urls is not null and new.type != 'video' then
      raise 'urls property not allowed on % sources', (new.type);
    end if;
    if new.query_parameters is not null and (new.type != 'arcgis-vector' and new.type != 'arcgis-dynamic-mapserver') then
      raise 'query_parameters property not allowed on % sources', (new.type);
    end if;
    if new.use_device_pixel_ratio is not null and new.type != 'arcgis-dynamic-mapserver' then
      raise 'use_device_pixel_ratio property not allowed on % sources', (new.type);
    end if;
    if new.import_type is not null and new.type != 'seasketch-vector' then
      raise 'import_type property is only allowed for seasketch-vector sources';
    end if;
    if new.import_type is null and new.type = 'seasketch-vector' then
      raise 'import_type property is required for seasketch-vector sources';
    end if;
    if new.original_source_url is not null and new.type != 'seasketch-vector' then
      raise 'original_source_url may only be set on seasketch-vector sources';
    end if;
    if new.enhanced_security is not null and new.type != 'seasketch-vector' then
      raise 'enhanced_security may only be set on seasketch-vector sources';
    end if;
    if old is not null and new.type = 'seasketch-vector' then
      new.bucket_id = (select data_sources_bucket_id from projects where id = new.project_id);
      new.object_key = (select gen_random_uuid());
      new.tiles = null;
      new.url = null;
    end if;
    return new;
  end;
$$;


drop function if exists add_group_to_acl;
CREATE OR REPLACE FUNCTION public.add_group_to_acl("aclId" integer, "groupId" integer) RETURNS access_control_lists
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    DECLARE
      pid int;
      acl access_control_lists;
    BEGIN
      select project_id into pid from access_control_lists where id = "aclId";
      if session_is_admin(pid) then
        insert into access_control_list_groups (access_control_list_id, group_id) values ("aclId", "groupId");
      else
        raise exception 'Must be an administrator';
      end if;
      select * into acl from access_control_lists where id = "aclId";
      return acl;
    END
  $$;

grant execute on function add_group_to_acl to seasketch_user;
COMMENT ON FUNCTION public.add_group_to_acl("aclId" integer, "groupId" integer) IS 'Add a group to a given access control list. Must be an administrator.';

drop function if exists remove_group_from_acl;

CREATE FUNCTION public.remove_group_from_acl("aclId" integer, "groupId" integer) RETURNS access_control_lists
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    DECLARE
      pid int;
      acl access_control_lists;
    BEGIN
      select project_id into pid from access_control_lists where id = "aclId";
      if session_is_admin(pid) then
        delete from access_control_list_groups where access_control_list_id = "aclId" and group_id = "groupId";
      else
        raise exception 'Must be an administrator';
      end if;
      select * into acl from access_control_lists where id = "aclId";
      return acl;
    END
  $$;


grant execute on function remove_group_from_acl to seasketch_user;
COMMENT ON FUNCTION public.remove_group_from_acl("aclId" integer, "groupId" integer) IS 'Remove a group from a given access control list. Must be an administrator.';
