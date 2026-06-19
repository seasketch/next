export const blankDataUri =
  "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

export function lon2meters(lon: number): number {
  return (lon * 20037508.34) / 180;
}

export function lat2meters(lat: number): number {
  const y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
  return (y * 20037508.34) / 180;
}

export function metersToDegrees(x: number, y: number): [number, number] {
  const lon = (x * 180) / 20037508.34;
  const lat =
    (Math.atan(Math.exp((y * Math.PI) / 20037508.34)) * 360) / Math.PI - 90;
  return [lon, lat];
}

export function getGroundResolution(zoom: number): number {
  const initialResolution = (2 * Math.PI * 6378137) / 256;
  return initialResolution / Math.pow(2, zoom);
}

export function clampLat(lat: number): number {
  return Math.max(-85.05112878, Math.min(85.05112878, lat));
}

export function clampLng(lng: number): number {
  if (lng > 180) return 180;
  if (lng < -180) return -180;
  return lng;
}

export function normalizeCrs(crs: string): string {
  const upper = crs.toUpperCase().trim();
  if (upper === "EPSG:900913" || upper === "EPSG:3857") {
    return "EPSG:3857";
  }
  if (upper === "CRS:84") {
    return "EPSG:4326";
  }
  return upper;
}

export function isWebMercatorCrs(crs: string): boolean {
  const n = normalizeCrs(crs);
  return n === "EPSG:3857" || n === "EPSG:900913";
}

export function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export function textContent(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (typeof value === "object" && value !== null && "#text" in value) {
    return String((value as { "#text": unknown })["#text"]);
  }
  return undefined;
}

export function parseBoolean(value: unknown, defaultValue = false): boolean {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value === "boolean") {
    return value;
  }
  const s = String(value).toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

export function parseNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function enforceBoundsMinMax(
  bounds: [number, number, number, number]
): [number, number, number, number] {
  return [
    Math.max(-180, bounds[0]),
    Math.max(-90, bounds[1]),
    Math.min(180, bounds[2]),
    Math.min(90, bounds[3]),
  ];
}

export function mergeBounds(
  a?: [number, number, number, number],
  b?: [number, number, number, number]
): [number, number, number, number] | undefined {
  if (!a) return b;
  if (!b) return a;
  return [
    Math.min(a[0], b[0]),
    Math.min(a[1], b[1]),
    Math.max(a[2], b[2]),
    Math.max(a[3], b[3]),
  ];
}

export function getMapViewportCoordinates(map: {
  getBounds(): {
    getNorthWest(): { lng: number; lat: number };
    getNorthEast(): { lng: number; lat: number };
    getSouthEast(): { lng: number; lat: number };
    getSouthWest(): { lng: number; lat: number };
  } | null;
}): [[number, number], [number, number], [number, number], [number, number]] {
  const bounds = map.getBounds();
  if (!bounds) {
    return [
      [-180, 85],
      [180, 85],
      [180, -85],
      [-180, -85],
    ];
  }
  const nw = bounds.getNorthWest();
  const ne = bounds.getNorthEast();
  const se = bounds.getSouthEast();
  const sw = bounds.getSouthWest();
  return [
    [clampLng(nw.lng), clampLat(nw.lat)],
    [clampLng(ne.lng), clampLat(ne.lat)],
    [clampLng(se.lng), clampLat(se.lat)],
    [clampLng(sw.lng), clampLat(sw.lat)],
  ];
}

export function getWebMercatorBboxFromMap(map: {
  getBounds(): {
    getNorthWest(): { lng: number; lat: number };
    getNorthEast(): { lng: number; lat: number };
    getSouthEast(): { lng: number; lat: number };
    getSouthWest(): { lng: number; lat: number };
  } | null;
}): [number, number, number, number] {
  const bounds = map.getBounds();
  if (!bounds) {
    return [-20037508.34, -20037508.34, 20037508.34, 20037508.34];
  }
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return [
    lon2meters(clampLng(sw.lng)),
    lat2meters(clampLat(sw.lat)),
    lon2meters(clampLng(ne.lng)),
    lat2meters(clampLat(ne.lat)),
  ];
}

export type FetchFn = typeof fetch;

export const defaultFetch: FetchFn = (...args) => fetch(...args);
