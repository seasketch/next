import { FeatureCollection } from "geojson";

export function fetchFeatureCollection(
  url: string,
  geometryPrecision = 6,
  outFields = "*",
  bytesLimit = 1000000 * 100,
  abortController: AbortController | null = null,
  disablePagination = false
) {
  return new Promise<FeatureCollection>((resolve, reject) => {
    fetchFeatureLayerData(
      url,
      outFields,
      reject,
      geometryPrecision,
      abortController,
      null,
      disablePagination,
      undefined,
      bytesLimit
    )
      .then((data) => resolve(data))
      .catch((e) => reject(e));
  });
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
    abortController,
    onPageReceived,
    disablePagination,
    pageSize,
    bytesLimit
  );
  return featureCollection;
}

export function urlForRawGeoJSONData(
  baseUrl: string,
  outFields = "*",
  geometryPrecision = 6,
  queryOptions?: { [key: string]: string }
) {
  const params = new URLSearchParams({
    inSR: "4326",
    outSR: "4326",
    where: "1>0",
    outFields,
    returnGeometry: "true",
    geometryPrecision: geometryPrecision.toString(),
    returnIdsOnly: "false",
    f: "geojson",
    ...(queryOptions || {}),
  });
  return `${baseUrl}/query?${params.toString()}`;
}

async function fetchData(
  baseUrl: string,
  params: URLSearchParams,
  featureCollection: FeatureCollection,
  onError: (error: Error) => void,
  abortController: AbortController | null,
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
    // mode: "cors",
    ...(abortController ? { signal: abortController.signal } : {}),
  });
  const str = await response.text();
  bytesReceived += byteLength(str);
  if (bytesLimit && bytesReceived > bytesLimit) {
    const e = new Error(
      `Exceeded bytesLimit. ${bytesReceived} > ${bytesLimit}`
    );
    return onError(e);
  }

  const fc = JSON.parse(str) as FeatureCollection & {
    error?: {
      code: number;
      message: string;
    };
    exceededTransferLimit?: boolean;
    /* used in (arcgis-online only?) feature servers */
    properties?: {
      exceededTransferLimit?: boolean;
    };
  };
  if (fc.error) {
    return onError(new Error(fc.error.message));
  } else {
    featureCollection.features.push(...fc.features);
    if (fc.exceededTransferLimit || fc.properties?.exceededTransferLimit) {
      if (disablePagination) {
        throw new Error("Exceeded transfer limit. Pagination disabled.");
      }
      if (!objectIdFieldName) {
        // Fetch objectIds to do manual paging
        params.set("returnIdsOnly", "true");
        try {
          const r = await fetch(`${baseUrl}/query?${params.toString()}`, {
            // mode: "cors",
            ...(abortController ? { signal: abortController.signal } : {}),
          });
          let objectIdParameters = await r.json();
          // FeatureServers (at least on ArcGIS Online) behave differently
          if (objectIdParameters.properties) {
            objectIdParameters = objectIdParameters.properties;
          }
          expectedFeatureCount = objectIdParameters.objectIds.length;
          objectIdFieldName = objectIdParameters.objectIdFieldName;
        } catch (e) {
          return onError(e as Error);
        }
      }

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
