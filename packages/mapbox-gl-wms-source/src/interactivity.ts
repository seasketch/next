import { getNamedLayers } from "./capabilities";
import { WMSFeatureInfoFeature, WMSFeatureInfoResult, WMSServiceMetadata } from "./types";
import { defaultFetch, FetchFn } from "./util";
import { buildGetFeatureInfoUrl } from "./urls";

export { buildGetFeatureInfoUrl as getFeatureInfoUrl } from "./urls";

export function parseFeatureInfo(
  body: string,
  infoFormat: string
): WMSFeatureInfoResult {
  const format = infoFormat.toLowerCase();
  if (format.includes("json")) {
    try {
      const parsed = JSON.parse(body);
      const features = normalizeJsonFeatures(parsed);
      return { format: infoFormat, features, raw: body };
    } catch {
      return { format: infoFormat, features: [], raw: body };
    }
  }
  if (format.includes("html")) {
    return {
      format: infoFormat,
      features: [],
      html: body,
      raw: body,
    };
  }
  if (format.includes("gml") || format.includes("xml")) {
    const features = parseGmlProperties(body);
    return { format: infoFormat, features, raw: body };
  }
  return { format: infoFormat, features: [], raw: body };
}

function normalizeJsonFeatures(parsed: unknown): WMSFeatureInfoFeature[] {
  if (!parsed || typeof parsed !== "object") {
    return [];
  }
  const obj = parsed as Record<string, unknown>;
  if (Array.isArray(obj.features)) {
    return obj.features.map((f: Record<string, unknown>) => ({
      layer: String(f.id || f.layer || ""),
      properties: (f.properties as Record<string, string | number | boolean | null>) || {},
    }));
  }
  // GeoServer sometimes returns flat object
  const props: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value !== "object") {
      props[key] = value as string | number | boolean | null;
    }
  }
  if (Object.keys(props).length) {
    return [{ properties: props }];
  }
  return [];
}

function parseGmlProperties(body: string): WMSFeatureInfoFeature[] {
  const features: WMSFeatureInfoFeature[] = [];
  const memberRegex = /<(?:[\w]+:)?member[^>]*>([\s\S]*?)<\/(?:[\w]+:)?member>/gi;
  let match;
  while ((match = memberRegex.exec(body)) !== null) {
    const chunk = match[1];
    const properties: Record<string, string> = {};
    const propRegex = /<(?:[\w]+:)?(\w+)[^>]*>([\s\S]*?)<\/(?:[\w]+:)?\1>/g;
    let propMatch;
    while ((propMatch = propRegex.exec(chunk)) !== null) {
      properties[propMatch[1]] = propMatch[2].trim();
    }
    if (Object.keys(properties).length) {
      features.push({ properties });
    }
  }
  if (!features.length) {
    const simpleRegex = /<(?:[\w]+:)?(\w+)[^>]*>([^<]+)<\/(?:[\w]+:)?\1>/g;
    const properties: Record<string, string> = {};
    let propMatch;
    while ((propMatch = simpleRegex.exec(body)) !== null) {
      properties[propMatch[1]] = propMatch[2].trim();
    }
    if (Object.keys(properties).length) {
      features.push({ properties });
    }
  }
  return features;
}

export interface IdentifyOptions {
  fetch?: FetchFn;
  infoFormat?: string;
  layers?: string[];
  queryLayers?: string[];
  crs?: string;
  width?: number;
  height?: number;
  vendorParams?: Record<string, string | number | boolean>;
}

export async function identify(
  metadata: WMSServiceMetadata,
  lngLat: [number, number],
  viewport: {
    bbox: [number, number, number, number];
    width: number;
    height: number;
    x: number;
    y: number;
  },
  options: IdentifyOptions = {}
): Promise<WMSFeatureInfoResult> {
  const fetchFn = options.fetch || defaultFetch;
  const queryLayers =
    options.queryLayers ||
    options.layers ||
    getNamedLayers(metadata.layers)
      .filter((l) => l.queryable)
      .map((l) => l.name!)
      .slice(0, 5);
  if (!queryLayers.length) {
    return { format: "", features: [] };
  }
  const layers = options.layers || queryLayers;
  const infoFormat =
    options.infoFormat ||
    metadata.getFeatureInfo?.formats.find((f) => /json/i.test(f)) ||
    metadata.getFeatureInfo?.formats[0] ||
    "application/json";
  const baseUrl = metadata.getFeatureInfo?.url || metadata.getMap.url;
  const crs = options.crs || "EPSG:3857";
  const url = buildGetFeatureInfoUrl({
    baseUrl,
    version: metadata.version,
    layers,
    queryLayers,
    crs,
    bbox: viewport.bbox,
    width: viewport.width,
    height: viewport.height,
    x: viewport.x,
    y: viewport.y,
    infoFormat,
    vendorParams: options.vendorParams,
  });
  const response = await fetchFn(url, {
    headers: { Accept: infoFormat },
  });
  if (!response.ok) {
    throw new Error(`GetFeatureInfo failed (${response.status})`);
  }
  const body = await response.text();
  return parseFeatureInfo(body, infoFormat);
}
