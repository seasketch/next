--! Previous: sha1:a4be9eccf6cc215bc0b3dafba9044b513d1a3cb1
--! Hash: sha1:934d36732411eae9b259d37e8e08820028742725

-- Enter migration here

alter type spatial_metric_type add value if not exists 'distance_to_features_over_water';
