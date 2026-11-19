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
