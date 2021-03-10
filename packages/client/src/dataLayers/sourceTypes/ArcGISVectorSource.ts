import { ArcGISVectorSourceOptions } from "@seasketch/mapbox-gl-esri-sources";
import { ImageSet } from "@seasketch/mapbox-gl-esri-sources/dist/src/ImageList";
import { ArcGISVectorSource as ArcGISVectorSourceInstance } from "@seasketch/mapbox-gl-esri-sources";
import { SeaSketchSourceBaseOptions } from "./Base";
import { ClientDataSource, ClientDataLayer } from "../MapContextManager";
import { Map } from "mapbox-gl";

export type ArcGISVectorSource = {
  type: "ArcGISVectorSource";
  url: string;
  options: ArcGISVectorSourceOptions;
  imageSets: ImageSet[];
} & SeaSketchSourceBaseOptions;

export function updateArcGISVectorSource(
  prev: ClientDataSource,
  state: ClientDataSource,
  instance: ArcGISVectorSourceInstance,
  layers: ClientDataLayer[],
  map: Map
) {
  if (prev.type !== state.type) {
    /* eslint-disable-next-line */
    throw new Error(`Changing type of ArcGISVectorSource is not supported`);
  }
  if (prev.url !== state.url) {
    /* eslint-disable-next-line */
    throw new Error(`Changing url of ArcGISVectorSource is not supported`);
  }

  // TODO: add imageSet support back in
  // if (prev.imageSets !== state.imageSets) {
  //   throw new Error(
  //     `Changing imageSets of ArcGISVectorSource is not supported`
  //   );
  // }

  if (
    prev.bytesLimit !== state.bytesLimit ||
    prev.queryParameters.geometryPrecision !==
      state.queryParameters.geometryPrecision ||
    prev.queryParameters.outFields !== state.queryParameters.outFields
  ) {
    // Source option changes cannot be implemented by the instance, so the source
    // has to be removed (along with it's layers) and recreated

    if (!state.url) throw new Error("Url not set on ArcGISVector data source");

    map.removeSource(prev.id.toString());
    instance = new ArcGISVectorSourceInstance(
      // @ts-ignore
      map,
      state.id.toString(),
      state.url,
      {
        ...state.queryParameters,
        bytesLimit: state.bytesLimit,
      }
    );
  }

  return instance;
}

export function isArcGISVectorSourceLoading(
  instance: ArcGISVectorSourceInstance
) {
  return instance.loading;
}
