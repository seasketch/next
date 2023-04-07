--! Previous: sha1:1e263def1de1f9e01646315f9929630c7d6adb11
--! Hash: sha1:e34d67a24b4993dbf44986d0969e72267389f38e

-- Enter migration here
update sprite_images set url = substring(url, '\/sprites\/.*');
