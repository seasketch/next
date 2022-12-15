--! Previous: sha1:b693850cdbccea8615730666795e5531b669d0cb
--! Hash: sha1:db673bf9042f535bd5b043b66ed076b8be93c274

-- Enter migration here
grant update(preprocessing_endpoint, preprocessing_project_url) on sketch_classes to seasketch_user;
