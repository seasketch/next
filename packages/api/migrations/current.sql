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

create or replace function create_metadata_xml_output(data_source_id int, url text, remote text, size bigint, filename text)
    returns data_upload_outputs
    language plpgsql
    stable
    security definer
  as $$
    declare
      output_id int;
      output data_upload_outputs;
      original_fname text;
      pid int;
    begin
      select original_filename, project_id into original_fname, pid from data_upload_outputs where data_upload_outputs.data_source_id = create_metadata_xml_output.data_source_id;
      if session_is_admin(pid) = false then
        raise exception 'Only admins can create metadata xml outputs';
      end if;
      insert into data_upload_outputs (data_source_id, type, url, remote, size, filename, original_filename, project_id) values (data_source_id, 'XMLMetadata', url, remote, size, filename, original_fnam, pid) returning id into output_id;
      select * into output from data_upload_outputs where id = output_id;
      return output;
    end;
$$;

    grant execute on function create_metadata_xml_output to seasketch_user;

    comment on function create_metadata_xml_output is '@omit';