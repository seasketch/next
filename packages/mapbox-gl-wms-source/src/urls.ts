import {
  GetFeatureInfoUrlParams,
  GetLegendGraphicUrlParams,
  GetMapUrlParams,
  WMSVersion,
} from "./types";
import { blankDataUri, normalizeCrs } from "./util";

function appendParams(
  url: URL,
  params: Record<string, string | number | boolean | undefined>,
  /**
   * Keys that must be emitted even when their value is an empty string. The WMS
   * spec marks some parameters (notably STYLES on GetMap) as mandatory, and
   * strict servers (MapServer, some GeoServer configs) return a
   * ServiceException when they are omitted entirely.
   */
  alwaysEmit: Set<string> = new Set()
) {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }
    if (value === "" && !alwaysEmit.has(key)) {
      continue;
    }
    url.searchParams.set(key, String(value));
  }
}

function formatBbox(
  version: WMSVersion,
  crs: string,
  bbox: [number, number, number, number]
): string {
  const normalized = normalizeCrs(crs);
  if (version === "1.3.0" && normalized === "EPSG:4326") {
    // WMS 1.3.0 axis order for EPSG:4326 is lat,lon
    const [minx, miny, maxx, maxy] = bbox;
    return [miny, minx, maxy, maxx].join(",");
  }
  return bbox.join(",");
}

function crsParamName(version: WMSVersion): "CRS" | "SRS" {
  return version === "1.3.0" ? "CRS" : "SRS";
}

function featureInfoPointParams(
  version: WMSVersion,
  x: number,
  y: number
): Record<string, string> {
  if (version === "1.3.0") {
    return { I: String(Math.round(x)), J: String(Math.round(y)) };
  }
  return { X: String(Math.round(x)), Y: String(Math.round(y)) };
}

export function buildGetMapUrl(params: GetMapUrlParams): string {
  if (!params.layers.length) {
    return blankDataUri;
  }
  const url = new URL(params.baseUrl.split("?")[0]);
  const existing = new URL(params.baseUrl, "http://localhost");
  existing.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  const crsKey = crsParamName(params.version);
  const styles =
    params.styles && params.styles.length
      ? params.styles
      : params.layers.map(() => "");

  appendParams(
    url,
    {
      SERVICE: "WMS",
      VERSION: params.version,
      REQUEST: "GetMap",
      [crsKey]: params.crs,
      BBOX: formatBbox(params.version, params.crs, params.bbox),
      WIDTH: params.width,
      HEIGHT: params.height,
      LAYERS: params.layers.join(","),
      STYLES: styles.join(","),
      FORMAT: params.format || "image/png",
      TRANSPARENT: params.transparent === false ? "FALSE" : "TRUE",
      TIME: params.time,
      ELEVATION: params.elevation,
      ...(params.vendorParams || {}),
    },
    // STYLES is mandatory per the WMS spec, even when empty.
    new Set(["STYLES"])
  );

  return url.toString();
}

export function buildTiledGetMapUrlTemplate(
  params: Omit<GetMapUrlParams, "bbox" | "width" | "height"> & {
    tileSize?: number;
    supportHighDpi?: boolean;
  }
): string {
  if (!params.layers.length) {
    return blankDataUri;
  }
  const tileSize = params.tileSize || 256;
  const width =
    params.supportHighDpi && typeof window !== "undefined"
      ? tileSize * window.devicePixelRatio
      : tileSize;
  return buildGetMapUrl({
    ...params,
    bbox: [-20037508.34, -20037508.34, 20037508.34, 20037508.34],
    width,
    height: width,
  }).replace(
    /BBOX=[^&]+/,
    "BBOX={bbox-epsg-3857}"
  );
}

export function buildGetFeatureInfoUrl(
  params: GetFeatureInfoUrlParams
): string {
  const url = new URL(params.baseUrl.split("?")[0]);
  const existing = new URL(params.baseUrl, "http://localhost");
  existing.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  const crsKey = crsParamName(params.version);
  appendParams(
    url,
    {
      SERVICE: "WMS",
      VERSION: params.version,
      REQUEST: "GetFeatureInfo",
      [crsKey]: params.crs,
      BBOX: formatBbox(params.version, params.crs, params.bbox),
      WIDTH: params.width,
      HEIGHT: params.height,
      LAYERS: params.layers.join(","),
      // GetFeatureInfo shares the GetMap parameters; STYLES must accompany
      // LAYERS for spec-compliant servers.
      STYLES: params.layers.map(() => "").join(","),
      QUERY_LAYERS: params.queryLayers.join(","),
      INFO_FORMAT: params.infoFormat || "application/json",
      FEATURE_COUNT: params.featureCount ?? 10,
      ...featureInfoPointParams(params.version, params.x, params.y),
      ...(params.vendorParams || {}),
    },
    new Set(["STYLES"])
  );
  return url.toString();
}

export function buildGetLegendGraphicUrl(
  params: GetLegendGraphicUrlParams
): string {
  const url = new URL(params.baseUrl.split("?")[0]);
  const existing = new URL(params.baseUrl, "http://localhost");
  existing.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  appendParams(url, {
    SERVICE: "WMS",
    VERSION: params.version,
    REQUEST: "GetLegendGraphic",
    LAYER: params.layer,
    STYLE: params.style || "",
    FORMAT: params.format || "image/png",
    WIDTH: params.width,
    HEIGHT: params.height,
    ...(params.crs ? { [crsParamName(params.version)]: params.crs } : {}),
    ...(params.vendorParams || {}),
  });
  return url.toString();
}

export function normalizeWMSUrl(input: string): {
  baseUrl: string;
  getCapabilitiesUrl: string;
} {
  let trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  const url = new URL(trimmed);
  url.searchParams.delete("SERVICE");
  url.searchParams.delete("REQUEST");
  url.searchParams.delete("VERSION");
  url.searchParams.delete("LAYERS");
  url.searchParams.delete("STYLES");
  url.searchParams.delete("BBOX");
  url.searchParams.delete("WIDTH");
  url.searchParams.delete("HEIGHT");
  url.searchParams.delete("FORMAT");
  url.searchParams.delete("CRS");
  url.searchParams.delete("SRS");
  url.searchParams.delete("TRANSPARENT");

  const baseUrl = url.toString().replace(/\?$/, "");
  const cap = new URL(baseUrl);
  cap.searchParams.set("SERVICE", "WMS");
  cap.searchParams.set("REQUEST", "GetCapabilities");
  cap.searchParams.set("VERSION", "1.3.0");

  return {
    baseUrl,
    getCapabilitiesUrl: cap.toString(),
  };
}
