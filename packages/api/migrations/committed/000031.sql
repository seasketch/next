--! Previous: sha1:1ab3b6a42bfdbb04f9a96a71143ef592a028ac5e
--! Hash: sha1:b8db3d8acc2073b70854f6f5738f1786e4d59f4d

-- Enter migration here
alter table basemaps add column if not exists description text;

create or replace function extract_sprite_ids(t text)
  returns int[]
  language sql
  immutable
  as $$
      select array(select i::int from (
        select 
          unnest(regexp_matches(t, 'seasketch://sprites/([^"]+)', 'g')) i 
      ) t)
  $$;

alter table data_layers add column if not exists sprite_ids integer[] generated always as (extract_sprite_ids(mapbox_gl_styles::text)) stored;


CREATE OR REPLACE FUNCTION public.data_layers_sprites(l public.data_layers) RETURNS SETOF public.sprites
    LANGUAGE sql STABLE
    AS $$
  select * from sprites where id in (
      select i::int from (
        select 
          unnest(l.sprite_ids) i 
      ) t)
    ;
$$;

grant execute on function extract_sprite_ids to anon;

drop policy if exists sprites_read on sprites;

create policy sprites_read on sprites for select using (true);

grant select (sprite_ids) on data_layers to anon;

drop policy if exists sprite_images_read on sprite_images;

-- Disabling strict RLS policies here. It isn't sensitive info and it greatly impacts performance of startup-related queries
create policy sprite_images_read on sprite_images for select using (true);
