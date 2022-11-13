--! Previous: sha1:39b9d06513607a1914fb44f4381e561ed9b91a4c
--! Hash: sha1:f3ee4e756b7c2cde1d28407528651ac1832e3810

-- Enter migration here
drop function if exists share_sprite;

create or replace function share_sprite(sprite_id int, category text)
  returns sprites
  language sql
  security definer
  as $$
    update sprites set project_id = null, category = share_sprite.category where id = sprite_id and session_is_superuser() returning *;
  $$;

grant execute on function share_sprite(int, text) to seasketch_user;

comment on function share_sprite is 'Superusers only. Promote a sprite to be globally available.';


alter table sprites add column if not exists deleted boolean default false;

create index if not exists idx_sprites_deleted on sprites(deleted);

create or replace function public_sprites()
  returns setof sprites
  security definer
  language sql
  stable
  as $$
    select * from sprites where project_id is null and deleted = false;
  $$;

grant execute on function public_sprites to seasketch_user;

comment on function public_sprites is '
@simpleCollections only
Used by project administrators to access a list of public sprites promoted by the SeaSketch development team.
';

create or replace function soft_delete_sprite(id int)
  returns sprites
  language sql
  security definer
  volatile
  as $$
    update sprites set deleted = true where sprites.id = soft_delete_sprite.id and session_is_superuser() returning *;
  $$;

grant execute on function soft_delete_sprite to seasketch_user;
comment on function soft_delete_sprite is 'Superusers only. "Deletes" a sprite but keeps it in the DB in case layers are already referencing it.';

drop function if exists projects_uploaded_sprites;
drop function if exists projects_sprites;
create or replace function projects_sprites(p projects)
  returns setof sprites
  language plpgsql
  security definer
  stable
  as $$
    declare
      sprites sprites;
    begin
      if session_is_admin(p.id) then
        return query select * from sprites where project_id = p.id and deleted = false;
      else 
        raise exception 'Permission denied.';
      end if;
    end;
  $$;

grant execute on function projects_sprites to seasketch_user;
comment on function projects_sprites is '@simpleCollections only';
COMMENT ON CONSTRAINT "sprites_project_id_fkey" ON "public"."sprites" IS E'@omit';

CREATE OR REPLACE FUNCTION public.create_sprite("projectId" integer, _md5 text, _type public.sprite_type, _pixel_ratio integer, _width integer, _height integer, _url text) RETURNS public.sprites
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  declare
    sprite sprites;
  begin
    if session_is_admin("projectId") = false then
      raise 'Not authorized';
    end if;
    -- if _pixel_ratio != 1 then
    --   raise 'New sprites can only be created with an image with a pixel_ratio of 1';
    -- end if;
    if _url is null then
      raise 'Must be called with a url';
    end if;
    if _md5 is null then
      raise 'Must be called with an md5 hash';
    end if;
    select * into sprite from sprites where sprites.md5 = _md5 and deleted = false limit 1;
    if sprite is null then
      insert into sprites (project_id, type, md5) values ("projectId", _type, _md5) returning * into sprite;
    end if;
    insert into sprite_images (sprite_id, pixel_ratio, width, height, url) values (sprite.id, _pixel_ratio, _width, _height, _url);
    return sprite;
  end;
$$;

ALTER TABLE ONLY public.sprites
    DROP CONSTRAINT if exists sprites_md5_project_id_key;
