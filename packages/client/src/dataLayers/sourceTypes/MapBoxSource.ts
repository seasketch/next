import {
  GeoJSONSource,
  VideoSource,
  ImageSource,
  RasterSource,
  VectorSource,
  Map,
} from "mapbox-gl";
import { DataSourceDetailsFragment } from "../../generated/graphql";
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
  prev: DataSourceDetailsFragment,
  next: DataSourceDetailsFragment,
  map: Map
) {
  if (prev.attribution !== next.attribution) {
    map.removeSource(prev.id.toString());
    map.addSource(prev.id.toString(), {
      attribution: next.attribution || undefined,
      type: "geojson",
      /* eslint-disable-next-line */
      data: next.url!,
    });
  }
}
