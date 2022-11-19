--! Previous: sha1:b0d892e00b7ca23f95a15fa296890f7a6906c892
--! Hash: sha1:fff1b1b13a496af69bce56314118f1deb49c6d9f

-- Enter migration here
revoke insert on sketch_folders from seasketch_user;

create or replace function create_sketch_folder("slug" text, name text, "folderId" int, "collectionId" int)
  returns sketch_folders
  language sql
  security definer
  as $$
    insert into sketch_folders (user_id, project_id, folder_id, collection_id, name) values (nullif(current_setting('session.user_id', TRUE), '')::int, ((select id from projects where slug = create_sketch_folder.slug)), "folderId", "collectionId", name) returning *;
  $$;

grant execute on function create_sketch_folder to seasketch_user;
