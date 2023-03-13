-- Enter migration here
alter table map_bookmarks add column if not exists sidebar_state jsonb;
drop function if exists create_map_bookmark(text, boolean, jsonb, text[], integer, jsonb, jsonb,  integer[]
, integer[]);
CREATE OR REPLACE FUNCTION public.create_map_bookmark(slug text, "isPublic" boolean, style jsonb, "visibleDataLayers" text[], "selectedBasemap" integer, "basemapOptionalLayerStates" jsonb, "cameraOptions" jsonb, "mapDimensions" integer[], "visibleSketches" integer[], "sidebarState" jsonb) RETURNS public.map_bookmarks
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      bookmark map_bookmarks;
      pid int;
    begin
      select id into pid from projects where projects.slug = create_map_bookmark.slug;
      if session_has_project_access(pid) then
        insert into map_bookmarks (
          project_id, 
          user_id, 
          is_public, 
          style, 
          visible_data_layers, 
          selected_basemap, 
          basemap_optional_layer_states, 
          camera_options,
          map_dimensions,
          visible_sketches,
          sidebar_state
        ) values (
          pid,
          nullif(current_setting('session.user_id', TRUE), '')::int,
          "isPublic",
          create_map_bookmark.style,
          "visibleDataLayers",
          "selectedBasemap",
          "basemapOptionalLayerStates",
          "cameraOptions",
          "mapDimensions",
          "visibleSketches",
          "sidebarState"
        ) returning * into bookmark;
        return bookmark;
      else
        raise exception 'Permission denied';
      end if;
    end;
  $$;

grant execute on function create_map_bookmark to seasketch_user;

grant select(sidebar_state) on map_bookmarks to anon;

create or replace function bookmark_data(id text)
  returns jsonb
  language sql
  stable
  security definer
  as $$
    SELECT jsonb_build_object('id', id, 'style', style, 'basemapUrl', (select url from basemaps where basemaps.id = map_bookmarks.selected_basemap), 'mapDimensions', map_dimensions, 'cameraOptions', camera_options, 'sidebarState', sidebar_state) as bookmark from map_bookmarks where map_bookmarks.id = bookmark_data.id::uuid;
  $$;

grant execute on function bookmark_data to anon;
comment on function bookmark_data is '@omit';
alter table map_bookmarks drop column if exists screenshot_url;
alter table map_bookmarks drop column if exists thumbnail_url;
alter table map_bookmarks add column if not exists image_id text;
grant select(image_id) on map_bookmarks to anon;

drop function if exists extract_post_attachments;
drop type if exists post_attachment;
drop type if exists attachment_type;

create type attachment_type as enum (
  'MapBookmark',
  'FileUpload'
);

create type post_attachment as (
  id uuid,
  type attachment_type,
  data jsonb
);

create or replace function extract_post_bookmark_attachments(doc jsonb)
  returns uuid[]
  language plpgsql
  immutable
  as $$
    declare
      attachments uuid[];
      i jsonb;
      node jsonb;
    begin
      if doc ? 'content' and doc ->> 'type' = 'doc' then
        raise notice 'In doc %', doc;
        for i in (select * from jsonb_array_elements((doc->'content')))
        loop
          if i ->> 'type' = 'attachments' then
            raise notice 'Found! %', i;
            if i ? 'content' then
              for node in (select * from jsonb_array_elements((i->'content')))
              loop
                if node ? 'attrs' and (node->'attrs')->>'type' = 'MapBookmark' then
                  attachments = array_append(
                    attachments,
                    ((node->'attrs')->>'id')::uuid);
                end if;
              end loop;
            end if;
          end if;
        end loop;
      end if;
      return attachments;
    end
  $$;

alter table posts drop column if exists attachments;
alter table posts drop column if exists bookmark_attachments;
alter table posts add column if not exists bookmark_attachment_ids uuid[] generated always as (extract_post_bookmark_attachments(message_contents)) STORED NOT NULL;

CREATE OR REPLACE FUNCTION public.posts_map_bookmarks(post public.posts) RETURNS SETOF public.map_bookmarks
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select * from map_bookmarks where id = any(post.bookmark_attachment_ids);
  $$;


create or replace function after_map_bookmark_insert_screenshot_trigger() 
  returns trigger 
  security definer
  language plpgsql
  as $$
    begin
      perform graphile_worker.add_job('createBookmarkScreenshot', json_build_object('id', new.id));
      return new;
    end;
  $$;

DROP TRIGGER IF EXISTS after_map_bookmark_insert_screenshot_map ON map_bookmarks;
CREATE TRIGGER after_map_bookmark_insert_screenshot_map
    AFTER INSERT ON map_bookmarks
    FOR EACH ROW EXECUTE PROCEDURE after_map_bookmark_insert_screenshot_trigger();


create or replace function bookmark_by_id(id uuid)
  returns map_bookmarks
  language sql
  stable
  security definer
  as $$
    select * from map_bookmarks where map_bookmarks.id = bookmark_by_id.id;
  $$;

grant execute on function bookmark_by_id to seasketch_user;

alter table map_bookmarks drop column if exists blurhash;
alter table map_bookmarks add column if not exists blurhash text;

grant select(blurhash) on map_bookmarks to anon;



create or replace function on_map_bookmark_update() 
  returns trigger 
  security definer
  language plpgsql
  as $$
    begin
      raise notice 'rtu=%', concat('graphql:mapBookmark:', NEW.id, ':update');
      perform pg_notify(concat('graphql:mapBookmark:', NEW.id, ':update'), json_build_object('bookmarkId', NEW.id)::text);
      return new;
    end;
  $$;

DROP TRIGGER IF EXISTS on_map_bookmark_update_trigger ON map_bookmarks;
CREATE TRIGGER on_map_bookmark_update_trigger
    AFTER UPDATE ON map_bookmarks
    FOR EACH ROW EXECUTE PROCEDURE on_map_bookmark_update();
