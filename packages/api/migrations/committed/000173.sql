--! Previous: sha1:37308a043ca002cc54230cf8aae031f05c678386
--! Hash: sha1:39b9d06513607a1914fb44f4381e561ed9b91a4c

-- Enter migration here
alter table sprites alter column project_id drop not null;
alter table sprites add column if not exists category text;

CREATE INDEX if not exists sprites_group_idx ON sprites (category);

create or replace function create_sprite("projectId" int, _md5 text, _type sprite_type, _pixel_ratio int, _width int, _height int, _url text) 
  returns sprites
  language plpgsql
  security definer
as $$
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
    select * into sprite from sprites where sprites.md5 = _md5 limit 1;
    if sprite is null then
      insert into sprites (project_id, type, md5) values ("projectId", _type, _md5) returning * into sprite;
    end if;
    insert into sprite_images (sprite_id, pixel_ratio, width, height, url) values (sprite.id, _pixel_ratio, _width, _height, _url);
    return sprite;
  end;
$$;
