import { ArcGISVectorSourceOptions } from "@seasketch/mapbox-gl-esri-sources";
import { ImageSet } from "@seasketch/mapbox-gl-esri-sources/dist/src/ImageList";
import { ArcGISVectorSource as ArcGISVectorSourceInstance } from "@seasketch/mapbox-gl-esri-sources";
import { SeaSketchSourceBaseOptions } from "./Base";
import { SeaSketchLayer } from "../LayerManager";
import { Layer, Map } from "mapbox-gl";

export type ArcGISVectorSource = {
  type: "ArcGISVectorSource";
  url: string;
  options: ArcGISVectorSourceOptions;
  imageSets: ImageSet[];
} & SeaSketchSourceBaseOptions;

export function updateArcGISVectorSource(
  prev: ArcGISVectorSource,
  state: ArcGISVectorSource,
  instance: ArcGISVectorSourceInstance,
  layers: SeaSketchLayer[],
  map: Map
) {
  if (prev.type !== state.type) {
    throw new Error(`Changing type of ArcGISVectorSource is not supported`);
  }
  if (prev.url !== state.url) {
    throw new Error(`Changing url of ArcGISVectorSource is not supported`);
  }
  if (prev.imageSets !== state.imageSets) {
    throw new Error(
      `Changing imageSets of ArcGISVectorSource is not supported`
    );
  }

  if (
    prev.options.bytesLimit !== state.options.bytesLimit ||
    prev.options.geometryPrecision !== state.options.geometryPrecision ||
    prev.options.outFields !== state.options.outFields
  ) {
    // Source option changes cannot be implemented by the instance, so the source
    // has to be removed (along with it's layers) and recreated

    const removedLayers: Layer[] = [];
    for (const layer of layers) {
      if (layer.mapboxLayers) {
        for (var i = 0; i < layer.mapboxLayers.length; i++) {
          const lid = `${prev.id}-${i}`;
          const l = map.getLayer(lid);
          removedLayers.push(l);
          map.removeLayer(lid);
        }
      }
    }

    map.removeSource(prev.id);
    instance = new ArcGISVectorSourceInstance(
      map,
      state.id,
      state.url,
      state.options
    );

    for (const layer of layers) {
      if (layer.mapboxLayers && layer.mapboxLayers.length) {
        for (var i = 0; i < layer.mapboxLayers?.length; i++) {
          map.addLayer({
            ...layer.mapboxLayers[i],
            id: `${layer.sourceId}-${i}`,
            source: layer.sourceId,
          });
        }
      } else {
        throw new Error(`mapboxLayers prop not present on layer ${layer.id}`);
      }
    }
  }

  return instance;
}
