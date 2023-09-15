import {
  ArcGISRESTServiceRequestManager,
  CustomGLSource,
  ImageList,
  styleForFeatureLayer,
} from "../index";
import {
  ComputedMetadata,
  CustomGLSourceOptions,
  LegendItem,
} from "./CustomGLSource";
import { v4 as uuid } from "uuid";
import {
  AnyLayer,
  GeoJSONSource,
  GeoJSONSourceOptions,
  Layer,
  Map,
} from "mapbox-gl";
import {
  FeatureServerMetadata,
  LayersMetadata,
  MapServiceMetadata,
} from "./ServiceMetadata";
import {
  contentOrFalse,
  extentToLatLngBounds,
  generateMetadataForLayer,
  makeLegend,
} from "./utils";
import { FeatureCollection } from "geojson";
import { fetchFeatureCollection } from "./fetchData";
import { fetchFeatureLayerData } from "./ArcGISVectorSource";

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
  credentials?: { username: string; password: string };
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
  fetchStrategy?: "auto" | "raw" | "quantized";
  /**
   * If fetchStrategy is "auto", this is the byte limit before switching from
   * "raw" to "quantized" mode. Default 2MB.
   * @default 2_000_000
   */
  autoFetchByteLimit?: number;
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

  constructor(
    requestManager: ArcGISRESTServiceRequestManager,
    options: ArcGISFeatureLayerSourceOptions
  ) {
    this.sourceId = options.sourceId || uuid();
    this.options = options;
    this.requestManager = requestManager;
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
  }

  async getComputedMetadata(): Promise<ComputedMetadata> {
    const { serviceMetadata, layers } = await this.getMetadata();
    const { bounds, minzoom, maxzoom, attribution } =
      await this.getComputedProperties();
    const layer = layers.layers.find((l) => l.id === this.layerId);
    const glStyle = await this.getGLStyleLayers();
    if (!layer) {
      throw new Error("Layer not found");
    }
    return {
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
    return {
      minzoom: 0,
      maxzoom: 24,
      bounds:
        (await extentToLatLngBounds(
          layer?.extent || serviceMetadata.fullExtent
        )) || undefined,
      attribution,
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
            credentials: this.options.credentials,
          })
          .then(({ serviceMetadata, layers }) => {
            this.serviceMetadata = serviceMetadata;
            this.layerMetadata = layers;
            return { serviceMetadata, layers };
          });
      } else {
        return this.requestManager
          .getMapServiceMetadata(this.options.url, {
            credentials: this.options.credentials,
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
  async getGLStyleLayers() {
    if (this._glStylePromise) {
      console.log("return promise");
      return this._glStylePromise;
    } else {
      console.log("make promise");
      this._glStylePromise = new Promise(async (resolve, reject) => {
        const { serviceMetadata, layers } = await this.getMetadata();
        const layer = layers.layers.find((l) => l.id === this.layerId);
        if (!layer) {
          throw new Error("Layer not found");
        }
        resolve(
          styleForFeatureLayer(
            this.options.url.replace(/\/\d+$/, ""),
            this.layerId,
            this.sourceId,
            layer
          )
        );
      });
      return this._glStylePromise;
    }
  }

  async addToMap(map: Map) {
    this.map = map;
    const { serviceMetadata, layers } = await this.getMetadata();
    const { attribution } = await this.getComputedProperties();
    map.addSource(this.sourceId, {
      type: "geojson",
      data: this.featureData || {
        type: "FeatureCollection",
        features: [],
      },
      attribution: attribution ? attribution : "",
    });
    this._loading = this.featureData ? false : true;
    if (!this.rawFeaturesHaveBeenFetched) {
      this.fetchFeatures();
    }
    return this.sourceId;
  }

  private async fetchFeatures() {
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
          : this.options.autoFetchByteLimit || 2_000_000
      );
      this.featureData = data;
      const source = this.map?.getSource(this.sourceId);
      if (source && source.type === "geojson") {
        source.setData(data);
      }
      this._loading = false;
      this.rawFeaturesHaveBeenFetched = true;
    } catch (e) {
      if ("message" in (e as any) && /bytesLimit/.test((e as any).message)) {
        this.exceededBytesLimit = true;
      }
      this.fireError(e as Error);
      console.error(e);
      this._loading = false;
    }
  }

  async updateLayers() {
    // throw new Error("Method not implemented.");
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
      this.map = undefined;
    }
  }

  destroy() {
    if (this.map) {
      this.removeFromMap(this.map);
    }
  }
}
