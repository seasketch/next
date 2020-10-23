import {
  GeoJSONSource,
  VideoSource,
  ImageSource,
  RasterSource,
  VectorSource,
} from "mapbox-gl";
import { SeaSketchSourceBaseOptions } from "./Base";

export type MapBoxSource = (
  | GeoJSONSource
  | VideoSource
  | ImageSource
  | RasterSource
  | VectorSource
) &
  SeaSketchSourceBaseOptions;
