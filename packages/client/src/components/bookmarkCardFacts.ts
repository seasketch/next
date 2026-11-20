export function bookmarkCamera(
  value: unknown
): { zoom: number; center: [number, number] } | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  if (!("zoom" in value) || !("center" in value)) {
    return null;
  }
  const zoom = value.zoom;
  const center = value.center;
  if (typeof zoom !== "number" || !Number.isFinite(zoom)) {
    return null;
  }
  if (
    !Array.isArray(center) ||
    center.length < 2 ||
    typeof center[0] !== "number" ||
    typeof center[1] !== "number" ||
    !Number.isFinite(center[0]) ||
    !Number.isFinite(center[1])
  ) {
    return null;
  }
  return { zoom, center: [center[0], center[1]] };
}

export function bookmarkName(record: unknown, key: string): string | null {
  if (typeof record !== "object" || record === null || Array.isArray(record)) {
    return null;
  }
  if (!(key in record)) {
    return null;
  }
  const value = (record as { [key: string]: unknown })[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function firstText(
  values: Array<string | null | undefined>,
  fallback: unknown
): string {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return typeof fallback === "string" && fallback.length > 0 ? fallback : "";
}

export function fitImageSize(
  natural: { width: number; height: number },
  bounds: { width: number; height: number }
): { width: number; height: number } | null {
  if (
    !Number.isFinite(natural.width) ||
    !Number.isFinite(natural.height) ||
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.height) ||
    natural.width <= 0 ||
    natural.height <= 0 ||
    bounds.width <= 0 ||
    bounds.height <= 0
  ) {
    return null;
  }
  const scale = Math.min(
    bounds.width / natural.width,
    bounds.height / natural.height,
    1
  );
  return {
    width: Math.round(natural.width * scale),
    height: Math.round(natural.height * scale),
  };
}

export function bookmarkView(
  value: unknown
): {
  zoom: number;
  center: [number, number];
  bearing: number;
  pitch: number;
} | null {
  const camera = bookmarkCamera(value);
  if (!camera) {
    return null;
  }
  const record = value as { bearing?: unknown; pitch?: unknown };
  const bearing = typeof record.bearing === "number" && Number.isFinite(record.bearing)
    ? record.bearing
    : 0;
  const pitch = typeof record.pitch === "number" && Number.isFinite(record.pitch)
    ? record.pitch
    : 0;
  return { ...camera, bearing, pitch };
}

/**
 * Geographic bounds of the saved viewport. Mapbox world coordinates use a
 * 512px tile, so the span follows the saved width, height, and zoom.
 */
export function bookmarkExtent(
  camera: { zoom: number; center: [number, number] },
  dimensions: [number, number]
): { west: number; south: number; east: number; north: number } | null {
  const { zoom, center } = camera;
  const [width, height] = dimensions;
  if (
    !Number.isFinite(zoom) ||
    zoom < 0 ||
    zoom > 24 ||
    !Number.isFinite(center[0]) ||
    !Number.isFinite(center[1]) ||
    Math.abs(center[1]) > 85 ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }
  const scale = 512 * Math.pow(2, zoom);
  const [x, y] = lngLatToWorld(center[0], center[1]);
  const halfW = width / 2 / scale;
  const halfH = height / 2 / scale;
  const [west, north] = worldToLngLat(x - halfW, y - halfH);
  const [east, south] = worldToLngLat(x + halfW, y + halfH);
  if (![west, south, east, north].every((coord) => Number.isFinite(coord))) {
    return null;
  }
  return { west, south, east, north };
}

export function formatExtent(extent: {
  west: number;
  south: number;
  east: number;
  north: number;
}): string {
  return [
    `${formatAxis(extent.west, "E", "W")}–${formatAxis(extent.east, "E", "W")}`,
    `${formatAxis(extent.south, "N", "S")}–${formatAxis(extent.north, "N", "S")}`,
  ].join(", ");
}

function formatAxis(value: number, positive: string, negative: string) {
  const hemisphere = value < 0 ? negative : positive;
  // eslint-disable-next-line i18next/no-literal-string
  return `${Math.abs(value).toFixed(2)}°${hemisphere}`;
}

function lngLatToWorld(lng: number, lat: number): [number, number] {
  const x = (lng + 180) / 360;
  const sin = Math.sin((lat * Math.PI) / 180);
  const y = 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
  return [x, y];
}

function worldToLngLat(x: number, y: number): [number, number] {
  const lng = x * 360 - 180;
  const n = Math.PI - 2 * Math.PI * y;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return [lng, lat];
}

export function bookmarkDimensions(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) {
    return null;
  }
  const width = value[0];
  const height = value[1];
  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }
  return [width, height];
}
