-- Enter migration here
alter table projects add column if not exists enable_download_by_default boolean not null default true;
comment on column projects.enable_download_by_default is 'When true, overlay layers will be available for download by end-users if they have access to the layer and the data source supports it. This can be controlled on a per-layer basis.';

grant select (enable_download_by_default) on projects to anon;
grant update (enable_download_by_default) on projects to seasketch_user;

CREATE OR REPLACE FUNCTION public.before_insert_or_update_table_of_contents_items_trigger() RETURNS trigger
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
      new.enable_download = (select enable_download_by_default from projects where id = new.project_id);
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
    if length(trim(new.title)) = 0 then
      raise 'title cannot be empty';
    end if;
    return new;
  end;
$$;

create or replace function set_enable_download_for_all_overlays(slug text, enable boolean)
  returns setof table_of_contents_items
  language sql
  as $$
    update table_of_contents_items set enable_download = enable
    where table_of_contents_items.project_id = (select id from projects where projects.slug = set_enable_download_for_all_overlays.slug)
    and table_of_contents_items.is_draft = true
    and table_of_contents_items.is_folder = false
    returning *;
  $$;

comment on function set_enable_download_for_all_overlays(text, boolean) is 'Sets the enable_download flag for all overlays in a project. Note this is only applied to draft items, so will require a publish to impact project users.';

grant execute on function set_enable_download_for_all_overlays(text, boolean) to seasketch_user;

create or replace function projects_has_downloadable_layers(p projects)
  returns boolean
  language sql
  stable
  as $$
    select count(id) > 0 from table_of_contents_items where project_id = p.id and is_draft = true and is_folder = false and enable_download = true;
  $$;

grant execute on function projects_has_downloadable_layers(projects) to seasketch_user;

comment on function projects_has_downloadable_layers(projects) is 'Returns true if the project has any layers that have enable_download = true. Useful when used in conjunction with set_enable_download_for_all_overlays()';