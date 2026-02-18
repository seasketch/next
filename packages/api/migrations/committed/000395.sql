--! Previous: sha1:5696a5443c24120a1c679f4090b7abc377013624
--! Hash: sha1:853045ab789ab6008aa497f45f467c889147007f

-- Enter migration here
drop function if exists extract_table_of_contents_item_ids_from_body;
drop function if exists copy_report_output_to_published_table_of_contents_item;
