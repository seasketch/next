--! Previous: sha1:0afdb308b1bc24473af5ff8187311e5668e18abe
--! Hash: sha1:b1dc277cde4c9f4632c3a706b74df9d9a02d7717

-- Enter migration here
delete from data_sources_buckets where url like 'geojson-%';
