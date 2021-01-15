import { ArcGISVectorSourceOptions } from "@seasketch/mapbox-gl-esri-sources";
import { ImageSet } from "@seasketch/mapbox-gl-esri-sources/dist/src/ImageList";
import { ArcGISVectorSource as ArcGISVectorSourceInstance } from "@seasketch/mapbox-gl-esri-sources";
import { SeaSketchSourceBaseOptions } from "./Base";
import { ClientDataSource, ClientDataLayer } from "../LayerManager";
import { Layer, Map } from "mapbox-gl";

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
    throw new Error(`Changing type of ArcGISVectorSource is not supported`);
  }
  if (prev.url !== state.url) {
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

    const removedLayers: Layer[] = [];
    for (const layer of layers) {
      if (layer.mapboxGlStyles) {
        const mapboxLayers = layer.mapboxGlStyles;
        for (var i = 0; i < mapboxLayers.length; i++) {
          const lid = `${prev.id}-${i}`;
          const l = map.getLayer(lid);
          removedLayers.push(l);
          map.removeLayer(lid);
        }
      }
    }

    if (!state.url) throw new Error("Url not set on ArcGISVector data source");

    map.removeSource(prev.id.toString());
    instance = new ArcGISVectorSourceInstance(
      map,
      state.id.toString(),
      state.url,
      {
        ...state.queryParameters,
        bytesLimit: state.bytesLimit,
      }
    );

    for (const layer of layers) {
      const mapboxLayers = layer.mapboxGlStyles || [];
      if (mapboxLayers.length) {
        for (var i = 0; i < mapboxLayers?.length; i++) {
          map.addLayer({
            ...mapboxLayers[i],
            id: `${layer.id}-${i}`,
            source: layer.dataSourceId,
          });
        }
      } else {
        throw new Error(`mapboxLayers prop not present on layer ${layer.id}`);
      }
    }
  }

  return instance;
}

export function isArcGISVectorSourceLoading(
  instance: ArcGISVectorSourceInstance
) {
  return instance.loading;
}
