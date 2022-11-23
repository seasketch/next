--! Previous: sha1:f3ee4e756b7c2cde1d28407528651ac1832e3810
--! Hash: sha1:5def7d83c1e2a810d3d9b20f4ee7fcdac614e843

-- Enter migration here
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
    select * into sprite from sprites where project_id = "projectId" and sprites.md5 = _md5 and deleted = false limit 1;
    if sprite is null then
      insert into sprites (project_id, type, md5) values ("projectId", _type, _md5) returning * into sprite;
    end if;
    insert into sprite_images (sprite_id, pixel_ratio, width, height, url) values (sprite.id, _pixel_ratio, _width, _height, _url);
    return sprite;
  end;
$$;
