--! Previous: sha1:fc2579e6e5275d22de4e81f534d1666a014721f8
--! Hash: sha1:b8cbc01e7d5166e77a68f5e3072082b77ff40769

-- Enter migration here
alter type data_upload_output_type add value if not exists 'NetCDF';
