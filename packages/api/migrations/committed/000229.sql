--! Previous: sha1:423bbf448047127c3efe3d3f707c3bf292c5bdf5
--! Hash: sha1:96d91fb5877cca1662ab5b6ef9f29c70020e16b5

-- Enter migration here
grant execute on function my_folders to anon;
grant execute on function my_sketches to anon;
grant execute on function projects_my_sketches to anon;
grant execute on function projects_my_folders to anon;
