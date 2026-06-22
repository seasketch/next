import { CustomGLSource as EsriCustomGLSource } from "@seasketch/mapbox-gl-esri-sources";
import { CustomGLSource as WmsCustomGLSource } from "@seasketch/mapbox-gl-wms-source";

/** Custom map sources from @seasketch/mapbox-gl-esri-sources or mapbox-gl-wms-source. */
export type AnyCustomGLSource =
  | EsriCustomGLSource<any>
  | WmsCustomGLSource<any>;
