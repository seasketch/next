--! Previous: sha1:b84ca1cd5b644e1ddca9dfe89d77597561e16e94
--! Hash: sha1:7a2967d3f549802da6223e9be0d8878ed9f9f144

-- Enter migration here
delete from surveys where name = '';
alter table surveys drop constraint if exists namechk;
alter table surveys add constraint namechk CHECK (char_length(name) <= 200 and char_length(name) > 0);
