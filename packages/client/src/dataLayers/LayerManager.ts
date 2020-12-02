import {
  Layer as MapBoxLayer,
  Map,
  MapDataEvent,
  ErrorEvent,
  Source,
  RasterDemSource
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
  isArcGISDynamicServiceLoading,
  updateDynamicMapService,
} from "./sourceTypes/ArcGISDynamicMapServiceSource";
import {
  ArcGISVectorSource,
  updateArcGISVectorSource,
  isArcGISVectorSourceLoading,
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
  private layers: { [layerId: string]: SeaSketchLayer } = {};
  private layersBySourceId: { [sourceId: string]: SeaSketchLayer[] } = {};
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
  private updateSourcesStateDebouncerReference?: NodeJS.Timeout;
  private backoff: number = 100;

  constructor(setState: Dispatch<SetStateAction<LayerManagerContext>>) {
    this.setState = setState;
  }

  setMap(map: Map) {
    if (this.map) {
      // remove event listeners
      this.map.off("error", this.onMapError);
      this.map.off("data", this.onMapDataEvent);
      this.map.off("dataloading", this.onMapDataEvent);
    }
    // add event listeners
    this.map = map;
    this.map.on("error", this.onMapError);
    this.map.on("data", this.onMapDataEvent);
    this.map.on("dataloading", this.onMapDataEvent);
  }

  onMapDataEvent = (
    event: MapDataEvent & { source: Source; sourceId: string }
  ) => {
    // let anyChanges = false;
    if (event.sourceId === "composite") {
      // ignore
      return;
    }
    // Filter out events that are related to styles, or about turning geojson
    // or image data into tiles. We don't care about stuff that isn't related to
    // network activity
    if (
      event.dataType === "source" &&
      ((event.source.type !== "geojson" && event.source.type !== "image") ||
        !event.tile)
    ) {
      this.debouncedUpdateSourceStates();
    }
  };

  onMapError = (event: ErrorEvent & { sourceId?: string }) => {
    if (event.sourceId && event.sourceId !== "composite") {
      let anySet = false;
      for (const layerId of Object.keys(this.visibleLayers)) {
        if (event.sourceId === this.layers[layerId].sourceId) {
          this.visibleLayers[layerId].error = event.error;
          this.visibleLayers[layerId].loading = false;
          anySet = true;
        }
      }
      if (anySet) {
        this.debouncedUpdateState();
      }
    }
  };

  debouncedUpdateSourceStates(backoff = 10) {
    if (this.updateSourcesStateDebouncerReference) {
      clearTimeout(this.updateSourcesStateDebouncerReference);
    }
    this.updateSourcesStateDebouncerReference = setTimeout(() => {
      delete this.updateSourcesStateDebouncerReference;
      this.updateSourceStates();
    }, backoff);
  }

  updateSourceStates() {
    let anyChanges = false;
    let anyLoading = false;
    if (!this.map) {
      throw new Error("LayerManager.map not set");
    }
    let sources: { [sourceId: string]: SeaSketchLayer[] } = {};
    for (const layerId of Object.keys(this.visibleLayers)) {
      const layer = this.layers[layerId];
      if (!sources[layer.sourceId]) {
        sources[layer.sourceId] = [];
      }
      sources[layer.sourceId].push(layer);
    }
    for (const sourceId in sources) {
      let loading = this.isSourceLoading(sourceId);
      if (loading) {
        anyLoading = true;
      }
      const isDynamicService =
        this.sourceCache[sourceId] &&
        this.sourceCache[sourceId] instanceof ArcGISDynamicMapServiceInstance;
      for (const layer of sources[sourceId]) {
        if (this.visibleLayers[layer.id].loading !== loading) {
          this.visibleLayers[layer.id].loading = loading;
          anyChanges = true;
        }
        if (this.visibleLayers[layer.id].error && loading) {
          delete this.visibleLayers[layer.id].error;
          anyChanges = true;
        }
      }
    }
    if (anyChanges) {
      this.debouncedUpdateState();
    }
    // if (anyLoading) {
    //   console.log("some loading");
    //   this.debouncedUpdateSourceStates(this.backoff);
    //   this.backoff = this.backoff * 2;
    // } else {
    //   this.backoff = 100;
    // }
  }

  isSourceLoading(id: string) {
    // let loaded = this.map.isSourceLoaded(id);
    let loading = false;
    const instance = this.sourceCache[id];
    if (instance) {
      if (instance instanceof ArcGISVectorSourceInstance) {
        return isArcGISVectorSourceLoading(instance);
      } else if (instance instanceof ArcGISDynamicMapServiceInstance) {
        return isArcGISDynamicServiceLoading(instance, this.map!);
      }
    } else {
      loading = !this.map!.isSourceLoaded(id);
    }
    return loading;
  }

  updateLayer(layer: SeaSketchLayer) {
    if (!this.map) {
      throw new Error(`Map instance not set`);
    }
    const existingLayer = this.layers[layer.id];
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
    this.layers[layer.id] = layer;
    const sourceLayers = this.layersBySourceId[existingLayer.sourceId];
    this.layersBySourceId[existingLayer.sourceId] = [
      ...sourceLayers.filter((l) => l.id !== layer.id),
      layer,
    ];
  }

  highlightLayer(layerId: string) {}

  reset(sources: SourceList, layers: SeaSketchLayer[]) {
    const oldVisibleLayers = Object.keys(this.visibleLayers);
    // Remove any visible overlay layers and their sources
    for (const layer of Object.values(this.layers)) {
      this.removeLayer(layer);
    }
    // replace internal sources list with the new one
    this.sources = sources;
    // this.clearSourceCache();
    // replace internal layers list
    this.layers = {};
    this.layersBySourceId = {};
    for (const layer of layers) {
      this.layers[layer.id] = layer;
      if (!this.layersBySourceId[layer.sourceId]) {
        this.layersBySourceId[layer.sourceId] = [];
      }
      this.layersBySourceId[layer.sourceId].push(layer);
    }
    // add visible layers and associated sources to map
    this.setVisibleLayers(oldVisibleLayers.filter((id) => id in this.layers));
  }

  setVisibleLayers(layerIds: string[]) {
    const layers = layerIds.map((id) => this.layers[id]);
    const notVisible = layers.filter((l) => !this.visibleLayers[l.id]);
    const layersForRemoval = [];
    for (const id in this.visibleLayers) {
      if (layerIds.indexOf(id) === -1) {
        layersForRemoval.push(this.layers[id]);
      }
    }
    if (this.map) {
      for (const layer of notVisible) {
        this.addLayer(layer);
      }

      for (const layer of layersForRemoval) {
        this.removeLayer(layer);
      }
    }
  }

  hideLayers(layerIds: string[]) {
    for (const id of layerIds) {
      this.removeLayer(this.layers[id]);
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
          const layers = Object.values(this.layers).filter(
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
    for (const id of layerIds) {
      this.addLayer(this.layers[id]);
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
      loading: false,
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
      const instance = this.sourceCache[layer.sourceId];
      if (
        this.visibleLayers[layer.id] &&
        instance &&
        instance instanceof ArcGISVectorSourceInstance &&
        this.visibleLayers[layer.id].error
      ) {
        delete this.sourceCache[layer.sourceId];
        this.map.removeSource(layer.sourceId);
      }
    }
    delete this.visibleLayers[layer.id];
    this.debouncedUpdateState();
  }

  private debouncedUpdateState() {
    if (this.updateStateDebouncerReference) {
      clearTimeout(this.updateStateDebouncerReference);
    }
    this.updateStateDebouncerReference = setTimeout(this.updateState, 5);
  }

  private updateState = () => {
    delete this.updateStateDebouncerReference;
    this.setState((oldState) => ({
      ...oldState,
      layerStates: { ...this.visibleLayers },
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
    for (const layer of Object.values(this.layers)) {
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
