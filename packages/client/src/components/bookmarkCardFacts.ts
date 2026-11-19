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
