--! Previous: sha1:e632987478bed226e7e4fba2c9d4bd91f0476f2b
--! Hash: sha1:78bbb9d01386c2cab9541287482a0cfc42b76ed9

-- Enter migration here
alter type spatial_metric_type add value if not exists 'distance_to_shore';
