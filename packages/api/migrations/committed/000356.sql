--! Previous: sha1:2c256926b12b06ed9f08ef5abfcda3d15ff15a4e
--! Hash: sha1:591b418da317554c06922729c0a5f1a9747a46b9

-- Enter migration here
drop trigger if exists after_project_insert on projects;
