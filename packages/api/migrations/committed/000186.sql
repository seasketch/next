--! Previous: sha1:f70eda103831679bb4538fe4b6377802b2fb262d
--! Hash: sha1:408264ea11b4051d04b883910686332db7f64e8c

-- Enter migration here
COMMENT ON TABLE public.sketches IS '
@omit all,many,create,update
A *Sketch* is a spatial feature that matches the schema defined by the related 
*SketchClass*. User *Sketches* appears in the user''s "My Plans" tab and can be
shared in the discussion forum. They are also the gateway to analytical reports.

Sketches are completely owned by individual users, so access control rules 
ensure that only the owner of a sketch can perform CRUD operations on them. 
Admins have no special access. Use the graphile-generated mutations to manage 
these records.
';

create or replace function update_sketch_parent(id int, "folderId" int, "collectionId" int)
  returns sketches
  language sql
  as $$
    update sketches set folder_id = "folderId", collection_id = "collectionId" where sketches.id = update_sketch_parent.id returning *;
  $$;

  grant execute on function update_sketch_parent to seasketch_user;
