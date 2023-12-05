import { Map, GeoJSONSource } from "mapbox-gl";
import { Feature, FeatureCollection } from "geojson";
// @ts-ignore
// import { arcgisToGeoJSON } from "@terraformer/arcgis";

export interface ArcGISVectorSourceOptions {
  /**
   * Number of digits precision after the decimal to fetch from the origin
   * server. The default of 6 a good compromise between precision (~10cm) and
   * download size.
   * @type {number}
   * @default 6
   */
  geometryPrecision?: number;
  /**
   * Set to false if the service is known not to support pagination, which will
   * be true for services that have only a single feature but is also indicated
   * by the main service metadata.
   *
   * If left to the default of true and the server does not support pagination,
   * the initial fetch of data will fail but a second request will be
   * constructed without pagination parameters which should succeed.
   *
   * @type {boolean}
   * @default true
   */
  supportsPagination?: boolean;
  /**
   * Can be used to limit fields in GeoJSON properties.
   * @type {string}
   * @default "*"
   */
  outFields?: string;
  bytesLimit?: number;
  onError?: (error: Error) => void;
}

/**
 * Add ArcGIS Feature Layers to MapBox GL JS maps as a geojson source. These
 * data sources can be styled using output from
 * {@link styleForFeatureLayer } or custom layers that
 * reference the provided source id.
 *
 * ### Usage
 *
 * ```typescript
 * import { ArcGISVectorSource } from "mapbox-gl-esri-sources";
 *
 * // setup map...
 *
 * const esriSource = new ArcGISVectorSource(
 *   map,
 *   'cities-source-id',
 *   "https://sampleserver6.arcgisonline.com/arcgis/rest/services/SampleWorldCities/MapServer/0"),
 *   {
 *     geometryPrecision: 5,
 *     outFields: "POP,CITY_NAME"
 *   }
 * );
 * ```
 * @class ArcGISVectorSource
 */
export class ArcGISVectorSource {
  private data = {
    type: "FeatureCollection",
    features: [],
  } as FeatureCollection;
  /**
   * GeoJSONSource instance added to the map
   * @type {GeoJSONSource}
   */
  protected source: GeoJSONSource;
  private _id: string;
  private baseUrl: string;
  private options:
    | undefined
    | {
        geometryPrecision?: number;
      };
  private map: Map;
  private outFields = "*";
  private supportsPagination = true;
  /** Set to true when source is fetching data */
  private _loading = true;

  /**
   * Creates an instance of ArcGISVectorSource.
   * @param {Map} map MapBox GL JS map instance where source will be added
   * @param {string} id ID will be assigned to the GeoJSONSource instance
   * @param {string} url Base url for an [ArcGIS Server Feature Layer](https://developers.arcgis.com/rest/services-reference/layer-table.htm). Should end in _/MapServer/0..n_
   */
  constructor(
    map: Map,
    id: string,
    url: string,
    options?: ArcGISVectorSourceOptions
  ) {
    this._id = id;
    this.baseUrl = url;
    this.options = options;
    this.map = map;
    this.map.addSource(this._id, {
      data: this.data,
      type: "geojson",
    });
    if (
      options &&
      "supportsPagination" in options &&
      options["supportsPagination"] === false
    ) {
      this.supportsPagination = false;
    }
    if (options && options.outFields) {
      this.outFields = options.outFields;
    }
    this.source = this.map.getSource(this._id) as GeoJSONSource;
    let hadError = false;
    const onError = (e: Error) => {
      hadError = true;
      this._loading = false;
      this.map.fire("error", {
        source: this.source,
        sourceId: this._id,
        error: e,
      });
    };
    this.map.fire("dataloading", {
      source: this.source,
      sourceId: this._id,
      dataType: "source",
      isSourceLoaded: false,
      sourceDataType: "content",
    });
    fetchFeatureLayerData(
      this.baseUrl,
      this.outFields,
      onError,
      this.options?.geometryPrecision,
      null,
      null,
      false,
      1000,
      options?.bytesLimit
    )
      .then((fc) => {
        this._loading = false;
        if (!hadError) {
          this.source.setData(fc);
        }
      })
      .catch(onError);
  }

  get loading(): boolean {
    return this._loading;
  }

  get id(): string {
    return this._id;
  }

  /**
   * Remove the source from the map and any related event listeners
   */
  destroy() {
    this.map.removeSource(this._id);
  }
}

export async function fetchFeatureLayerData(
  url: string,
  outFields: string,
  onError: (error: Error) => void,
  geometryPrecision = 6,
  abortController: AbortController | null = null,
  onPageReceived:
    | ((
        bytes: number,
        loadedFeatures: number,
        estimatedFeatures: number
      ) => void)
    | null = null,
  disablePagination = false,
  pageSize = 1000,
  bytesLimit?: number
) {
  const featureCollection: FeatureCollection = {
    type: "FeatureCollection",
    features: [],
  };
  const params = new URLSearchParams({
    inSR: "4326",
    outSR: "4326",
    where: "1>0",
    outFields,
    returnGeometry: "true",
    geometryPrecision: geometryPrecision.toString(),
    returnIdsOnly: "false",
    f: "geojson",
  });
  await fetchData(
    url,
    params,
    featureCollection,
    onError,
    abortController || new AbortController(),
    onPageReceived,
    disablePagination,
    pageSize,
    bytesLimit
  );
  return featureCollection;
}

async function fetchData(
  baseUrl: string,
  params: URLSearchParams,
  featureCollection: FeatureCollection,
  onError: (error: Error) => void,
  abortController: AbortController,
  onPageReceived:
    | ((
        bytes: number,
        loadedFeatures: number,
        estimatedFeatures: number
      ) => void)
    | null,
  disablePagination = false,
  pageSize = 1000,
  bytesLimit?: number,
  bytesReceived?: number,
  objectIdFieldName?: string,
  expectedFeatureCount?: number
) {
  bytesReceived = bytesReceived || 0;
  const decoder = new TextDecoder("utf-8");
  params.set("returnIdsOnly", "false");
  if (featureCollection.features.length > 0) {
    // fetch next page using objectIds
    let featureIds: number[];
    params.delete("where");
    params.delete("resultOffset");
    params.delete("resultRecordCount");
    params.set("orderByFields", objectIdFieldName!);
    const lastFeature =
      featureCollection.features[featureCollection.features.length - 1];
    params.set("where", `${objectIdFieldName}>${lastFeature.id}`);
  }
  const response = await fetch(`${baseUrl}/query?${params.toString()}`, {
    mode: "cors",
    signal: abortController.signal,
  });
  const str = await response.text();
  bytesReceived += byteLength(str);
  console.log("got", bytesReceived, response);
  if (bytesLimit && bytesReceived >= bytesLimit) {
    const e = new Error(
      `Exceeded bytesLimit. ${bytesReceived} >= ${bytesLimit}`
    );
    return onError(e);
  }

  const fc = JSON.parse(str) as FeatureCollection & {
    error?: {
      code: number;
      message: string;
    };
    exceededTransferLimit?: boolean;
  };
  console.log("fc", fc);
  if (fc.error) {
    console.log("fc.error found", fc.error);
    return onError(new Error(fc.error.message));
  } else {
    featureCollection.features.push(...fc.features);

    if (
      fc.exceededTransferLimit ||
      // @ts-ignore
      ("properties" in fc && fc.properties.exceededTransferLimit)
    ) {
      if (!objectIdFieldName) {
        // Fetch objectIds to do manual paging
        params.set("returnIdsOnly", "true");
        try {
          const r = await fetch(`${baseUrl}/query?${params.toString()}`, {
            mode: "cors",
            signal: abortController.signal,
          });
          const featureIds = featureCollection.features.map((f) => f.id);
          const objectIdParameters = await r.json();
          expectedFeatureCount = objectIdParameters.objectIds
            ? objectIdParameters.objectIds.length
            : objectIdParameters.properties.objectIds.length;
          objectIdFieldName =
            "properties" in objectIdParameters
              ? objectIdParameters.properties.objectIdFieldName
              : objectIdParameters.objectIdFieldName;
        } catch (e) {
          return onError(e as Error);
        }
      }

      console.log("on page receivved", onPageReceived);
      if (onPageReceived) {
        onPageReceived(
          bytesReceived,
          featureCollection.features.length,
          expectedFeatureCount!
        );
      }

      await fetchData(
        baseUrl,
        params,
        featureCollection,
        onError,
        abortController,
        onPageReceived,
        disablePagination,
        pageSize,
        bytesLimit,
        bytesReceived,
        objectIdFieldName,
        expectedFeatureCount
      );
    }
  }

  if (onPageReceived) {
    onPageReceived(
      bytesReceived,
      featureCollection.features.length,
      expectedFeatureCount!
    );
  }

  return bytesReceived;
}

// https://stackoverflow.com/a/23329386/299467
function byteLength(str: string) {
  // returns the byte length of an utf8 string
  var s = str.length;
  for (var i = str.length - 1; i >= 0; i--) {
    var code = str.charCodeAt(i);
    if (code > 0x7f && code <= 0x7ff) s++;
    else if (code > 0x7ff && code <= 0xffff) s += 2;
    if (code >= 0xdc00 && code <= 0xdfff) i--; //trail surrogate
  }
  return s;
}
