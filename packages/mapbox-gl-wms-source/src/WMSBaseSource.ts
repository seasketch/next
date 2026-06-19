import mapboxgl, { AnyLayer, AnySourceData, Map } from "mapbox-gl";
import { v4 as uuid } from "uuid";
import debounce from "lodash.debounce";
import {
  flattenLayers,
  getLayerBounds,
  getNamedLayers,
  getSupportedWebMercatorCrs,
} from "./capabilities";
import {
  ComputedMetadata,
  CustomGLSourceOptions,
  DataTableOfContentsItem,
  DynamicRenderingSupportOptions,
  FolderTableOfContentsItem,
  LegendItem,
  OrderedLayerSettings,
} from "./CustomGLSource";
import { getLegendItems } from "./legends";
import { buildLayerMetadata } from "./metadata";
import { WMSServiceMetadata } from "./types";
import {
  blankDataUri,
  defaultFetch,
  enforceBoundsMinMax,
  FetchFn,
  getGroundResolution,
  getMapViewportCoordinates,
  getWebMercatorBboxFromMap,
  mergeBounds,
} from "./util";
import { buildGetMapUrl, buildTiledGetMapUrlTemplate } from "./urls";

export interface WMSCommonOptions extends CustomGLSourceOptions {
  url: string;
  version?: "1.1.1" | "1.3.0";
  crs?: string;
  format?: string;
  transparent?: boolean;
  supportHighDpiDisplays?: boolean;
  tileSize?: number;
  vendorParams?: Record<string, string | number | boolean>;
  fetch?: FetchFn;
  metadata?: WMSServiceMetadata;
}

export const WMS_SUPPORTS_DYNAMIC_RENDERING: DynamicRenderingSupportOptions = {
  layerOrder: true,
  layerVisibility: true,
  layerOpacity: false,
};

export abstract class WMSBaseSource {
  sourceId: string;
  url: string;
  error?: string;
  protected map?: Map;
  protected options: WMSCommonOptions;
  protected layers: OrderedLayerSettings = [];
  protected metadata?: WMSServiceMetadata;
  protected _computedMetadata?: ComputedMetadata;
  protected _loading = false;
  protected fetchFn: FetchFn;
  protected groupOpacity = 1;

  constructor(options: WMSCommonOptions) {
    this.options = options;
    this.url = options.url;
    this.sourceId = options.sourceId || uuid();
    this.fetchFn = options.fetch || defaultFetch;
  }

  get loading(): boolean {
    const source = this.map?.getSource(this.sourceId);
    if (source && source.type === "raster") {
      return this.map!.isSourceLoaded(this.sourceId) === false;
    }
    return this._loading;
  }

  get ready(): boolean {
    return Boolean(this._computedMetadata);
  }

  updateLayers(layers: OrderedLayerSettings): void {
    this.layers = layers;
    this.onLayersUpdated();
  }

  setGroupOpacity(opacity: number): void {
    this.groupOpacity = opacity;
    this.onLayersUpdated();
  }

  protected abstract onLayersUpdated(): void;

  protected async loadMetadata(): Promise<WMSServiceMetadata> {
    if (this.options.metadata) {
      this.metadata = this.options.metadata;
      return this.metadata;
    }
    if (this.metadata) {
      return this.metadata;
    }
    const { fetchCapabilities } = await import("./catalog");
    const result = await fetchCapabilities(this.options.url, {
      fetch: this.fetchFn,
      version: this.options.version,
      serviceUrl: this.options.url,
    });
    this.metadata = result.metadata;
    return this.metadata;
  }

  protected getActiveLayerNames(): string[] {
    return this.layers.map((l) => l.id);
  }

  protected getActiveStyles(): string[] {
    const names = this.getActiveLayerNames();
    if (!this.metadata) {
      return names.map(() => "");
    }
    return names.map((name) => {
      const layer = getNamedLayers(this.metadata!.layers).find(
        (l) => l.name === name
      );
      return layer?.styles[0]?.name || "";
    });
  }

  protected getCrs(): string {
    return (
      this.options.crs ||
      (this.metadata && getSupportedWebMercatorCrs(this.metadata)) ||
      "EPSG:3857"
    );
  }

  protected buildGetMapParams(map: Map): {
    bbox: [number, number, number, number];
    width: number;
    height: number;
  } {
    const bbox = getWebMercatorBboxFromMap(map);
    const zoom =
      map.getZoom() +
      (this.options.supportHighDpiDisplays && typeof window !== "undefined"
        ? window.devicePixelRatio - 1
        : 0);
    const groundResolution = getGroundResolution(zoom);
    const width = Math.max(
      1,
      Math.round((bbox[2] - bbox[0]) / groundResolution)
    );
    const height = Math.max(
      1,
      Math.round((bbox[3] - bbox[1]) / groundResolution)
    );
    return { bbox, width, height };
  }

  protected getMapUrl(map?: Map): string {
    if (!this.getActiveLayerNames().length) {
      return blankDataUri;
    }
    map = map || this.map;
    if (!map) {
      return blankDataUri;
    }
    const { bbox, width, height } = this.buildGetMapParams(map);
    const baseUrl = this.metadata?.getMap.url || this.options.url;
    return buildGetMapUrl({
      baseUrl,
      version: this.metadata?.version || this.options.version || "1.3.0",
      layers: this.getActiveLayerNames(),
      styles: this.getActiveStyles(),
      crs: this.getCrs(),
      bbox,
      width,
      height,
      format: this.options.format || "image/png",
      transparent: this.options.transparent !== false,
      vendorParams: this.options.vendorParams,
    });
  }

  protected getTiledUrlTemplate(): string {
    if (!this.getActiveLayerNames().length) {
      return blankDataUri;
    }
    const baseUrl = this.metadata?.getMap.url || this.options.url;
    return buildTiledGetMapUrlTemplate({
      baseUrl,
      version: this.metadata?.version || this.options.version || "1.3.0",
      layers: this.getActiveLayerNames(),
      styles: this.getActiveStyles(),
      crs: this.getCrs(),
      format: this.options.format || "image/png",
      transparent: this.options.transparent !== false,
      tileSize: this.options.tileSize || 256,
      supportHighDpi: this.options.supportHighDpiDisplays,
      vendorParams: this.options.vendorParams,
    });
  }

  protected buildTableOfContentsItems(): (
    | FolderTableOfContentsItem
    | DataTableOfContentsItem
  )[] {
    if (!this.metadata) {
      return [];
    }
    const items: (FolderTableOfContentsItem | DataTableOfContentsItem)[] = [];
    const addLayerTree = (layers: typeof this.metadata.layers, parentId?: string) => {
      for (const layer of layers) {
        if (layer.name) {
          const meta = buildLayerMetadata(this.metadata!, layer.name);
          const legend = getLegendItems(this.metadata!, layer.name);
          items.push({
            type: "data",
            id: layer.name,
            label: layer.title || layer.name,
            defaultVisibility: true,
            metadata: meta.prosemirror,
            legend,
            parentId,
          });
        } else if (layer.title && layer.children.length) {
          const folderId = layer.title.replace(/\s+/g, "_");
          items.push({
            type: "folder",
            id: folderId,
            label: layer.title,
            defaultVisibility: true,
            parentId,
          });
          addLayerTree(layer.children, folderId);
        } else if (layer.children.length) {
          addLayerTree(layer.children, parentId);
        }
      }
    };
    addLayerTree(this.metadata.layers);
    if (!items.length) {
      return getNamedLayers(this.metadata.layers).map((layer) => {
        const meta = buildLayerMetadata(this.metadata!, layer.name!);
        return {
          type: "data" as const,
          id: layer.name!,
          label: layer.title || layer.name!,
          defaultVisibility: true,
          metadata: meta.prosemirror,
          legend: getLegendItems(this.metadata!, layer.name!),
        };
      });
    }
    return items;
  }

  async getComputedMetadata(): Promise<ComputedMetadata> {
    if (this._computedMetadata) {
      return this._computedMetadata;
    }
    const metadata = await this.loadMetadata();
    let bounds: [number, number, number, number] | undefined;
    for (const layer of flattenLayers(metadata.layers)) {
      bounds = mergeBounds(bounds, getLayerBounds(layer));
    }
    if (bounds) {
      bounds = enforceBoundsMinMax(bounds);
    }
    const attribution =
      this.options.attributionOverride ||
      metadata.title ||
      metadata.contact?.organization;
    this._computedMetadata = {
      bounds,
      minzoom: 0,
      maxzoom: 22,
      attribution,
      tableOfContentsItems: this.buildTableOfContentsItems(),
      supportsDynamicRendering: WMS_SUPPORTS_DYNAMIC_RENDERING,
    };
    return this._computedMetadata;
  }

  async prepare(): Promise<void> {
    try {
      await this.getComputedMetadata();
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      this.fireError(this.error);
    }
  }

  protected fireError(message: string): void {
    if (!this.map) return;
    // Custom source error event (mirrors mapbox-gl-esri-sources pattern)
    (this.map as Map & { fire(type: string, data: unknown): Map }).fire(
      "error",
      {
        sourceId: this.sourceId,
        error: message,
      }
    );
  }

  protected fireDataLoading(): void {
    this._loading = true;
    this.map?.fire("dataloading", {
      sourceId: this.sourceId,
      dataType: "source",
      sourceDataType: "content",
    });
  }

  protected onMapData = (event: mapboxgl.MapDataEvent) => {
    if ("sourceId" in event && event.sourceId === this.sourceId) {
      this._loading = false;
    }
  };

  protected onMapError = (event: mapboxgl.ErrorEvent & { sourceId?: string }) => {
    if (event.sourceId === this.sourceId) {
      this._loading = false;
      this.error =
        event.error instanceof Error
          ? event.error.message
          : String(event.error || "Unknown map error");
    }
  };

  async getGLStyleLayers(): Promise<{ layers: AnyLayer[] }> {
    return {
      layers: [
        {
          id: uuid(),
          type: "raster",
          source: this.sourceId,
          paint: {
            "raster-fade-duration": 0,
            "raster-opacity": this.groupOpacity,
          },
        },
      ],
    };
  }

  removeFromMap(map: Map): void {
    if (map.getSource(this.sourceId)) {
      const layers = map.getStyle().layers || [];
      for (const layer of layers) {
        if ("source" in layer && layer.source === this.sourceId) {
          map.removeLayer(layer.id);
        }
      }
      this.removeEventListeners(map);
      map.removeSource(this.sourceId);
      this.map = undefined;
    }
  }

  destroy(): void {
    if (this.map) {
      this.removeFromMap(this.map);
    }
  }

  abstract addEventListeners(map: Map): void;
  abstract removeEventListeners(map: Map): void;
  abstract getGLSource(map: Map): Promise<AnySourceData>;
  abstract addToMap(map: Map): Promise<string>;
}

export function debounced(fn: () => void, wait = 50): () => void {
  return debounce(fn, wait);
}

export type { LegendItem };
