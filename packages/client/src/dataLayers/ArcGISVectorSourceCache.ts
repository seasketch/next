import bytes from "bytes";
import LRUCache from "lru-cache";
import { FeatureCollection } from "geojson";
import { DataSourceTypes } from "../generated/graphql";
import { fetchFeatureLayerData } from "mapbox-gl-esri-feature-layers";
import { byteLength } from "../admin/data/arcgis/arcgis";
import { ClientDataSource } from "./MapContextManager";
import { nextTick } from "process";

interface QueryParameters {
  geometryPrecision?: number;
  outFields?: string;
}

interface CacheItem {
  promise: Promise<FeatureCollection>;
  value?: FeatureCollection;
  /* Size in bytes, updated as features are paged */
  bytes?: number;
  loadedFeatures: number;
  estimatedFeatures?: number;
  error?: Error;
  queryParameters?: QueryParameters;
}

type EventType = "progress" | "data" | "error";
export interface ArcGISVectorSourceCacheEvent {
  type: EventType;
  item: CacheItem;
  key: string;
}
type Listener = (event: ArcGISVectorSourceCacheEvent) => void;

let cacheId = 0;

/**
 * Fetches complete GeoJSON representations of ArcGIS Server-based
 * vector sources.
 */
class ArcGISVectorSourceCache {
  private cacheSize: number;
  private cache: LRUCache<string, CacheItem>;
  private listeners: {
    [type: string]: Listener[];
  } = {
    progress: [],
    error: [],
    data: [],
  };
  private cacheId: number;

  /**
   * @param cacheSize Cache size limit in bytes
   */
  constructor(
    cacheSize: number,
    onDispose: (key: string, item: CacheItem) => CacheItem | void
  ) {
    this.cacheId = cacheId++;
    this.cacheSize = cacheSize;
    this.cache = new LRUCache({
      max: cacheSize,
      length: (item, key) => item.bytes || 0,
      dispose: (key, item) => {
        const newItem = onDispose(key, item);
        if (newItem) {
          nextTick(() => {
            this.cache.set(key, item);
          });
        }
      },
      noDisposeOnSet: true,
    });
  }

  get(
    source: Pick<ClientDataSource, "type" | "id" | "queryParameters" | "url">,
    clearCache = false
  ): CacheItem {
    if (source.type !== DataSourceTypes.ArcgisVector) {
      throw new Error("Can only be used with ArcgisVector source types");
    }
    if (clearCache) {
      this.cache.del(source.id.toString());
    }
    let item = this.cache.get(source.id.toString());
    if (
      !item ||
      !this.queryParametersMatch(item.queryParameters, source.queryParameters)
    ) {
      item = this.fetch(source);
      this.cache.set(source.id.toString(), item);
    }
    return item;
  }

  on(eventName: EventType, listener: Listener) {
    if (
      this.listeners[eventName] &&
      this.listeners[eventName].indexOf(listener) === -1
    ) {
      this.listeners[eventName].push(listener);
    }
  }

  off(eventName: EventType, listener: Listener) {
    if (this.listeners[eventName]) {
      const index = this.listeners[eventName].indexOf(listener);
      if (index >= 0) {
        this.listeners[eventName] = [
          ...this.listeners[eventName].slice(0, index),
          ...this.listeners[eventName].slice(index + 1),
        ];
      }
    }
  }

  isSourceLoading(sourceId: string): boolean {
    const cacheItem = this.cache.peek(sourceId);
    if (!cacheItem || cacheItem.error || cacheItem.value) {
      return false;
    }
    return true;
  }

  clearErrorsForKey(key: string) {
    const cacheItem = this.cache.peek(key);
    if (cacheItem && cacheItem.error) {
      this.cache.del(key);
    }
  }

  private fetch(
    source: Pick<ClientDataSource, "type" | "id" | "queryParameters" | "url">
  ) {
    // @ts-ignore
    const cacheItem: CacheItem = {
      loadedFeatures: 0,
      queryParameters: { ...source.queryParameters },
    };

    const promise = new Promise<FeatureCollection>((resolve, reject) => {
      fetchFeatureLayerData(
        source.url!,
        cacheItem.queryParameters?.outFields || "*",
        (e) => {
          reject(e);
        },
        cacheItem.queryParameters?.geometryPrecision || 6,
        null,
        (bytes, loadedFeatures, estimatedFeatures) => {
          const cacheItem = this.cache.get(source.id.toString());
          if (cacheItem && !cacheItem.error) {
            cacheItem.bytes = bytes;
            cacheItem.loadedFeatures = loadedFeatures;
            cacheItem.estimatedFeatures = estimatedFeatures;
            this.cache.set(source.id.toString(), cacheItem);
            this.fireEvent("progress", cacheItem, source.id.toString());
          }
        },
        undefined,
        undefined,
        bytes("50mb")
      )
        .then((data) => {
          const cacheItem = this.cache.get(source.id.toString());
          if (cacheItem && !cacheItem.error) {
            cacheItem.value = data;
            cacheItem.bytes = byteLength(JSON.stringify(data));
            this.cache.set(source.id.toString(), cacheItem);
            this.fireEvent("data", cacheItem, source.id.toString());
          }
          resolve(data);
        })
        .catch((e) => {
          reject(e);
        });
    });
    promise.catch((e) => {
      const cacheItem = this.cache.get(source.id.toString());
      if (cacheItem) {
        cacheItem.error = e;
        this.cache.set(source.id.toString(), cacheItem);
        this.fireEvent("error", cacheItem, source.id.toString());
      }
    });
    cacheItem.promise = promise;
    return cacheItem;
  }

  private fireEvent(type: EventType, item: CacheItem, key: string) {
    const listeners = this.listeners[type];
    if (listeners && listeners.length) {
      for (const listener of listeners) {
        listener({ type, item, key });
      }
    }
  }

  private queryParametersMatch(a?: QueryParameters, b?: QueryParameters) {
    if (!a && !b) {
      return true;
    } else if (!a && b) {
      return false;
    } else if (b && !a) {
      return false;
    } else {
      return (
        (a?.geometryPrecision || 6) === (b?.geometryPrecision || 6) &&
        (a?.outFields || "*") === (b?.outFields || "*")
      );
    }
  }
}

export default ArcGISVectorSourceCache;
// export default new ArcGISVectorSourceCache(bytes("50mb"));
