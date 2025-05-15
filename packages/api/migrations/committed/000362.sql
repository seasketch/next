--! Previous: sha1:009759ddca8c61b65f68a7109f9dea7886c045ba
--! Hash: sha1:979c3a36a43df28c31bf7fe7cee098700910ec18

-- Enter migration here
DROP TRIGGER IF EXISTS ensure_geography_has_intersect_layer ON geography_clipping_layers;
DROP FUNCTION IF EXISTS check_geography_has_intersect_layer();

-- Create trigger function to check for at least one intersect clipping layer
CREATE OR REPLACE FUNCTION check_geography_has_intersect_layer()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if there are any clipping layers with intersect operation
  IF NOT EXISTS (
    SELECT 1 
    FROM geography_clipping_layers 
    WHERE project_geography_id = NEW.project_geography_id 
    AND operation_type = 'intersect'
  ) THEN
    RAISE EXCEPTION 'Project geography must have at least one clipping layer with intersect operation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on geography_clipping_layers table
CREATE TRIGGER ensure_geography_has_intersect_layer
  AFTER INSERT OR UPDATE OR DELETE ON geography_clipping_layers
  FOR EACH ROW
  EXECUTE FUNCTION check_geography_has_intersect_layer();
