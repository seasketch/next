--! Previous: sha1:fff1b1b13a496af69bce56314118f1deb49c6d9f
--! Hash: sha1:feeb00d30f1a6e12bc26c3ed135a118d74611735

-- Enter migration here
COMMENT ON TABLE public.sketches IS '
@omit all,many,create
A *Sketch* is a spatial feature that matches the schema defined by the related 
*SketchClass*. User *Sketches* appears in the user''s "My Plans" tab and can be
shared in the discussion forum. They are also the gateway to analytical reports.

Sketches are completely owned by individual users, so access control rules 
ensure that only the owner of a sketch can perform CRUD operations on them. 
Admins have no special access. Use the graphile-generated mutations to manage 
these records.
';



CREATE OR REPLACE FUNCTION public.my_sketches("projectId" integer) RETURNS SETOF public.sketches
    LANGUAGE sql STABLE
    AS $$
    select
      *
    from
      sketches
    where
      it_me(user_id) and sketch_class_id in (
        select id from sketch_classes where project_id = "projectId") and response_id is null;
  $$;

alter table sketch_classes add column if not exists preprocessing_endpoint text;
alter table sketch_classes add column if not exists preprocessing_project_url text;

grant update(properties) on sketches to seasketch_user;
