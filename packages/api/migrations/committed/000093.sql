--! Previous: sha1:fa5cd72dec96488ba9549c5c7e9de6605755887b
--! Hash: sha1:f53442653217c540a0200876ad61c0bd83d68938

-- Enter migration here
alter table form_element_types drop column if exists advances_automatically;
