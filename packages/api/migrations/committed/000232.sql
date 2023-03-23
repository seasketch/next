--! Previous: sha1:402fd7ccf1a0df1c5cfda94c276a61388fadca85
--! Hash: sha1:910217720de0aae7c528c16a07f12a0ffda68fa2

-- Enter migration here
drop function if exists create_map_bookmark;
drop function if exists posts_map_bookmarks;
drop table if exists map_bookmarks;
create table map_bookmarks (
  id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  project_id integer REFERENCES projects (id) ON DELETE CASCADE,
  post_id integer references posts (id) on delete cascade,
  user_id integer not null references users (id) on delete cascade,
  style jsonb not null,
  visible_data_layers text[] not null default '{}',
  visible_sketches int[],
  selected_basemap integer not null references basemaps (id) on delete set null,
  basemap_optional_layer_states jsonb,
  camera_options jsonb not null,
  thumbnail_url text,
  screenshot_url text,
  is_public boolean not null default false,
  map_dimensions int[] not null,
  blurhash jsonb
);

create index on map_bookmarks(selected_basemap);
create index on map_bookmarks(post_id);
create index on map_bookmarks(visible_data_layers);

grant select(id, project_id, post_id, visible_data_layers, selected_basemap, basemap_optional_layer_states, camera_options, thumbnail_url, screenshot_url, is_public, style, map_dimensions, blurhash, visible_sketches) on map_bookmarks to anon;

alter table map_bookmarks enable row level security;

CREATE POLICY map_bookmarks_select ON public.map_bookmarks TO anon USING (it_me(user_id) or is_public); -- WITH CHECK (public.session_is_admin(project_id));

create or replace function posts_map_bookmarks(post posts)
  returns setof map_bookmarks
  stable
  language sql
  security definer
  as $$
    select * from map_bookmarks where post_id = post.id;
  $$;

grant execute on function posts_map_bookmarks to anon;

comment on constraint map_bookmarks_post_id_fkey on map_bookmarks is
  E'@omit';

comment on function posts_map_bookmarks is '@simpleCollections only';

create or replace function create_map_bookmark(slug text, "isPublic" boolean, style jsonb, "visibleDataLayers" text[], "selectedBasemap" int, "basemapOptionalLayerStates" jsonb, "cameraOptions" jsonb, "mapDimensions" int[], "visibleSketches" int[])
  returns map_bookmarks
  security definer
  language plpgsql
  as $$
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
          visible_sketches
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
          "visibleSketches"
        ) returning * into bookmark;
        return bookmark;
      else
        raise exception 'Permission denied';
      end if;
    end;
  $$;

grant execute on function create_map_bookmark to seasketch_user;

create or replace function posts_sketch_ids(post posts)
  returns int[]
  security definer
  stable
  language sql
  as $$
    select array_agg(id) from sketches where post_id = post.id;
  $$;

grant execute on function posts_sketch_ids to anon;

CREATE OR REPLACE FUNCTION public.collect_map_bookmark_ids_from_prosemirror_body(body jsonb) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
    declare
      output text[];
      i jsonb;
      attachment jsonb;
    begin
      output = '{}';
      if body ? 'attrs' and (body -> 'attrs') ->> 'type' = 'MapBookmark' then
        select body ->> 'attrs' into attachment;
        if attachment is not null and attachment->>'id' is not null then
          output = (attachment->>'id')::text || output;
        end if;
      end if;
      if body ? 'content' and (body ->> 'type' = 'attachments' or body ->> 'type' = 'doc') then
        for i in (select * from jsonb_array_elements((body->'content')))
        loop
          output = output || collect_map_bookmark_ids_from_prosemirror_body(i);
        end loop;
      end if;
      return output;
    end;
  $$;

grant execute on function collect_map_bookmark_ids_from_prosemirror_body to anon;
comment on function collect_map_bookmark_ids_from_prosemirror_body is '@omit';
drop trigger if exists assign_map_bookmark_attachment_post_ids_from_message_contents on posts;

CREATE OR REPLACE FUNCTION public.assign_post_id_to_attached_map_bookmarks(body jsonb, post_id integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    declare
      map_bookmark_ids text[];
    begin
      select collect_map_bookmark_ids_from_prosemirror_body(body) into map_bookmark_ids;
      update map_bookmarks set post_id = assign_post_id_to_attached_map_bookmarks.post_id where id::text = any(map_bookmark_ids);
      return true;
    end;
  $$;

CREATE OR REPLACE FUNCTION public.assign_map_bookmark_node_post_ids() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  perform assign_post_id_to_attached_map_bookmarks(NEW.message_contents, NEW.id);
	RETURN NEW;
END;
$$;

CREATE TRIGGER assign_map_bookmark_attachment_post_ids_from_message_contents AFTER INSERT OR UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.assign_map_bookmark_node_post_ids();
