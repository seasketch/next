--! Previous: sha1:b42f2f8b7680d88a9705e6fe3fe10d963a5e2615
--! Hash: sha1:3df032a8928b4ef0cb384e47ce355cc85abd8b48

-- Enter migration here
alter table projects add column if not exists custom_doc_link text;
grant update(custom_doc_link) on projects to seasketch_user;
