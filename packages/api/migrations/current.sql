-- Enter migration here

alter type spatial_metric_type add value if not exists 'distance_to_features_over_water';
