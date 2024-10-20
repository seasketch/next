import { AnyLayer, Map, RasterLayer, RasterSource } from "mapbox-gl";
import { ArcGISRESTServiceRequestManager } from "./ArcGISRESTServiceRequestManager";
import {
  ComputedMetadata,
  CustomGLSource,
  CustomGLSourceOptions,
  CustomSourceType,
  LegendItem,
  OrderedLayerSettings,
} from "./CustomGLSource";
import { v4 as uuid } from "uuid";
import { LayersMetadata, MapServiceMetadata } from "./ServiceMetadata";
import {
  contentOrFalse,
  extentToLatLngBounds,
  generateMetadataForLayer,
  makeLegend,
  replaceSource,
} from "./utils";
import * as tilebelt from "@mapbox/tilebelt";
import { blankDataUri } from "./ArcGISDynamicMapService";

export interface ArcGISTiledMapServiceOptions extends CustomGLSourceOptions {
  url: string;
  supportHighDpiDisplays?: boolean;
  token?: string;
  /* Overrides the value derived from the service metadata */
  maxZoom?: number;
  /**
   * Use to set a developer api key for accessing Esri basemaps.
   * Not needed for other services
   */
  developerApiKey?: string;
}

/**
 * CustomGLSource used to add an ArcGIS Tile MapService.
 */
export class ArcGISTiledMapService
  implements CustomGLSource<ArcGISTiledMapServiceOptions, LegendItem[]>
{
  url: string;
  sourceId: string;
  options: ArcGISTiledMapServiceOptions;
  private map?: Map;
  private requestManager: ArcGISRESTServiceRequestManager;
  private serviceMetadata?: MapServiceMetadata;
  private layerMetadata?: LayersMetadata;
  error?: string;
  type: CustomSourceType;

  /**
   *
   * @param requestManager ArcGISRESTServiceRequestManager instance
   * @param options.url URL to ArcGIS REST MapServer (should end in /MapServer)
   * @param options.supportHighDpiDisplays If true, will detect high-dpi displays and request more tiles at higher resolution
   * @param options.credentials Optional. If provided, will use these credentials to request a token for the service.
   *
   */
  constructor(
    requestManager: ArcGISRESTServiceRequestManager,
    options: ArcGISTiledMapServiceOptions
  ) {
    this.type = "ArcGISTiledMapService";
    // remove trailing slash if present
    options.url = options.url.replace(/\/$/, "");
    this.url = options.url;
    if (!/rest\/services/.test(options.url) || !/MapServer/.test(options.url)) {
      throw new Error("Invalid ArcGIS REST Service URL");
    }
    this.requestManager = requestManager;
    this.sourceId = options.sourceId || uuid();
    this.options = options;
  }

  /**
   * Use ArcGISRESTServiceRequestManager to fetch metadata for the service,
   * caching it on the instance for reuse.
   */
  private getMetadata() {
    if (this.serviceMetadata && this.layerMetadata) {
      return Promise.resolve({
        serviceMetadata: this.serviceMetadata,
        layers: this.layerMetadata,
      });
    } else {
      return this.requestManager
        .getMapServiceMetadata(this.options.url, {
          token: this.options.token,
        })
        .then(({ serviceMetadata, layers }) => {
          this.serviceMetadata = serviceMetadata;
          this.layerMetadata = layers;
          return { serviceMetadata, layers };
        });
    }
  }

  private _computedMetadata?: ComputedMetadata;

  /**
   * Returns computed metadata for the service, including bounds, minzoom, maxzoom, and attribution.
   * @returns ComputedMetadata
   * @throws Error if metadata is not available
   * @throws Error if tileInfo is not available
   * */
  async getComputedMetadata(): Promise<ComputedMetadata> {
    try {
      if (!this._computedMetadata) {
        const { serviceMetadata, layers } = await this.getMetadata();
        const { bounds, minzoom, maxzoom, tileSize, attribution } =
          await this.getComputedProperties();
        const legendData = await this.requestManager.getLegendMetadata(
          this.options.url
        );
        const results = /\/([^/]+)\/MapServer/.exec(this.options.url);
        let label = results && results.length >= 1 ? results[1] : false;
        if (!label) {
          if (this.layerMetadata?.layers?.[0]) {
            label = this.layerMetadata.layers[0].name;
          }
        }

        this._computedMetadata = {
          bounds: bounds || undefined,
          minzoom,
          maxzoom,
          attribution,
          tableOfContentsItems: [
            {
              type: "data",
              id: this.sourceId,
              label: label || "Layer",
              defaultVisibility: true,
              metadata: generateMetadataForLayer(
                this.options.url,
                this.serviceMetadata!,
                this.layerMetadata!.layers[0]
              ),
              legend: makeLegend(legendData, legendData.layers[0].layerId),
            },
          ],
          supportsDynamicRendering: {
            layerOrder: false,
            layerOpacity: false,
            layerVisibility: false,
          },
        };
      }
      return this._computedMetadata;
    } catch (e: any) {
      this.error = e.toString();
      throw e;
    }
  }

  async getThumbnailForCurrentExtent() {
    if (!this.map) {
      throw new Error("Map not set");
    }
    const { minzoom } = await this.getComputedProperties();
    const map = this.map;
    const bounds = map.getBounds();
    const boundsArray = bounds.toArray();
    const primaryTile = tilebelt.bboxToTile([
      boundsArray[0][0],
      boundsArray[0][1],
      boundsArray[1][0],
      boundsArray[1][1],
    ]);
    let [x, y, z] = primaryTile;
    if (primaryTile[2] < minzoom) {
      let tile = primaryTile;
      while (tile[2] < minzoom) {
        tile = tilebelt.getChildren(tile)[0];
      }
      [x, y, z] = tile;
    }
    const url = `${this.options.url}/tile/${z}/${y}/${x}`;
    const res = await fetch(url);
    if (res.ok) {
      return url;
    } else {
      const children = tilebelt.getChildren(primaryTile);
      for (const child of children) {
        let [x, y, z] = primaryTile;
        const res = await fetch(url);
        if (res.ok) {
          return url;
        }
      }
      return blankDataUri;
      console.error(new Error("Could not find valid thumbnail tile"));
    }
  }

  /**
   * Returns true if the source is not yet loaded. Will return to false if tiles
   * are loading when the map is moved.
   */
  get loading() {
    return Boolean(
      this.map?.getSource(this.sourceId) &&
        this.map?.isSourceLoaded(this.sourceId) === false
    );
  }

  /**
   * Private method used as the basis for getComputedMetadata and also used
   * when generating the source data for addToMap.
   * @returns Computed properties for the service, including bounds, minzoom, maxzoom, and attribution.
   */
  private async getComputedProperties() {
    const { serviceMetadata, layers } = await this.getMetadata();
    const levels = serviceMetadata.tileInfo?.lods.map((l) => l.level) || [];
    const attribution =
      contentOrFalse(layers.layers[0].copyrightText) ||
      contentOrFalse(serviceMetadata.copyrightText) ||
      contentOrFalse(serviceMetadata.documentInfo?.Author) ||
      undefined;
    const minzoom = serviceMetadata.minLOD
      ? serviceMetadata.minLOD
      : Math.min(...levels);
    const maxzoom = serviceMetadata.maxLOD
      ? serviceMetadata.maxLOD
      : Math.max(...levels);
    if (!serviceMetadata.tileInfo?.rows) {
      throw new Error("Invalid tile info");
    }
    return {
      minzoom,
      maxzoom,
      bounds: await extentToLatLngBounds(serviceMetadata.fullExtent),
      tileSize: serviceMetadata.tileInfo!.rows,
      ...(attribution ? { attribution } : {}),
    };
  }

  /**
   * Add source to map. Does not add any layers to the map.
   * @param map Mapbox GL JS Map
   * @returns sourceId
   */
  async addToMap(map: mapboxgl.Map) {
    this.map = map;
    const sourceData = await this.getGLSource();
    // It's possible that the map has changed since we started fetching metadata
    if (this.map.getSource(this.sourceId)) {
      replaceSource(this.sourceId, this.map, sourceData);
    } else {
      this.map.addSource(this.sourceId, sourceData);
    }
    return this.sourceId;
  }

  async getGLSource() {
    let { minzoom, maxzoom, bounds, tileSize, attribution } =
      await this.getComputedProperties();
    attribution = this.options.attributionOverride || attribution;
    let url = `${this.options.url}/tile/{z}/{y}/{x}`;
    if (
      url.indexOf("services.arcgisonline.com") !== -1 &&
      this.options.developerApiKey
    ) {
      url = `${url}?token=${this.options.developerApiKey}`;
    }
    const sourceData = {
      type: "raster",
      tiles: [url],
      tileSize,
      minzoom,
      maxzoom: this.options.maxZoom || maxzoom,
      ...(attribution ? { attribution } : {}),
      ...(bounds ? { bounds } : {}),
    } as RasterSource;
    return sourceData;
  }

  /**
   * Returns a raster layer for the source.
   * @returns RasterLayer[]
   */
  async getGLStyleLayers() {
    return {
      layers: [
        {
          type: "raster",
          source: this.sourceId,
          id: uuid(),
          paint: {
            "raster-fade-duration": 300,
          },
        },
      ] as RasterLayer[],
    };
  }

  /**
   * Remove source from map. If there are any layers on the map that use this
   * source, they will also be removed.
   * @param map Mapbox GL JS Map
   */
  removeFromMap(map: Map) {
    const removedLayers: AnyLayer[] = [];
    if (map.getSource(this.sourceId)) {
      const layers = map.getStyle().layers || [];
      for (const layer of layers) {
        if ("source" in layer && layer.source === this.sourceId) {
          map.removeLayer(layer.id);
          removedLayers.push(layer);
        }
      }
      map.removeSource(this.sourceId);
      this.map = undefined;
    }
    return removedLayers;
  }

  /**
   * Removes the source from the map and removes any event listeners
   */
  destroy(): void {
    if (this.map) {
      this.removeFromMap(this.map);
    }
  }

  async updateMaxZoom(maxZoom: number | undefined) {
    const currentMaxZoom = (await this.getGLSource()).maxzoom;
    if (currentMaxZoom !== maxZoom) {
      this.options.maxZoom = maxZoom;
      if (this.map) {
        const map = this.map;
        const removedLayers = this.removeFromMap(map);
        this.addToMap(map);
        for (const layer of removedLayers) {
          map.addLayer(layer);
        }
      }
    }
  }

  /** noop */
  updateLayers(layers: OrderedLayerSettings) {}

  get ready() {
    return Boolean(this._computedMetadata);
  }

  async prepare() {
    await this.getComputedMetadata();
    return;
  }

  addEventListeners(map: Map) {
    this.map = map;
  }
  removeEventListeners(map: Map) {}
}

export function isArcGISTiledMapservice(
  source: CustomGLSource<any, any>
): source is ArcGISTiledMapService {
  return source.type === "ArcGISTiledMapService";
}
