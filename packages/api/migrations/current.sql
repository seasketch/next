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