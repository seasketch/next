--! Previous: sha1:b29221121218a7daf08c79f2e2580f66236bfdfc
--! Hash: sha1:fc2579e6e5275d22de4e81f534d1666a014721f8

-- Enter migration here
alter type data_upload_output_type add value if not exists 'XMLMetadata';

drop function if exists table_of_contents_items_metadata_xml;
create or replace function table_of_contents_items_metadata_xml(item table_of_contents_items)
    returns data_upload_outputs
    language plpgsql
    stable
    security definer
  as $$
    declare
      ds_id int;
      data_upload_output data_upload_outputs;
    begin
      select data_source_id into ds_id from data_layers where id = item.data_layer_id;
      if ds_id is null then
        return null;
      end if;
      select * into data_upload_output from data_upload_outputs where data_source_id = ds_id and type = 'XMLMetadata';
      return data_upload_output;
    end;
$$;

grant execute on function table_of_contents_items_metadata_xml(table_of_contents_items) to anon;

drop function if exists create_metadata_xml_output;
create or replace function create_metadata_xml_output(data_source_id int, url text, remote text, size bigint, filename text, metadata_type text)
    returns data_upload_outputs
    language plpgsql
    security definer
  as $$
    declare
      source_exists boolean;
      output_id int;
      output data_upload_outputs;
      original_fname text;
      pid int;
    begin
      -- first, check if data_source even exists
      select exists(select 1 from data_sources where id = data_source_id) into source_exists;
      if source_exists = false then
        raise exception 'Data source does not exist';
      end if;

      select 
        original_filename, 
        project_id 
      into original_fname, pid 
      from data_upload_outputs 
      where 
        data_upload_outputs.data_source_id = create_metadata_xml_output.data_source_id;
      if session_is_admin(pid) = false then
        raise exception 'Only admins can create metadata xml outputs';
      end if;
      -- delete existing metadata xml output
      delete from 
        data_upload_outputs 
      where 
        data_upload_outputs.data_source_id = create_metadata_xml_output.data_source_id and 
        type = 'XMLMetadata';
      insert into data_upload_outputs (
        data_source_id, 
        project_id,
        type, 
        url, 
        remote, 
        size, 
        filename, 
        original_filename
      ) values (
        create_metadata_xml_output.data_source_id, 
        pid,
        'XMLMetadata', 
        url, 
        remote, 
        size, 
        filename, 
        original_fname
      ) returning * into output;
      UPDATE data_sources
      SET geostats = jsonb_set(
          geostats,
          '{layers,0,metadata,type}',
          metadata_type::jsonb,
          true
      )
      WHERE data_sources.id = id and 
      jsonb_typeof(geostats->'layers'->0->'metadata'->'type') IS NOT NULL;
      return output;
    end;
$$;

grant execute on function create_metadata_xml_output to seasketch_user;

comment on function create_metadata_xml_output is '@omit';

drop function if exists table_of_contents_items_metadata_format;
create or replace function table_of_contents_items_metadata_format(item table_of_contents_items)
    returns text
    language plpgsql
    stable
    security definer
  as $$
    declare
      ds_id int;
      metadata_type text;
    begin
      select data_source_id into ds_id from data_layers where id = item.data_layer_id;
      SELECT geostats->'layers'->0->'metadata'->>'type' into metadata_type
      FROM data_sources
      WHERE jsonb_typeof(geostats->'layers'->0->'metadata'->'type') IS NOT NULL;
      return metadata_type;
    end;
$$;

grant execute on function table_of_contents_items_metadata_format(table_of_contents_items) to anon;
