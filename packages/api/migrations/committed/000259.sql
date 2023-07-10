--! Previous: sha1:dbbac2b5c34577e754e2cce642650680cd843550
--! Hash: sha1:87c3781dcdaf7873d46e20a36ba7e1157e6f34ad

-- Enter migration here
update data_sources 
  set url = bucket_id || '/' || object_key 
where 
  bucket_id is not null and 
  type = 'seasketch-vector';
