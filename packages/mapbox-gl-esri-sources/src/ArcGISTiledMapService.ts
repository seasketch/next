import { Map, RasterLayer, RasterSource } from "mapbox-gl";
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

export interface ArcGISTiledMapServiceOptions extends CustomGLSourceOptions {
  url: string;
  supportHighDpiDisplays?: boolean;
  token?: string;
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
    const minzoom = Math.min(...levels);
    const maxzoom = Math.max(...levels);
    if (!serviceMetadata.tileInfo?.rows) {
      throw new Error("Invalid tile info");
    }
    return {
      minzoom,
      maxzoom,
      bounds: await extentToLatLngBounds(serviceMetadata.fullExtent),
      tileSize: serviceMetadata.tileInfo!.rows,
      attribution,
    };
  }

  /**
   * Add source to map. Does not add any layers to the map.
   * @param map Mapbox GL JS Map
   * @returns sourceId
   */
  async addToMap(map: mapboxgl.Map) {
    this.map = map;
    const { minzoom, maxzoom, bounds, tileSize, attribution } =
      await this.getComputedProperties();
    const sourceData = {
      type: "raster",
      tiles: [`${this.options.url}/tile/{z}/{y}/{x}`],
      tileSize: this.options.supportHighDpiDisplays
        ? tileSize / window.devicePixelRatio
        : tileSize,
      minzoom,
      maxzoom,
      attribution,
      ...(bounds ? { bounds } : {}),
    } as RasterSource;
    // It's possible that the map has changed since we started fetching metadata
    if (this.map.getSource(this.sourceId)) {
      replaceSource(this.sourceId, this.map, sourceData);
    } else {
      this.map.addSource(this.sourceId, sourceData);
    }
    return this.sourceId;
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
    if (map.getSource(this.sourceId)) {
      const layers = map.getStyle().layers || [];
      for (const layer of layers) {
        if ("source" in layer && layer.source === this.sourceId) {
          map.removeLayer(layer.id);
        }
      }
      map.removeSource(this.sourceId);
      this.map = undefined;
    }
  }

  /**
   * Removes the source from the map and removes any event listeners
   */
  destroy(): void {
    if (this.map) {
      this.removeFromMap(this.map);
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
}
