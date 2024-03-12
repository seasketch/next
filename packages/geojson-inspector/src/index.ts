import { FailedInspectorResponse, InspectorResponse } from "./types";
import calcBBox from "@turf/bbox";
import geostats, {
  GeostatsLayer,
} from "../../spatial-uploads-handler/src/geostats";

export interface Env {}

/**
 * The geojson-inspector is designed to validate GeoJSON data for use in
 * SeaSketch using a direct connection as a remote data source. To support that,
 * it confirms:
 *
 *   * The url is valid and returns a 200 status code
 *   * The response is a valid GeoJSON object
 *   * The GeoJSON object is a Feature or FeatureCollection with a simple
 *     geometry type
 * 	 * And includes some useful context for consideration such as the bounding
 * 	   box, content length, and latency
 *
 */
export interface Env {}

/**
 * The geojson-inspector is designed to validate GeoJSON data for use in
 * SeaSketch using a direct connection as a remote data source. To support that,
 * it confirms:
 *
 *   * The url is valid and returns a 200 status code
 *   * The response is a valid GeoJSON object
 *   * The GeoJSON object is a Feature or FeatureCollection with a simple
 *     geometry type
 * 	 * And includes some useful context for consideration such as the bounding
 * 	   box, content length, and latency
 *
 */
export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    // validate that request is a GET request and includes a search param named
    // location
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }
    // create a URL, access searchparams, and get the location
    const url = new URL(request.url);
    const location = url.searchParams.get("location");
    // if location is not provided return an error
    if (!location) {
      return new Response("Please provide a location", { status: 400 });
    }
    // fetch the geojson from the provided location, and calculate the latency
    const startT = performance.now();
    const response = await fetch(location, {
      headers: {
        accept: "application/json",
      },
    });
    const latency = performance.now() - startT;

    // if the fetch fails return an error
    if (!response.ok) {
      return handleFailedResponse(response, location, request);
    } else {
      let contentLength = parseInt(
        response.headers.get("content-length") || "0"
      );
      // if size is not provided as a header, calculate it from the blob
      if (contentLength === 0) {
        const blob = await response.clone().blob();
        contentLength = blob.size;
      }
      try {
        const geojson: any = await response.json();
        if (!("type" in geojson)) {
          return new Response(
            JSON.stringify({
              location,
              error: "Response is not a valid GeoJSON",
              errorsStatus: 200,
            }),
            FAILED_RESPONSE_OPTS(request)
          );
        } else if (
          geojson.type !== "FeatureCollection" &&
          geojson.type !== "Feature"
        ) {
          return new Response(
            JSON.stringify({
              location,
              error: "GeoJSON object must be a Feature or FeatureCollection",
              errorsStatus: 200,
            }),
            FAILED_RESPONSE_OPTS(request)
          );
        } else {
          const rootType = geojson.type;
          let geometryType =
            rootType === "Feature"
              ? geojson.geometry.type
              : geojson.features && geojson.features.length > 0
              ? geojson.features[0]?.geometry?.type
              : "Unknown";
          const fname = location.substr(1 + location.lastIndexOf("/"));
          return new Response(
            JSON.stringify({
              location,
              contentLength,
              contentType: response.headers.get("content-type"),
              cacheControl: response.headers.get("cache-control"),
              latency,
              rootType,
              featureCount:
                rootType === "FeatureCollection" ? geojson.features.length : 1,
              geometryType,
              bbox: calcBBox(geojson),
              geostats: geostats(
                geojson,
                fname && fname.length ? fname : "geojson"
              ),
            } as InspectorResponse),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=120, s-maxage=120",
                ...(isAllowedOrigin(request.headers.get("origin") || "")
                  ? {
                      "Access-Control-Allow-Origin":
                        request.headers.get("origin")!,
                    }
                  : {}),
              },
            }
          );
        }
      } catch (e) {
        return new Response(
          JSON.stringify({
            location,
            error: "Failed to parse response as JSON",
            errorsStatus: 200,
          }),
          FAILED_RESPONSE_OPTS(request)
        );
      }
    }
  },
};

const FAILED_RESPONSE_OPTS = (req: Request) => {
  const origin = req.headers.get("origin");
  return {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=10, s-maxage=10",
      ...(origin && isAllowedOrigin(origin)
        ? { "Access-Control-Allow-Origin": origin }
        : {}),
    },
  };
};

async function handleFailedResponse(
  response: Response,
  location: string,
  req: Request
) {
  let failedResponse: FailedInspectorResponse;
  if (response.status === 404) {
    failedResponse = {
      location,
      error: "Server returned 404. Location not found",
      errorsStatus: 404,
    };
  } else if (response.status >= 400 && response.status < 500) {
    failedResponse = {
      location,
      error: "Client error. Please check the location",
      errorsStatus: response.status,
    };
  } else {
    const text = await response.text();
    failedResponse = {
      location,
      error: "Server error. Could not retrieve data from location.\n" + text,
      errorsStatus: response.status,
    };
  }
  return new Response(
    JSON.stringify(failedResponse),
    FAILED_RESPONSE_OPTS(req)
  );
}

const allowedOrigins = [
  "localhost",
  "127.0.0.1",
  "*.seasketch.org",
  "seasketch.org",
];

function isAllowedOrigin(origin: string) {
  // No origin provided, possibly a non-CORS request or server-to-server request
  if (!origin) return false;

  // Extract the domain from the origin
  const domain = new URL(origin).hostname;

  if (allowedOrigins.includes(domain)) {
    return true;
  }

  const wildCardOrigins = allowedOrigins.filter((o) => o.startsWith("*."));
  for (const origin of wildCardOrigins) {
    if (domain.endsWith(origin.slice(2))) {
      return true;
    }
  }

  // Origin does not match any allowed pattern
  return false;
}
