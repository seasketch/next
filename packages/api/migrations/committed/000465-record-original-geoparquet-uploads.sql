--! Previous: sha1:ea5df722213b0672c01c7cbaaba352b1d84fb4df
--! Hash: sha1:98b3f127dabc19ee91061d5172d32994703a636a
--! Message: Record original GeoParquet uploads

-- Original GeoParquet uploads are stored beside the normalized FlatGeobuf.
alter type data_upload_output_type add value if not exists 'GeoParquet';
