--! Previous: sha1:c47e1fc9e4b437afcf132587b7220a527d64c143
--! Hash: sha1:f1b603fc3391b120dca9e797a5044dafd98c348c

-- Enter migration here
alter table surveys drop column if exists intro_message;
alter table surveys drop column if exists closing_message;
alter table surveys drop column if exists start_button_text;
