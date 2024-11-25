--! Previous: sha1:78bf70518119fa25c1cf0cda3d23d47c4936ea0d
--! Hash: sha1:980c0780e88309cb10a2ade13561e53ff0f6d482

-- Enter migration here
alter table data_sources add column if not exists data_library_metadata jsonb;

alter table data_upload_tasks add column if not exists data_library_metadata jsonb;
