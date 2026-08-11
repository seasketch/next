-- Enter migration here

alter type public.spatial_metric_type add value if not exists 'raster_overlay_area';
