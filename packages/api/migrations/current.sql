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

grant select(id, project_id, post_id, visible_data_layers, selected_basemap, basemap_optional_layer_states, camera_options, thumbnail_url, screenshot_url, is_public, style, map_dimensions, blurhash) on map_bookmarks to anon;

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

create or replace function create_map_bookmark(slug text, "isPublic" boolean, style jsonb, "visibleDataLayers" text[], "selectedBasemap" int, "basemapOptionalLayerStates" jsonb, "cameraOptions" jsonb, "mapDimensions" int[])
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
          map_dimensions
        ) values (
          pid,
          nullif(current_setting('session.user_id', TRUE), '')::int,
          "isPublic",
          create_map_bookmark.style,
          "visibleDataLayers",
          "selectedBasemap",
          "basemapOptionalLayerStates",
          "cameraOptions",
          "mapDimensions"
        ) returning * into bookmark;
        return bookmark;
      else
        raise exception 'Permission denied';
      end if;
    end;
  $$;

grant execute on function create_map_bookmark to seasketch_user;