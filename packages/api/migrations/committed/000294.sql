--! AllowInvalidHash
--! Previous: sha1:3b30fee54a49de60a48d4e3d11cc2e3535afac04
--! Hash: sha1:4ea50e168e109391cda07cad450af30d78a2d338

-- Enter migration here
CREATE OR REPLACE FUNCTION public.toc_to_tsvector(lang text, title text, metadata jsonb, translated_props jsonb) RETURNS tsvector
    LANGUAGE plpgsql IMMUTABLE
    AS $$
    DECLARE
      title_translated_prop_is_filled_in boolean;
      supported_languages jsonb := get_supported_languages();
      langkey text := supported_languages->>lang;
      conf regconfig := lang::regconfig;
    BEGIN
      title_translated_prop_is_filled_in = (translated_props->lang->>'title') is not null and (translated_props->lang->>'title') <> '';
      if supported_languages->>lang is null then
        raise exception 'Language % not supported', lang;
      end if;
      -- TODO: add support for translating metadata
      if lang = 'simple' THEN
        -- The simple index matches against absolutely everything in
        -- all languages. It's a fallback that can be used when you
        -- aren't getting any matches from the language-specific
        -- indexes.
        return (
          setweight(to_tsvector(conf, title), 'A') || 
          setweight(
            to_tsvector(conf, extract_all_titles(translated_props)),  
          'A') ||
          setweight(
            jsonb_to_tsvector(conf, collect_prosemirror_text_nodes(metadata), '["string"]'
          ), 'B')
        );
      elsif lang = 'english' THEN
          return (
            setweight(to_tsvector(conf, title), 'A') ||
            setweight(
              to_tsvector(conf, coalesce(translated_props->langkey->>'title'::text, ''::text)), 
            'A') ||
            setweight(
              jsonb_to_tsvector(conf, collect_prosemirror_text_nodes(metadata), '["string"]'), 
            'B')
          );
      else
        return (
          setweight(
              to_tsvector(conf, coalesce(translated_props->langkey->>'title'::text, ''::text)), 
            'A') ||
            setweight(
              jsonb_to_tsvector(conf, collect_prosemirror_text_nodes(metadata), '["string"]'), 
            'B') ||
            setweight(to_tsvector(conf, title), 'C')
        );
      end if;
    end;
  $$;


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

CREATE OR REPLACE FUNCTION public.table_of_contents_items_has_original_source_upload(item public.table_of_contents_items) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select 
      case
        when item.data_layer_id is null then null
        else
          (
            select exists (
              select 
                original_filename
              from 
                data_upload_outputs
              where 
                data_upload_outputs.data_source_id = (
                  select 
                    data_layers.data_source_id
                  from 
                    data_layers
                  where 
                    data_layers.id = item.data_layer_id
                ) and
                data_upload_outputs.is_original = true
            )
          )
      end;
  $$;

grant execute on function table_of_contents_items_has_original_source_upload(table_of_contents_items) to seasketch_user;

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

drop function if exists projects_has_downloadable_layers();
drop function if exists projects_downloadable_layers_count;
create or replace function projects_downloadable_layers_count(p projects)
  returns bigint
  language sql
  stable
  as $$
    select count(id) from table_of_contents_items where project_id = p.id and is_draft = true and is_folder = false and enable_download = true and table_of_contents_items_has_original_source_upload(table_of_contents_items.*);
  $$;


grant execute on function projects_downloadable_layers_count(projects) to seasketch_user;

update projects set enable_download_by_default = false;



create or replace function projects_eligable_downloadable_layers_count(p projects)
  returns bigint
  language sql
  stable
  as $$
    select count(id) from table_of_contents_items where project_id = p.id and is_draft = true and is_folder = false and enable_download = false and table_of_contents_items_has_original_source_upload(table_of_contents_items.*);
  $$;

grant execute on function projects_eligable_downloadable_layers_count(projects) to seasketch_user;

drop function if exists enable_download_for_eligible_layers;

create or replace function enable_download_for_eligible_layers(slug text)
  returns projects
  language plpgsql
  as $$
    DECLARE
      project projects;
    begin    
      update 
        table_of_contents_items 
      set enable_download = true
      where 
        table_of_contents_items.project_id = (
          select 
            id 
          from 
            projects 
          where 
            projects.slug = enable_download_for_eligible_layers.slug
        ) and 
        table_of_contents_items.is_draft = true and
        table_of_contents_items.is_folder = false;
      
      select 
        * 
      from 
        projects 
      into 
        project
      where 
        projects.slug = enable_download_for_eligible_layers.slug 
      limit 1;
      return project;
    end;
  $$;

grant execute on function enable_download_for_eligible_layers(text) to seasketch_user;

drop function if exists disable_download_for_shared_layers;
create or replace function disable_download_for_shared_layers(slug text) 
  returns projects
  language plpgsql
  as $$
    DECLARE
      project projects;
    begin
    update table_of_contents_items set enable_download = false
    where table_of_contents_items.project_id = (select id from projects where projects.slug = disable_download_for_shared_layers.slug)
    and table_of_contents_items.is_draft = true
    and table_of_contents_items.is_folder = false;
    select 
        * 
      from 
        projects 
      into 
        project
      where 
        projects.slug = disable_download_for_shared_layers.slug 
      limit 1;
      return project;
    end;
  $$;

grant execute on function disable_download_for_shared_layers(text) to seasketch_user;
