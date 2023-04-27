--! Previous: sha1:945ca4dc7582db640b09f81ef1b35ddb0439d30a
--! Hash: sha1:6b51bd9ba07e2e8ede6575a35547cb56782ca28a

-- Enter migration here
alter table projects alter column slug type varchar(24);
