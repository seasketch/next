import { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from "geojson";
import { Units } from "@turf/helpers";

declare module "@turf/buffer" {
  export default function buffer<G extends Geometry>(
    geojson: Feature<G> | FeatureCollection<G> | G,
    radius: number,
    options?: {
      units?: Units;
      steps?: number;
    }
  ): Feature<Polygon | MultiPolygon>;
}

