import {
  GeoJSONSource,
  AnySourceImpl,
  VideoSource,
  ImageSource,
  RasterSource,
  VectorSource,
  Layer as MapBoxLayer,
  Map,
} from "mapbox-gl";
import {
  createContext,
  Dispatch,
  useEffect,
  useState,
  SetStateAction,
} from "react";
import {
  ArcGISDynamicMapServiceSource,
  updateDynamicMapService,
} from "./sourceTypes/ArcGISDynamicMapServiceSource";
import {
  ArcGISVectorSource,
  updateArcGISVectorSource,
} from "./sourceTypes/ArcGISVectorSource";
import { MapBoxSource } from "./sourceTypes/MapBoxSource";
import { WMSSource } from "./sourceTypes/WMSSource";
import {
  ArcGISDynamicMapService as ArcGISDynamicMapServiceInstance,
  ArcGISVectorSource as ArcGISVectorSourceInstance,
  ImageList,
} from "@seasketch/mapbox-gl-esri-sources";

interface LayerState {
  visible: true;
  loading: boolean;
  error?: Error;
}

export interface SeaSketchLayer {
  id: string;
  sourceId: string;
  renderUnder: "land" | "labels" | "none";
  mapboxLayers?: MapBoxLayer[];
  sublayerId?: string;
}

export type SeaSketchSource =
  | MapBoxSource
  | ArcGISDynamicMapServiceSource
  | ArcGISVectorSource
  | WMSSource;

type SourceList = SeaSketchSource[];

class LayerManager {
  private sources: SourceList = [];
  private layers: SeaSketchLayer[] = [];
  private visibleLayers: { [id: string]: LayerState } = {};
  private basemapLandLayerId: string = "land";
  private basemapLabelsLayerId: string = "road-label";
  private setState: Dispatch<SetStateAction<LayerManagerContext>>;
  private map?: Map;
  private updateStateDebouncerReference?: NodeJS.Timeout;
  private sourceCache: {
    [id: string]: ArcGISDynamicMapServiceInstance | ArcGISVectorSourceInstance;
  } = {};
  private dirtyMapServices: string[] = [];
  private updateMapServicesDebouncerReference?: NodeJS.Timeout;

  constructor(setState: Dispatch<SetStateAction<LayerManagerContext>>) {
    this.setState = setState;
  }

  setMap(map: Map) {
    if (this.map) {
      // remove event listeners
    }
    // add event listeners
    this.map = map;
  }

  // updateSources(sources: SourceList) {
  //   console.log("updateSources", sources);
  // }

  updateLayer(layer: SeaSketchLayer) {
    if (!this.map) {
      throw new Error(`Map instance not set`);
    }
    const existingLayer = this.layers.find((l) => l.id === layer.id);
    if (!existingLayer) {
      throw new Error(`Layer with id ${layer.id} not found`);
    }
    if (this.visibleLayers[layer.id]) {
      if (!existingLayer.mapboxLayers || !existingLayer.mapboxLayers.length) {
        throw new Error(`Existing layer had no mapboxLayer property`);
      }
      for (var i = 0; i < existingLayer.mapboxLayers?.length; i++) {
        this.map.removeLayer(`${existingLayer.id}-${i}`);
      }
      if (!layer.mapboxLayers || !layer.mapboxLayers.length) {
        throw new Error(`Replacement layer had no mapboxLayer property`);
      }
      for (var i = 0; i < layer.mapboxLayers?.length; i++) {
        this.map.addLayer({
          ...layer.mapboxLayers[i],
          id: `${layer.id}-${i}`,
          source: layer.sourceId,
        });
      }
    } else {
      // do nothing
    }
    this.layers = [...this.layers.filter((l) => l.id !== layer.id), layer];
  }

  highlightLayer(layerId: string) {}

  reset(sources: SourceList, layers: SeaSketchLayer[]) {
    const oldVisibleLayers = Object.keys(this.visibleLayers);
    // Remove any visible overlay layers and their sources
    for (const layer of this.layers) {
      this.removeLayer(layer);
    }
    // replace internal sources list with the new one
    this.sources = sources;
    // this.clearSourceCache();
    // replace internal layers list
    this.layers = layers;
    // add visible layers and associated sources to map
    this.setVisibleLayers(oldVisibleLayers);
  }

  setVisibleLayers(layerIds: string[]) {
    const layers = this.layers.filter((l) => layerIds.indexOf(l.id) !== -1);
    const notVisible = layers.filter((l) => !this.visibleLayers[l.id]);
    const layersForRemoval = this.layers.filter(
      (l) => !!this.visibleLayers[l.id] && layerIds.indexOf(l.id) === -1
    );

    for (const layer of notVisible) {
      this.addLayer(layer);
    }

    for (const layer of layersForRemoval) {
      this.removeLayer(layer);
    }
  }

  hideLayers(layerIds: string[]) {
    if (layerIds.length === 1) {
      const layer = this.layers.find((l) => l.id === layerIds[0]);
      if (layer) {
        this.removeLayer(layer);
      }
    } else {
      const layers = this.layers.filter(
        (layer) => layerIds.indexOf(layer.id) !== -1
      );
      for (const layer of layers) {
        this.removeLayer(layer);
      }
    }
  }

  updateSource(source: SeaSketchSource) {
    if (!this.map) {
      throw new Error(`Map instance not set`);
    }
    const existingSource = this.sources.find((s) => s.id === source.id);
    if (!existingSource) {
      throw new Error(`Existing source with id ${source.id} not found.`);
    }
    if (
      source.type === "ArcGISDynamicMapService" ||
      source.type === "ArcGISVectorSource"
    ) {
      let instance = this.sourceCache[source.id];
      if (!instance) {
        // not visible, just replace
        this.sources = [
          ...this.sources.filter((s) => s.id !== source.id),
          source,
        ];
      } else {
        if (source.type !== existingSource.type) {
          throw new Error(
            "Replacing source with a different type not yet supported"
          );
        } else {
          const layers = this.layers.filter(
            (l) => l.sourceId === source.id && this.visibleLayers[l.id]
          );
          // update source
          if (source.type === "ArcGISDynamicMapService") {
            instance = updateDynamicMapService(
              existingSource as ArcGISDynamicMapServiceSource,
              source,
              instance as ArcGISDynamicMapServiceInstance,
              layers,
              this.map
            );
            this.sourceCache[source.id] = instance;
          } else if (source.type === "ArcGISVectorSource") {
            instance = updateArcGISVectorSource(
              existingSource as ArcGISVectorSource,
              source,
              instance as ArcGISVectorSourceInstance,
              layers,
              this.map
            );
            this.sourceCache[source.id] = instance;
          } else {
            throw new Error(`Not able to update ${source!.type}`);
          }
          this.sources = [
            ...this.sources.filter((s) => s.id !== source.id),
            source,
          ];
        }
      }
    } else {
      throw new Error("Mapbox base sources not supported yet");
    }
  }

  showLayers(layerIds: string[]) {
    if (layerIds.length === 1) {
      const layer = this.layers.find((l) => l.id === layerIds[0]);
      if (layer) {
        this.addLayer(layer);
      }
    } else {
      const layers = this.layers.filter(
        (layer) => layerIds.indexOf(layer.id) !== -1
      );
      for (const layer of layers) {
        this.addLayer(layer);
      }
    }
  }

  private addLayer(layer: SeaSketchLayer) {
    if (!this.map) {
      throw new Error(`Map instance not set`);
    }
    let loading = true;
    if (layer.sublayerId) {
      this.markMapServiceDirty(layer.sourceId);
    } else {
      const source = this.getOrInitializeSource(layer.sourceId);
      loading = this.map.isSourceLoaded(layer.sourceId);
      if (layer.mapboxLayers && layer.mapboxLayers.length) {
        for (var i = 0; i < layer.mapboxLayers?.length; i++) {
          this.map.addLayer({
            ...layer.mapboxLayers[i],
            id: `${layer.sourceId}-${i}`,
            source: layer.sourceId,
          });
        }
      } else {
        throw new Error(`mapboxLayers prop not present on layer ${layer.id}`);
      }
    }
    this.visibleLayers[layer.id] = {
      loading,
      visible: true,
    };
    this.debouncedUpdateState();
  }

  private removeLayer(layer: SeaSketchLayer) {
    if (!this.map) {
      throw new Error(`Map instance not set`);
    }
    if (layer.sublayerId) {
      this.markMapServiceDirty(layer.sourceId);
    } else {
      if (
        this.visibleLayers[layer.id] &&
        layer.mapboxLayers &&
        layer.mapboxLayers.length
      ) {
        for (var i = 0; i < layer.mapboxLayers?.length; i++) {
          this.map.removeLayer(`${layer.id}-${i}`);
        }
      }
    }
    delete this.visibleLayers[layer.id];
    this.debouncedUpdateState();
  }

  private debouncedUpdateState() {
    if (this.updateStateDebouncerReference) {
      clearTimeout(this.updateStateDebouncerReference);
    }
    this.updateStateDebouncerReference = setTimeout(this.updateState, 1);
  }

  private updateState = () => {
    delete this.updateStateDebouncerReference;
    this.setState((oldState) => ({
      ...oldState,
      layerStates: this.visibleLayers,
    }));
  };

  private getOrInitializeSource(id: string, initialSublayers?: string[]) {
    if (!this.map) {
      throw new Error(`Map instance not set`);
    }
    const instance = this.sourceCache[id];
    if (instance) {
      return instance;
    } else {
      const config = this.map.getSource(id);
      if (config) {
        return config;
      } else {
        // Need to add source to the map
        const sourceConfig = this.sources.find((s) => s.id === id);
        if (!sourceConfig) {
          throw new Error(`Could not find source with id ${id}`);
        }
        if (sourceConfig.type === "ArcGISVectorSource") {
          const instance = new ArcGISVectorSourceInstance(
            this.map,
            sourceConfig.id,
            sourceConfig.url,
            sourceConfig.options
          );
          if (sourceConfig.imageSets && sourceConfig.imageSets.length) {
            const imageList = new ImageList(undefined, sourceConfig.imageSets);
            imageList.addToMap(this.map);
          }
          this.sourceCache[sourceConfig.id] = instance;
          return instance;
        } else if (sourceConfig.type === "ArcGISDynamicMapService") {
          if (!initialSublayers) {
            throw new Error(
              "ArcGISDynamicMapServices must be initialized with initial sublayers"
            );
          }
          const instance = new ArcGISDynamicMapServiceInstance(
            this.map,
            sourceConfig.id,
            sourceConfig.url,
            {
              ...sourceConfig.options,
              layers: initialSublayers.map((s) => ({ sublayer: parseInt(s) })),
            }
          );
          this.sourceCache[sourceConfig.id] = instance;
          return instance;
        } else {
          throw new Error("not ready for this type");
        }
      }
    }
  }

  private markMapServiceDirty(id: string) {
    if (this.dirtyMapServices.indexOf(id) === -1) {
      this.dirtyMapServices.push(id);
    }
    if (this.updateMapServicesDebouncerReference) {
      clearTimeout(this.updateMapServicesDebouncerReference);
    }
    this.updateMapServicesDebouncerReference = setTimeout(() => {
      delete this.updateMapServicesDebouncerReference;
      this.updateMapServices();
    }, 2);
  }

  private updateMapServices() {
    if (!this.map) {
      throw new Error(`Map instance not set`);
    }
    const sublayersBySource: { [sourceId: string]: string[] } = {};
    for (const dirty of this.dirtyMapServices) {
      sublayersBySource[dirty] = [];
    }
    this.dirtyMapServices = [];
    for (const layer of this.layers) {
      if (sublayersBySource[layer.sourceId] && this.visibleLayers[layer.id]) {
        sublayersBySource[layer.sourceId].push(layer.sublayerId!);
      }
    }
    for (const sourceId in sublayersBySource) {
      const layerId = `${sourceId}-layer`;
      if (sublayersBySource[sourceId].length === 0) {
        // remove the source
        const layer = this.map.getLayer(layerId);
        if (layer) {
          this.map.removeLayer(layerId);
          const source = this.sourceCache[sourceId] as
            | ArcGISDynamicMapServiceInstance
            | undefined;
          if (source) {
            // remove the source. TODO: in the future maybe just pause it?
            source.destroy();
            this.map.removeSource(sourceId);
            delete this.sourceCache[sourceId];
          }
        }
      } else {
        // Add or update the source
        let source = this.sourceCache[sourceId] as
          | ArcGISDynamicMapServiceInstance
          | undefined;
        if (source) {
          source.updateLayers(
            sublayersBySource[sourceId].map((id) => ({
              sublayer: parseInt(id),
            }))
          );
        } else {
          source = this.getOrInitializeSource(
            sourceId,
            sublayersBySource[sourceId]
          ) as ArcGISDynamicMapServiceInstance;
        }
        const layer = this.map.getLayer(layerId);
        if (!layer) {
          this.map.addLayer({
            id: layerId,
            source: sourceId,
            type: "raster",
            paint: {
              "raster-fade-duration": 0,
            },
          });
        }
      }
    }
  }
}

export default LayerManager;

interface LayerManagerContext {
  layerStates: { [id: string]: LayerState };
  manager?: LayerManager;
}

export function useLayerManager() {
  const [state, setState] = useState<LayerManagerContext>({ layerStates: {} });
  useEffect(() => {
    const manager = new LayerManager(setState);
    const newState = {
      manager,
      layerStates: {},
    };
    setState(newState);
  }, []);
  return state;
}

export const LayerManagerContext = createContext<LayerManagerContext>({
  layerStates: {},
  manager: new LayerManager((state) => {}),
});
