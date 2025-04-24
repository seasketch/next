import { FillLayer, VectorSource } from "mapbox-gl";
import MapContextManager from "../dataLayers/MapContextManager";
import { FilterServiceMetadata } from "./FilterInputContext";
import * as d3Colors from "d3-scale-chromatic";
import debounce from "lodash.debounce";

const colorScale = d3Colors.interpolateViridis;

const colors = {
  highlight: "rgba(255, 125, 0, 0.8)",
  empty: "rgba(100, 100, 100, 0.2)",
  stale: "rgba(155, 125, 100, 0.5)",
};
function colorScaleForResolution(resolution: number) {
  const scale = colorScale;
  const maxValue = 7 ** (11 - resolution);
  return [
    "interpolate",
    ["linear"],
    ["get", "fractionMatching"],
    0,
    scale(0.7),
    0.2,
    scale(0.8),
    0.4,
    scale(0.85),
    0.6,
    scale(0.9),
    0.8,
    scale(0.95),
    1,
    scale(1),
  ];
}

export const LayerTemplate = {
  type: "fill",
  // slot: "top",
  source: "all-cells",
  "source-layer": "cells",
  paint: {
    "fill-color": "red",
    // [
    //   "case",
    //   ["has", "highlighted"],
    //   [
    //     "case",
    //     ["to-boolean", ["get", "highlighted"]],
    //     [
    //       "case",
    //       ["==", ["get", "resolution"], 6],
    //       colorScaleForResolution(6),
    //       ["==", ["get", "resolution"], 7],
    //       colorScaleForResolution(7),
    //       ["==", ["get", "resolution"], 8],
    //       colorScaleForResolution(8),
    //       ["==", ["get", "resolution"], 9],
    //       colorScaleForResolution(9),
    //       ["==", ["get", "resolution"], 10],
    //       colorScaleForResolution(10),
    //       ["==", ["get", "resolution"], 11],
    //       colorScaleForResolution(11),
    //       colorScale(1),
    //     ],
    //     colors.empty,
    //   ],
    //   colorScale(1),
    // ],
    "fill-outline-color": "black",
    "fill-opacity": 0.8,
  },
};

// TODO: this should be derived from the metadata once the service is updated
const STATIC_TILESET_URL = `https://tiles.seasketch.org/crdss-cells-6/{z}/{x}/{y}.pbf`;

export class FilterLayerManager {
  private metadata: FilterServiceMetadata;
  private location: string;
  private mapContext: MapContextManager;
  private filterString = "";
  private currentLayerCount = 0;
  // eslint-disable-next-line i18next/no-literal-string
  private layerId = `filter-layer-${Math.random().toString(36).substring(7)}`;

  constructor(
    location: string,
    metadata: FilterServiceMetadata,
    MapContextManager: MapContextManager,
    filterString?: string
  ) {
    this.metadata = metadata;
    this.location = location.replace(/\/$/, "");
    this.mapContext = MapContextManager;
    this.filterString = filterString || "";
    // add all-cells source
    if (!this.mapContext?.map) {
      throw new Error("Map not initialized");
    }
    if (!this.mapContext.map.getSource("all-cells")) {
      this.mapContext.map.addSource("all-cells", {
        type: "vector",
        tiles: [STATIC_TILESET_URL],
        // TODO: this should be set by metadata. Maybe the whole source definition
        // should be passed in?
        maxzoom: 14,
      });
      this.mapContext.map.addLayer({
        // eslint-disable-next-line i18next/no-literal-string
        id: `all-cells`,
        ...LayerTemplate,
        // TODO: source layer should be set by metadata
        source: "all-cells",
        paint: {
          ...LayerTemplate.paint,
          "fill-color": colors.empty,
          "fill-opacity": 0.5,
        },
      } as FillLayer);
    }
    this.mapContext.map.addLayer({
      id: `${this.layerId}-${this.currentLayerCount}`,
      ...LayerTemplate,
    } as FillLayer);
    this.updateLayer();
  }

  destroy() {
    if (!this.mapContext?.map) {
      throw new Error("Map not initialized");
    }
    for (const layer of this.mapContext.map.getStyle().layers || []) {
      if (layer.id.startsWith(this.layerId)) {
        this.mapContext.map.removeLayer(layer.id);
        if ("source" in layer && layer.source !== "all-cells") {
          this.mapContext.map.removeSource(layer.source as string);
        }
      }
    }
    this.mapContext.map.removeLayer("all-cells");
    this.mapContext.map.removeSource("all-cells");
  }

  updateFilter(filter: string) {
    if (this.filterString !== filter) {
      this.filterString = filter;
      this.debouncedUpdateLayer();
    }
  }

  debouncedUpdateLayer = debounce(this.updateLayer, 50);

  updateLayer() {
    if (!this.mapContext?.map) {
      throw new Error("Map not initialized");
    }
    const map = this.mapContext.map;
    const ac = new AbortController();
    // eslint-disable-next-line i18next/no-literal-string
    let url = `${this.location}/v${this.metadata.version}/mvt/{z}/{x}/{y}.pbf`;
    if (this.filterString.length > 0) {
      // eslint-disable-next-line i18next/no-literal-string
      url += `?filter=${this.filterString}`;
    } else {
      url = STATIC_TILESET_URL;
    }
    const currentLayerId = `${this.layerId}-${this.currentLayerCount}`;
    try {
      const currentLayer = map.getLayer(currentLayerId) as FillLayer;
      if (currentLayer && currentLayer.source) {
        const currentSource = map.getSource(
          currentLayer.source as string
        ) as mapboxgl.VectorSource;
        if (currentLayer && currentSource && currentSource.tiles?.[0] !== url) {
          map.setPaintProperty(currentLayerId, "fill-color", [
            "case",
            ["to-boolean", ["get", "highlighted"]],
            colors.stale,
            colors.empty,
          ]);
        }
        this.currentLayerCount++;
        if (this.currentLayerCount > 100) {
          this.currentLayerCount = 0;
        }
        const newLayerId = `${this.layerId}-${this.currentLayerCount}`;
        // setCellsAreLoading(true);
        map.addSource(newLayerId, {
          type: "vector",
          tiles: [url],
          maxzoom: 14,
        });
        map.addLayer({
          id: newLayerId,
          ...LayerTemplate,
          source: newLayerId,
        } as FillLayer);

        map.on("sourcedata", () => {
          this.debouncedRemoveStaleLayers(map);
        });
        this.debouncedRemoveStaleLayers(map);

        setTimeout(() => {
          this.debouncedRemoveStaleLayers(map);
        }, 2000);

        // setBaseUrl(url);
        return () => {
          ac.abort();
        };
      }
    } catch (e: any) {
      console.error(e);
    }
  }

  removeStaleLayers(map: mapboxgl.Map) {
    const style = map.getStyle();
    if (!style) return;
    const layers = style.layers;
    if (!layers) {
      return;
    }
    const currentLayerId = `${this.layerId}-${this.currentLayerCount}`;
    const currentLayer = map.getLayer(currentLayerId) as FillLayer;
    const regex = new RegExp(`^${this.layerId}`);
    const staleLayers = layers.filter(
      (l) => regex.test(l.id) && l.id !== currentLayerId
    ) as FillLayer[];
    if (currentLayer && currentLayer.source) {
      const currentSource = map.getSource(
        currentLayer.source as string
      ) as VectorSource;
      if (currentSource.id && map.isSourceLoaded(currentSource.id)) {
        // remove all stale layers and sources
        staleLayers.forEach((layer) => {
          map.removeLayer(layer.id);
          if (layer.source !== "all-cells") {
            map.removeSource(layer.source as string);
          }
        });
      } else if (staleLayers.length > 1) {
        // There are multiple stale layers. We want to keep the latest one that is
        // loaded on the map, but remove the others.
        const loaded = staleLayers.find((l) =>
          map.isSourceLoaded(l.source as string)
        );
        for (const layer of staleLayers) {
          if (layer !== loaded) {
            map.removeLayer(layer.id);
            if (layer.source !== "all-cells") {
              map.removeSource(layer.source as string);
            }
          }
        }
      }
    }
  }

  debouncedRemoveStaleLayers = debounce(this.removeStaleLayers, 10);
}
