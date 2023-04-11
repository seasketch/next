--! Previous: sha1:e34d67a24b4993dbf44986d0969e72267389f38e
--! Hash: sha1:0eed3a09aba9c3e6b87506e8585854ab126d63ee

-- Enter migration here
update sprite_images set url = substring(url, '\/sprites/[^sprites].*') where url similar to '%\/sprites\/sprites%';
