import {
  GeoJSONSource,
  VideoSource,
  ImageSource,
  RasterSource,
  VectorSource,
  Map,
} from "mapbox-gl";
import { ClientDataSource } from "../MapContextManager";
import { SeaSketchSourceBaseOptions } from "./Base";

export type MapBoxSource = (
  | GeoJSONSource
  | VideoSource
  | ImageSource
  | RasterSource
  | VectorSource
) &
  SeaSketchSourceBaseOptions;

export function updateGeoJSONSource(
  prev: ClientDataSource,
  next: ClientDataSource,
  map: Map
) {
  if (prev.attribution !== next.attribution) {
    map.removeSource(prev.id.toString());
    map.addSource(prev.id.toString(), {
      attribution: next.attribution || undefined,
      type: "geojson",
      data: `https://${next.bucketId}/${next.objectKey}`,
    });
  }
}
