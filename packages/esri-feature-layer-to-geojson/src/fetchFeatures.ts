import { Feature, FeatureCollection, Geometry } from "geojson";

const PAGINATION_LIMIT = 100;
/** Yielded by fetchFeatures */
export interface PagedFeatures {
  /** Array of GeoJSON features */
  features: Feature<Geometry>[];
  /** Current page number */
  pagesFetched: number;
}

/**
 * Provides an async generator to fetch features from an ArcGIS Feature Layer.
 * Some services may be fetchable using a single request, but for those that
 * exceed the 1000 feature limit, this generator will handle pagination,
 * yeilding each page of features as they are fetched.
 *
 * @param baseUrl Should end in the layer number, e.g.
 * `https://services.arcgis.com/.../FeatureServer/0`
 * @param options AbortController can be used to abort the operation
 */
export async function* fetchFeatures(
  baseUrl: string,
  options?: {
    /**
     * Can be used to abort the operation
     */
    abortController?: AbortController;
  }
) {
  const params = new URLSearchParams({
    inSR: "4326",
    outSR: "4326",
    where: "1>0",
    outFields: "*",
    returnGeometry: "true",
    geometryPrecision: "6",
    returnIdsOnly: "false",
    resultRecordCount: "200",
    f: "geojson",
  });
  let pagesFetched = 0;
  let objectIdFieldName: string | undefined = undefined;
  const opts = {
    ...(options?.abortController
      ? {
          signal: options.abortController.signal,
        }
      : {}),
  };
  while (pagesFetched < PAGINATION_LIMIT) {
    const response = await fetch(`${baseUrl}/query?${params.toString()}`, opts);
    const str = await response.text();
    let fc: FeatureCollection & {
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
    try {
      fc = JSON.parse(str);
    } catch (e: any) {
      const errorMatches = /<p class="errorLabel">([^<]+)</.exec(str);
      if (errorMatches?.[1]) {
        throw new Error(
          `ArcGIS Server returned an error while attempting to export feature data: ${errorMatches[1].trim()}`
        );
      } else {
        throw new Error(`Failed to parse response: ${e.toString()}`);
      }
    }
    if (fc.error) {
      throw new Error(fc.error.message);
    }
    pagesFetched++;
    yield { features: fc.features, pagesFetched } as PagedFeatures;
    if (fc.exceededTransferLimit || fc.properties?.exceededTransferLimit) {
      if (!objectIdFieldName) {
        // Fetch objectIds to do manual paging (where objectId > lastObjectId)
        params.set("returnIdsOnly", "true");
        // params.delete("resultRecordCount");
        const oldResultRecordCount = params.get("resultRecordCount");
        params.set("resultRecordCount", "1");
        const r = await fetch(`${baseUrl}/query?${params.toString()}`, opts);
        const objectIdParameters = (await r.json()) as any;
        objectIdFieldName =
          objectIdParameters.objectIdFieldName ||
          objectIdParameters.properties?.objectIdFieldName;
        if (!objectIdFieldName) {
          throw new Error(
            "Could not identify objectIdFieldName to support pagination"
          );
        }
        // remove the param so future requests get the full geometry
        params.delete("returnIdsOnly");
        if (oldResultRecordCount) {
          params.set("resultRecordCount", oldResultRecordCount);
        } else {
          params.delete("resultRecordCount");
        }
      }
      params.delete("where");
      params.set("orderByFields", objectIdFieldName);
      const lastFeature = fc.features[fc.features.length - 1];
      params.set("where", `${objectIdFieldName}>${lastFeature.id}`);
    } else {
      break;
    }
  }
}

export async function getLayerName(baseUrl: string) {
  const response = await fetch(`${baseUrl}?f=json`);
  const json = (await response.json()) as {
    name: string;
    error?: { message: string; details: string[] };
  };
  if (json.error) {
    if (json.error.message && json.error.message === "Invalid URL") {
      throw new Error(
        "Location refers to ArcGIS Server but not to a valid feature layer. Does this layer still exist on the server? " +
          baseUrl
      );
    } else {
      throw new Error(json.error.message || json.error.details.join(", "));
    }
  }
  return json.name;
}
