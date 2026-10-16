--! Previous: sha1:934d36732411eae9b259d37e8e08820028742725
--! Hash: sha1:1869aab84a3df84986e083a761caf44a30b35263

-- pg_restore loads rows with an empty search_path. posts.ordered_attachment_ids
-- calls this function, and the function calls itself by an unqualified name.
alter function public.collect_attachment_ids_from_prosemirror_body(body jsonb, type text) set search_path = public, pg_catalog;
