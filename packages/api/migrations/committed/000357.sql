--! Previous: sha1:591b418da317554c06922729c0a5f1a9747a46b9
--! Hash: sha1:14e27e1fd703e1041a55204915b9172dbf9086c6

-- Enter migration here

DROP FUNCTION IF EXISTS data_layers_vector_object_key;
CREATE OR REPLACE FUNCTION data_layers_vector_object_key(g data_layers) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
    select remote from data_upload_outputs where type = 'FlatGeobuf' and data_source_id = (
      select data_source_id from data_layers where id = g.id
    );
  $$;

grant execute on function data_layers_vector_object_key to anon;
