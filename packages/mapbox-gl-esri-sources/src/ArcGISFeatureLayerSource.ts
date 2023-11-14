import {
  ArcGISRESTServiceRequestManager,
  CustomGLSource,
  ImageList,
  styleForFeatureLayer,
} from "../index";
import {
  ComputedMetadata,
  CustomGLSourceOptions,
  CustomSourceType,
  LegendItem,
  OrderedLayerSettings,
} from "./CustomGLSource";
import { v4 as uuid } from "uuid";
import { GeoJSONSourceRaw, Layer, Map } from "mapbox-gl";
import {
  FeatureServerMetadata,
  LayersMetadata,
  MapServiceMetadata,
} from "./ServiceMetadata";
import {
  contentOrFalse,
  extentToLatLngBounds,
  generateMetadataForLayer,
} from "./utils";
import { FeatureCollection } from "geojson";
import { fetchFeatureCollection } from "./fetchData";
import {
  QuantizedVectorRequestManager,
  getOrCreateQuantizedVectorRequestManager,
} from "./QuantizedVectorRequestManager";
import * as tilebelt from "@mapbox/tilebelt";
import { fetchWithTTL } from "./ArcGISRESTServiceRequestManager";
const tileDecode = require("arcgis-pbf-parser");

export interface ArcGISFeatureLayerSourceOptions extends CustomGLSourceOptions {
  /**
   * URL for the service. Should end in /FeatureServer/{layerId} or /MapServer/{layerId}.
   */
  url: string;
  /**
   * All query parameters will be added to each query request, overriding any
   * settings made by this library. Useful for filtering or working with
   * temporal data.
   **/
  queryParameters?: {
    [queryString: string]: string | number;
  };
  token?: string;
  /**
   * Indicates how to fetch feature geometry from the service.
   * - "raw": The entire dataset will be downloaded and rendered client-side. This
   *   may be slow for large datasets but is the most efficient option for smaller ones.
   * - "quantized": Simplified vectors for only the current viewport will be
   *   fetched and updated when the map extent changes.
   * - "auto": Will attempt the "raw" strategy up to a byte limit (default 2MB) and
   *   fall back to "quantized" if the limit is exceeded.
   * @default "auto"
   */
  fetchStrategy?: "auto" | "raw" | "tiled";
  /**
   * If fetchStrategy is "auto", this is the byte limit before switching from
   * "raw" to "quantized" mode. Default 2MB.
   * @default 2_000_000
   */
  autoFetchByteLimit?: number;
  cacheKey?: string;
}

export function isFeatureLayerSource(
  source: CustomGLSource<any>
): source is ArcGISFeatureLayerSource {
  return source.type === "ArcGISFeatureLayer";
}

export default class ArcGISFeatureLayerSource
  implements CustomGLSource<ArcGISFeatureLayerSourceOptions, LegendItem[]>
{
  /** Source id used in the map style */
  sourceId: string;
  layerId: number;
  options: ArcGISFeatureLayerSourceOptions;
  private map?: Map;
  private requestManager: ArcGISRESTServiceRequestManager;
  private serviceMetadata?: FeatureServerMetadata | MapServiceMetadata;
  private layerMetadata?: LayersMetadata;
  private _loading = true;
  private featureData?: FeatureCollection;
  private rawFeaturesHaveBeenFetched = false;
  private exceededBytesLimit = false;
  private QuantizedVectorRequestManager?: QuantizedVectorRequestManager;
  private cache?: Cache;
  error?: string;
  type: CustomSourceType;
  url: string;

  constructor(
    requestManager: ArcGISRESTServiceRequestManager,
    options: ArcGISFeatureLayerSourceOptions
  ) {
    this.type = "ArcGISFeatureLayer";
    this.sourceId = options.sourceId || uuid();
    this.options = options;
    this.requestManager = requestManager;
    this.url = this.options.url;
    // remove trailing slash if present
    options.url = options.url.replace(/\/$/, "");
    if (
      !/rest\/services/.test(options.url) ||
      (!/MapServer/.test(options.url) && !/FeatureServer/.test(options.url))
    ) {
      throw new Error("Invalid ArcGIS REST Service URL");
    }
    if (!/\d+$/.test(options.url)) {
      throw new Error(
        "URL must end in /FeatureServer/{layerId} or /MapServer/{layerId}"
      );
    }
    this.layerId = parseInt(options.url.match(/\d+$/)?.[0] || "0");
    const cache = caches
      .open(options?.cacheKey || "seasketch-arcgis-rest-services")
      .then((cache) => {
        this.cache = cache;
      });
  }

  _computedMetadata?: ComputedMetadata;

  async getComputedMetadata(): Promise<ComputedMetadata> {
    try {
      if (!this._computedMetadata) {
        const { serviceMetadata, layers } = await this.getMetadata();
        const { bounds, minzoom, maxzoom, attribution } =
          await this.getComputedProperties();
        const layer = layers.layers.find((l) => l.id === this.layerId);
        const glStyle = await this.getGLStyleLayers();
        if (!layer) {
          throw new Error("Layer not found");
        }
        this._computedMetadata = {
          bounds,
          minzoom,
          maxzoom,
          attribution,
          supportsDynamicRendering: {
            layerOpacity: false,
            layerVisibility: false,
            layerOrder: false,
          },
          tableOfContentsItems: [
            {
              type: "data",
              defaultVisibility: true,
              id: this.sourceId,
              label: layer.name!,
              metadata: generateMetadataForLayer(
                this.options.url.replace(/\/\d+$/, ""),
                serviceMetadata,
                layer
              ),
              glStyle: glStyle,
            },
          ],
        };
      }
      return this._computedMetadata;
    } catch (e: any) {
      this.error = e.toString();
      throw e;
    }
  }

  /**
   * Private method used as the basis for getComputedMetadata and also used
   * when generating the source data for addToMap.
   * @returns Computed properties for the service, including bounds, minzoom, maxzoom, and attribution.
   */
  private async getComputedProperties() {
    const { serviceMetadata, layers } = await this.getMetadata();
    const attribution =
      contentOrFalse(serviceMetadata.copyrightText) || undefined;
    const layer = layers.layers.find((l) => l.id === this.layerId);
    if (!layer) {
      throw new Error(`Sublayer ${this.layerId} not found`);
    }
    const supportedFormats = (layer?.supportedQueryFormats || "")
      .split(",")
      .map((f) => f.toUpperCase().trim());
    this.tileFormat = supportedFormats.includes("PBF") ? "pbf" : "geojson";
    return {
      minzoom: 0,
      maxzoom: 24,
      bounds:
        (await extentToLatLngBounds(
          layer?.extent || serviceMetadata.fullExtent
        )) || undefined,
      attribution,
      supportedFormats,
    };
  }

  private fireError(e: Error) {
    this.map?.fire("error", {
      sourceId: this.sourceId,
      error: e.message,
    });
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
      if (/FeatureServer/.test(this.options.url)) {
        return this.requestManager
          .getFeatureServerMetadata(this.options.url.replace(/\/\d+$/, ""), {
            token: this.options.token,
          })
          .then(({ serviceMetadata, layers }) => {
            this.serviceMetadata = serviceMetadata;
            this.layerMetadata = layers;
            return { serviceMetadata, layers };
          });
      } else {
        return this.requestManager
          .getMapServiceMetadata(this.options.url.replace(/\d+[\/]*$/, ""), {
            token: this.options.token,
          })
          .then(({ serviceMetadata, layers }) => {
            this.serviceMetadata = serviceMetadata;
            this.layerMetadata = layers;
            return { serviceMetadata, layers };
          });
      }
    }
  }

  get loading() {
    return this._loading;
  }

  private _glStylePromise?: Promise<{ layers: Layer[]; imageList: ImageList }>;

  private _styleIsResolved = false;
  async getGLStyleLayers() {
    if (this._glStylePromise) {
      return this._glStylePromise;
    } else {
      this._glStylePromise = new Promise(async (resolve, reject) => {
        const { serviceMetadata, layers } = await this.getMetadata();
        const layer = layers.layers.find((l) => l.id === this.layerId);
        if (!layer) {
          throw new Error("Layer not found");
        }
        const styleInfo = styleForFeatureLayer(
          this.options.url.replace(/\/\d+$/, ""),
          this.layerId,
          this.sourceId,
          layer
        );
        this._styleIsResolved = true;
        resolve(styleInfo);
      });
      return this._glStylePromise;
    }
  }

  async getGLSource() {
    const { attribution } = await this.getComputedProperties();
    return {
      type: "geojson",
      data: this.featureData || {
        type: "FeatureCollection",
        features: this.featureData || [],
      },
      attribution: attribution ? attribution : "",
    } as GeoJSONSourceRaw;
  }

  addEventListeners(map: Map) {
    if (this.map && this.map === map) {
      return;
    } else if (this.map) {
      this.removeEventListeners(map);
    }
    this.map = map;
    this.QuantizedVectorRequestManager =
      getOrCreateQuantizedVectorRequestManager(map);
    this._loading = this.featureData ? false : true;
    if (!this.rawFeaturesHaveBeenFetched) {
      this.fetchFeatures();
    }
  }

  removeEventListeners(map: Map) {
    this.QuantizedVectorRequestManager?.off("update");
    delete this.QuantizedVectorRequestManager;
    delete this.map;
  }

  async addToMap(map: Map) {
    const source = await this.getGLSource();
    map.addSource(this.sourceId, source);
    this.addEventListeners(map);
    return this.sourceId;
  }

  private abortController: AbortController | null = null;

  private async fetchFeatures() {
    if (
      this.options?.fetchStrategy === "tiled" ||
      this.getCachedAutoFetchStrategy() === "tiled"
    ) {
      this.options.fetchStrategy = "tiled";
      this.QuantizedVectorRequestManager!.on(
        "update",
        this.fetchTiles.bind(this)
      );
      this.fetchTiles();
      return;
    }
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();
    setTimeout(() => {
      this.abortController?.abort("timeout");
    }, 10000);
    if (this.exceededBytesLimit) {
      return;
    }
    try {
      const data = await fetchFeatureCollection(
        this.options.url,
        6,
        "*",
        this.options.fetchStrategy === "raw"
          ? 120_000_000
          : this.options.autoFetchByteLimit || 2_000_000,
        this.abortController,
        this.options.fetchStrategy === "auto"
      );
      this.featureData = data;
      const source = this.map?.getSource(this.sourceId);
      if (source && source.type === "geojson") {
        this.options.fetchStrategy = "raw";
        source.setData(data);
      }
      this._loading = false;
      this.rawFeaturesHaveBeenFetched = true;
    } catch (e) {
      let shouldFireError = true;
      if (
        ("message" in (e as any) && /bytesLimit/.test((e as any).message)) ||
        this.abortController?.signal?.reason === "timeout"
      ) {
        this.exceededBytesLimit = true;
        if (this.options.fetchStrategy === "auto") {
          shouldFireError = false;
          this.options.fetchStrategy = "tiled";
          this.QuantizedVectorRequestManager!.on(
            "update",
            this.fetchTiles.bind(this)
          );
          this.fetchTiles();
          this.cacheAutoFetchStrategy("tiled");
        }
      }
      if (shouldFireError) {
        this.fireError(e as Error);
        console.error(e);
      }
      this._loading = false;
    }
  }

  private cacheAutoFetchStrategy(mode: "raw" | "tiled") {
    localStorage.setItem(
      `${this.options.url}/fetchStrategy`,
      `${mode}-${new Date().getTime()}`
    );
  }

  private getCachedAutoFetchStrategy() {
    const value = localStorage.getItem(`${this.options.url}/fetchStrategy`);
    if (!value || value.length === 0) {
      return null;
    } else {
      const [mode, timestamp] = value.split("-");
      if (new Date().getTime() - parseInt(timestamp) > 1000 * 60 * 60) {
        localStorage.setItem(`${this.options.url}/fetchStrategy`, "");
        return null;
      } else {
        return mode as "raw" | "tiled";
      }
    }
  }

  private tileFormat = "geojson";

  private async fetchTiles() {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();
    this._loading = true;
    if (!this.QuantizedVectorRequestManager) {
      throw new Error("QuantizedVectorRequestManager not initialized");
    } else if (this.options.fetchStrategy !== "tiled") {
      throw new Error(
        "fetchTiles called when fetchStrategy is not quantized. Was " +
          this.options.fetchStrategy
      );
    }
    const { tiles, tolerance } =
      this.QuantizedVectorRequestManager.viewportDetails;

    const fc = {
      type: "FeatureCollection",
      features: [],
    } as FeatureCollection;
    const featureIds = new Set<number>();
    try {
      let wasAborted = false;
      await Promise.all(
        tiles.map((tile) =>
          (async () => {
            const tileBounds = tilebelt.tileToBBOX(tile);

            const extent = {
              spatialReference: {
                latestWkid: 4326,
                wkid: 4326,
              },
              xmin: tileBounds[0],
              ymin: tileBounds[1],
              xmax: tileBounds[2],
              ymax: tileBounds[3],
            };
            const params = new URLSearchParams({
              f: this.tileFormat,
              geometry: JSON.stringify(extent),
              outFields: "*",
              outSR: "4326",
              returnZ: "false",
              returnM: "false",
              precision: "8",
              where: "1=1",
              setAttributionFromService: "true",
              quantizationParameters: JSON.stringify({
                extent,
                tolerance,
                mode: "view",
              }),
              resultType: "tile",
              spatialRel: "esriSpatialRelIntersects",
              maxAllowableOffset:
                this.tileFormat === "geojson" ? tolerance.toString() : "",
              geometryType: "esriGeometryEnvelope",
              inSR: "4326",
              ...this.options.queryParameters,
            });
            return fetchWithTTL(
              `${`${this.options.url}/query?${params.toString()}`}`,
              60 * 10,
              this.cache!,
              { signal: this.abortController?.signal },
              `${this.options.url}/query/tiled/${tilebelt.tileToQuadkey(
                tile
              )}/${params.get("f")}`
            )
              .then((response) =>
                params.get("f") === "pbf"
                  ? response.arrayBuffer()
                  : response.json()
              )
              .then((data) => {
                if (this.abortController?.signal?.aborted) {
                  return;
                }
                const collection =
                  params.get("f") === "pbf"
                    ? tileDecode(new Uint8Array(data)).featureCollection
                    : data;
                for (const feature of collection.features) {
                  if (!featureIds.has(feature.id)) {
                    featureIds.add(feature.id);
                    fc.features.push(feature);
                  }
                }
              })
              .catch((e) => {
                if (!/aborted/i.test(e.toString())) {
                  this.fireError(e as Error);
                  console.error(e);
                } else {
                  wasAborted = true;
                }
              });
          })()
        )
      );
      if (this.abortController?.signal?.aborted || wasAborted) {
        return;
      }
      const source = this.map?.getSource(this.sourceId);
      if (source && source.type === "geojson") {
        source.setData(fc);
        this.featureData = fc;
      }
      this._loading = false;
    } catch (e: any) {
      if (!/aborted/i.test(e.toString())) {
        this.fireError(e as Error);
        console.error(e);
      }
      this._loading = false;
    }
  }

  async updateLayers(layerSettings: OrderedLayerSettings) {
    // throw new Error("Method not implemented.");
    const visible = Boolean(layerSettings.find((l) => l.id === this.sourceId));
    if (this.map) {
      const layers = this.map.getStyle().layers || [];
      for (const layer of layers) {
        if ("source" in layer && layer.source === this.sourceId) {
          this.map.setLayoutProperty(
            layer.id,
            "visibility",
            visible ? "visible" : "none"
          );
        }
      }
    }
    if (!visible) {
      this.pauseUpdates();
    } else if (!visible) {
      this.resumeUpdates();
    }
  }

  paused = false;

  private pauseUpdates() {
    if (this.paused === false) {
      this.paused = true;
    }
  }

  private resumeUpdates() {
    if (this.paused === true) {
      this.paused = false;
    }
  }

  async removeFromMap(map: Map) {
    if (this.map) {
      const source = map.getSource(this.sourceId);
      if (source) {
        const layers = map.getStyle().layers || [];
        for (const layer of layers) {
          if ("source" in layer && layer.source === this.sourceId) {
            map.removeLayer(layer.id);
          }
        }
        map.removeSource(this.sourceId);
      }
      this.removeEventListeners(map);
    }
  }

  destroy() {
    if (this.map) {
      this.removeFromMap(this.map);
    }
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  async getFetchStrategy() {
    if (this.options.fetchStrategy === "auto") {
      if (this.featureData) {
        return "raw";
      } else if (this.options.fetchStrategy === "auto" && !this.error) {
        // wait to finish loading then determine strategy
        return new Promise((resolve) => {
          const interval = setInterval(() => {
            if (this.options.fetchStrategy !== "auto") {
              clearInterval(interval);
              resolve(this.options.fetchStrategy || "auto");
            }
          }, 500);
        });
      } else {
        // not sure what to do here, punting
        return "auto";
      }
    } else {
      return this.options.fetchStrategy || "raw";
    }
  }

  get ready() {
    return this._styleIsResolved && Boolean(this._computedMetadata);
  }

  async prepare() {
    await this.getComputedMetadata();
    return;
  }
}
