--! Previous: sha1:46c1a39b0ff7490a6ffa437792585e31bfff144b
--! Hash: sha1:2f31ea7bdf3d10fb4b3c515ae468ff653d8598ba

-- Enter migration here
grant execute on function slugify(text) to anon;
grant execute on function slugify(text, boolean) to anon;
