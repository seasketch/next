import mapboxgl, { AnyLayer, AnySourceData, Map } from "mapbox-gl";
import { CustomSourceType } from "./CustomGLSource";
import { WMSBaseSource, WMSCommonOptions } from "./WMSBaseSource";
import { buildGetMapUrl } from "./urls";
import { xyzToWebMercatorBbox } from "./util";

export interface WMSTiledSourceOptions extends WMSCommonOptions {}

/** Mapbox custom raster source spec (loadTile receives AbortSignal for cancellation). */
type WmsCustomRasterSource = {
  type: "custom";
  tileSize: number;
  minzoom: number;
  maxzoom: number;
  bounds?: [number, number, number, number];
  attribution?: string;
  loadTile: (
    tile: { z: number; x: number; y: number },
    options: { signal: AbortSignal }
  ) => Promise<ImageBitmap | undefined | null>;
  onAdd?: (map: Map) => void;
  onRemove?: (map: Map) => void;
  update?: () => void;
};

export class WMSTiledSource extends WMSBaseSource {
  type: CustomSourceType = "WMSTiledSource";
  private lastTiledUrlTemplate?: string;
  private customSourceSpec?: WmsCustomRasterSource;
  private mapInteracting = false;
  private deferWhileMoving: boolean;

  constructor(options: WMSTiledSourceOptions) {
    super(options);
    this.deferWhileMoving = options.deferTilesWhileMoving !== false;
  }

  protected onLayersUpdated(): void {
    const template = this.getTiledUrlTemplate();
    if (template === this.lastTiledUrlTemplate) {
      return;
    }
    this.lastTiledUrlTemplate = template;
    this.customSourceSpec?.update?.();
  }

  private onInteractionStart = (): void => {
    this.mapInteracting = true;
  };

  private onInteractionEnd = (): void => {
    this.mapInteracting = false;
    this.customSourceSpec?.update?.();
  };

  private getTilePixelSize(): number {
    const tileSize = this.options.tileSize || 256;
    if (
      this.options.supportHighDpiDisplays &&
      typeof window !== "undefined" &&
      window.devicePixelRatio > 1
    ) {
      return Math.round(tileSize * window.devicePixelRatio);
    }
    return tileSize;
  }

  private async fetchTileImage(
    z: number,
    x: number,
    y: number,
    signal: AbortSignal
  ): Promise<ImageBitmap> {
    const layerNames = this.getActiveLayerNames();
    if (!layerNames.length) {
      throw new Error("No WMS layers active");
    }
    const baseUrl = this.metadata?.getMap.url || this.options.url;
    const size = this.getTilePixelSize();
    const url = buildGetMapUrl({
      baseUrl,
      version: this.metadata?.version || this.options.version || "1.3.0",
      layers: layerNames,
      styles: this.getActiveStyles(),
      crs: this.getCrs(),
      bbox: xyzToWebMercatorBbox(z, x, y),
      width: size,
      height: size,
      format: this.options.format || "image/png",
      transparent: this.options.transparent !== false,
      vendorParams: this.options.vendorParams,
    });
    const response = await this.fetchFn(url, { signal });
    if (!response.ok) {
      throw new Error(`WMS GetMap failed (${response.status})`);
    }
    const blob = await response.blob();
    if (signal.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    return createImageBitmap(blob);
  }

  private buildCustomSourceSpec(meta: {
    bounds?: [number, number, number, number];
    minzoom: number;
    maxzoom: number;
    attribution?: string;
  }): WmsCustomRasterSource {
    const tileSize = this.options.tileSize || 256;
    const spec: WmsCustomRasterSource = {
      type: "custom",
      tileSize,
      minzoom: meta.minzoom,
      maxzoom: meta.maxzoom,
      bounds: meta.bounds,
      attribution: meta.attribution,
      loadTile: async ({ z, x, y }, { signal }) => {
        if (this.deferWhileMoving && this.mapInteracting) {
          // Mapbox keeps parent tiles visible until moveend triggers update().
          return undefined;
        }
        if (!this.getActiveLayerNames().length) {
          return null;
        }
        try {
          return await this.fetchTileImage(z, x, y, signal);
        } catch (err) {
          if (
            signal.aborted ||
            (err instanceof DOMException && err.name === "AbortError")
          ) {
            return undefined;
          }
          throw err;
        }
      },
      onAdd: (map) => {
        this.map = map;
        if (this.deferWhileMoving) {
          map.on("movestart", this.onInteractionStart);
          map.on("zoomstart", this.onInteractionStart);
          map.on("moveend", this.onInteractionEnd);
          map.on("zoomend", this.onInteractionEnd);
        }
        map.on("data", this.onMapData);
        map.on("error", this.onMapError);
      },
      onRemove: (map) => {
        if (this.deferWhileMoving) {
          map.off("movestart", this.onInteractionStart);
          map.off("zoomstart", this.onInteractionStart);
          map.off("moveend", this.onInteractionEnd);
          map.off("zoomend", this.onInteractionEnd);
        }
        map.off("data", this.onMapData);
        map.off("error", this.onMapError);
        if (this.map === map) {
          this.map = undefined;
        }
      },
    };
    this.customSourceSpec = spec;
    return spec;
  }

  async getGLSource(_map: Map): Promise<AnySourceData> {
    const meta = await this.getComputedMetadata();
    this.lastTiledUrlTemplate = this.getTiledUrlTemplate();
    return this.buildCustomSourceSpec(meta) as unknown as AnySourceData;
  }

  async getGLStyleLayers(): Promise<{ layers: AnyLayer[] }> {
    const { layers } = await super.getGLStyleLayers();
    return {
      layers: layers.map((layer) => ({
        ...layer,
        paint: {
          ...(layer as mapboxgl.RasterLayer).paint,
          "raster-fade-duration": 300,
        },
      })) as AnyLayer[],
    };
  }

  async addToMap(map: Map): Promise<string> {
    this.map = map;
    const sourceData = await this.getGLSource(map);
    map.addSource(this.sourceId, sourceData);
    return this.sourceId;
  }

  addEventListeners(map: Map): void {
    // Custom source onAdd/onRemove own map listeners when added via the style.
    this.map = map;
  }

  removeEventListeners(map: Map): void {
    if (this.map === map) {
      this.map = undefined;
    }
  }
}
