--! Previous: sha1:9a25a0b2b8db5f74c9c8d54b4effbde7e6b98b52
--! Hash: sha1:7089b3d409d79794decbf694d531e2c4bbfc054f

-- Enter migration here
alter table form_elements alter column export_id drop not null;

comment on column form_elements.export_id is '
Column name used in csv export, property name in reporting tools. Keep stable to avoid breaking reports. If null, this value will be dynamically generated from the first several characters of the text in FormElement.body.
';
