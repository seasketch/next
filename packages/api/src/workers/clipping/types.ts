import { Feature, MultiPolygon, Polygon } from "geojson";
import { ClippingOperation, Cql2Query, PreparedSketch } from "overlay-engine";

export interface ClippingWorkerData {
  preparedSketch: PreparedSketch;
  op: ClippingOperation;
  cql2Query?: Cql2Query;
  polygons: Feature<MultiPolygon | Polygon>[];
}
