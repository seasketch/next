--! Previous: sha1:edb72f17ccf91a679efe5ba585326caf7ae88a72
--! Hash: sha1:36d9af70612b7bf471327dc667dc00cb9ea0a850

-- Enter migration here

alter type public.spatial_metric_type add value if not exists 'raster_overlay_area';
