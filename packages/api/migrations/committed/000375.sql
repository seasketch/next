--! Previous: sha1:63c3f6742da551ee49d725c9437202a31531e0b4
--! Hash: sha1:29b0614709d50fa8ec02f68040a8e5cf399f265f

-- Enter migration here
-- Update data_upload_output_type enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'data_upload_output_type'
      AND e.enumlabel = 'ReportingFlatgeobufV1'
  ) THEN
    ALTER TYPE public.data_upload_output_type ADD VALUE 'ReportingFlatgeobufV1';
  END IF;
END $$;
