--! Previous: sha1:34f206389b49ffc20b8d609c0e55828b26970b86
--! Hash: sha1:b84ca1cd5b644e1ddca9dfe89d77597561e16e94

-- Enter migration here
alter table projects drop column if exists invite_email_template_text;
