/** Web Mercator (EPSG:3857) XYZ helpers. Mapbox uses y=0 at the north pole. */

export const EARTH_RADIUS = 6378137;
export const MAX_MERCATOR_EXTENT = Math.PI * EARTH_RADIUS;

export type BBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export function tileSize3857(z: number): number {
  return (2 * MAX_MERCATOR_EXTENT) / 2 ** z;
}

export function tileBounds3857(z: number, x: number, y: number): BBox {
  const size = tileSize3857(z);
  const minX = -MAX_MERCATOR_EXTENT + x * size;
  const maxX = minX + size;
  const maxY = MAX_MERCATOR_EXTENT - y * size;
  const minY = maxY - size;
  return { minX, minY, maxX, maxY };
}

/** Expand a tile bbox by `buffer` pixels on each side. */
export function bufferedTileBounds3857(
  z: number,
  x: number,
  y: number,
  tileSize: number,
  buffer: number,
): BBox {
  const b = tileBounds3857(z, x, y);
  if (buffer === 0) return b;
  const pad = (buffer / tileSize) * tileSize3857(z);
  return {
    minX: b.minX - pad,
    minY: b.minY - pad,
    maxX: b.maxX + pad,
    maxY: b.maxY + pad,
  };
}

export function lonLatToMercator(lon: number, lat: number): { x: number; y: number } {
  const x = (lon * Math.PI * EARTH_RADIUS) / 180;
  const latRad = (lat * Math.PI) / 180;
  const y = Math.log(Math.tan(Math.PI / 4 + latRad / 2)) * EARTH_RADIUS;
  return { x, y };
}

export function mercatorToLonLat(x: number, y: number): { lon: number; lat: number } {
  const lon = (x * 180) / (Math.PI * EARTH_RADIUS);
  const lat =
    (2 * Math.atan(Math.exp(y / EARTH_RADIUS)) - Math.PI / 2) * (180 / Math.PI);
  return { lon, lat };
}

export function bboxLonLatToMercator(west: number, south: number, east: number, north: number): BBox {
  const sw = lonLatToMercator(west, south);
  const ne = lonLatToMercator(east, north);
  return { minX: sw.x, minY: sw.y, maxX: ne.x, maxY: ne.y };
}

export function bboxesIntersect(a: BBox, b: BBox): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

export function uniqueTilesForBboxes(
  bboxes: BBox[],
  z: number,
): Array<{ z: number; x: number; y: number }> {
  const seen = new Set<string>();
  const tiles: Array<{ z: number; x: number; y: number }> = [];
  for (const bbox of bboxes) {
    for (const tile of tilesForBbox(bbox, z)) {
      const key = `${tile.x}/${tile.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      tiles.push(tile);
    }
  }
  return tiles;
}

/** Snap a mercator bbox outward onto a pixel grid originating at -MAX_MERCATOR_EXTENT. */
export function snapBboxToResolution(bbox: BBox, resolution: number): BBox {
  const origin = -MAX_MERCATOR_EXTENT;
  const down = (v: number) => origin + Math.floor((v - origin) / resolution) * resolution;
  const up = (v: number) => origin + Math.ceil((v - origin) / resolution) * resolution;
  return {
    minX: down(bbox.minX),
    minY: down(bbox.minY),
    maxX: up(bbox.maxX),
    maxY: up(bbox.maxY),
  };
}

export function tilesForBbox(
  bbox: BBox,
  z: number,
): Array<{ z: number; x: number; y: number }> {
  const n = 2 ** z;
  const size = tileSize3857(z);
  const minX = Math.max(0, Math.floor((bbox.minX + MAX_MERCATOR_EXTENT) / size));
  const maxX = Math.min(n - 1, Math.floor((bbox.maxX - 1e-9 + MAX_MERCATOR_EXTENT) / size));
  const minY = Math.max(0, Math.floor((MAX_MERCATOR_EXTENT - bbox.maxY) / size));
  const maxY = Math.min(n - 1, Math.floor((MAX_MERCATOR_EXTENT - bbox.minY - 1e-9) / size));
  const tiles: Array<{ z: number; x: number; y: number }> = [];
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      tiles.push({ z, x, y });
    }
  }
  return tiles;
}

/**
 * Native XYZ zoom where a 256px tile is about as detailed as `metersPerPixel`.
 */
export function zoomForResolution(metersPerPixel: number, tileSize = 256): number {
  const z = Math.log2((2 * MAX_MERCATOR_EXTENT) / (tileSize * metersPerPixel));
  return Math.max(0, Math.round(z));
}
