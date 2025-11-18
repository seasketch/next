-- Replace contextualized_mean with column_stats in spatial_metric_type enum

-- Step 1: Add the new enum value first (safe operation)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'spatial_metric_type'
      AND e.enumlabel = 'column_values'
  ) THEN
    ALTER TYPE spatial_metric_type ADD VALUE 'column_values';
  END IF;
END $$;

-- Step 2: Delete any existing metrics with contextualized_mean type
DELETE FROM spatial_metrics WHERE type = 'contextualized_mean'::spatial_metric_type;
DELETE FROM spatial_metrics WHERE type = 'column_stats'::spatial_metric_type;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'spatial_metric_type'
      AND e.enumlabel = 'raster_stats'
  ) THEN
    ALTER TYPE spatial_metric_type ADD VALUE 'raster_stats';
  END IF;
END $$;
