--! Previous: sha1:979c3a36a43df28c31bf7fe7cee098700910ec18
--! Hash: sha1:88e645ad059927d638ed93854d2602f01d98f948

-- Enter migration here
DROP TRIGGER IF EXISTS ensure_geography_has_intersect_layer ON geography_clipping_layers;
DROP FUNCTION IF EXISTS check_geography_has_intersect_layer();

-- Create trigger function to check for at least one intersect clipping layer
CREATE OR REPLACE FUNCTION check_geography_has_intersect_layer()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip checks if the parent geography is being deleted
  IF EXISTS (
    SELECT 1 FROM project_geography WHERE id = COALESCE(NEW.project_geography_id, OLD.project_geography_id)
  ) THEN
    -- For DELETE operations, only check if we're removing an intersect layer
    IF (TG_OP = 'DELETE') THEN
      IF OLD.operation_type = 'intersect' AND NOT EXISTS (
        SELECT 1 
        FROM geography_clipping_layers 
        WHERE project_geography_id = OLD.project_geography_id 
        AND id != OLD.id
        AND operation_type = 'intersect'
      ) THEN
        RAISE EXCEPTION 'Cannot remove the last intersect layer from a project geography';
      END IF;
    -- For INSERT/UPDATE operations, check if we have at least one intersect layer
    ELSIF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
      IF NOT EXISTS (
        SELECT 1 
        FROM geography_clipping_layers 
        WHERE project_geography_id = NEW.project_geography_id 
        AND (
          -- Either this is the current row being inserted/updated with intersect operation
          (id = NEW.id AND NEW.operation_type = 'intersect')
          OR
          -- Or there's another row with intersect operation
          (id != NEW.id AND operation_type = 'intersect')
        )
      ) THEN
        RAISE EXCEPTION 'Project geography must have at least one clipping layer with intersect operation';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on geography_clipping_layers table
CREATE TRIGGER ensure_geography_has_intersect_layer
  AFTER INSERT OR UPDATE OR DELETE ON geography_clipping_layers
  FOR EACH ROW
  EXECUTE FUNCTION check_geography_has_intersect_layer();
