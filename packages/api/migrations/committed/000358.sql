--! Previous: sha1:14e27e1fd703e1041a55204915b9172dbf9086c6
--! Hash: sha1:73f29e75717c7504707ccdbb51789b49e1fee467

-- Enter migration here
CREATE OR REPLACE FUNCTION public.data_layers_vector_object_key(g public.data_layers) RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER
  AS $$
  select
    regexp_replace(
    regexp_replace(remote, '^[^:]+://[^/]+/', ''), -- Remove protocol and host
    '^/', '' -- Remove leading slash if present
    )
  from data_upload_outputs
  where type = 'FlatGeobuf'
    and data_source_id = (
    select data_source_id from data_layers where id = g.id
    );
  $$;
