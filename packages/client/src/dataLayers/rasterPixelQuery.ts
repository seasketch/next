/* eslint-disable i18next/no-literal-string */
import tilebelt from "@mapbox/tilebelt";
import {
  applyRasterScaleOffset,
  decodeRgbEncodedRasterValue,
  RasterValueEncodingParams,
} from "./rasterValueEncoding";

export type RasterPixelQuerySource = {
  /** Stable id for cache keys (e.g. data source id). */
  sourceId: string;
  /** Hosted source URL without .json suffix (or with — both accepted). */
  url: string;
  tileSize?: number | null;
  minzoom?: number | null;
  maxzoom?: number | null;
  rasterScale?: number | null;
  rasterOffset?: number | null;
  respectScaleAndOffset?: boolean;
  encoding: RasterValueEncodingParams;
};

export type RasterPixelHit = {
  /** Display value (after optional GDAL scale/offset). */
  value: number;
  /** Decoded DN before scale/offset — legend labels key off this. */
  encodedValue: number;
  r: number;
  g: number;
  b: number;
  a: number;
  z: number;
  x: number;
  y: number;
  px: number;
  py: number;
};

type TileBuffer = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

type TileJson = {
  tiles?: string[];
  minzoom?: number;
  maxzoom?: number;
  tileSize?: number;
};

const DEFAULT_TILE_SIZE = 512;
/** Decoded RGBA buffers across all raster sources (not per-layer). */
const MAX_CACHED_TILES = 6;

/** In-memory decoded RGBA buffers — for rapid same-tile pixel brushes, not network. */
const tileBufferCache = new Map<string, Promise<TileBuffer | null>>();
const tileBufferOrder: string[] = [];
const tileJsonCache = new Map<string, Promise<TileJson | null>>();

export type AuthorizeUrlFn = (url: string) => string;

let authorizeUrl: AuthorizeUrlFn = (url) => url;

/** Wire hosted auth (access_token / ns) the same way MapContextManager does. */
export function setRasterPixelQueryAuthorizeUrl(fn: AuthorizeUrlFn) {
  authorizeUrl = fn;
}

export function clearRasterPixelQueryCaches() {
  tileBufferCache.clear();
  tileBufferOrder.length = 0;
  tileJsonCache.clear();
}

function touchCacheKey(key: string) {
  const idx = tileBufferOrder.indexOf(key);
  if (idx >= 0) {
    tileBufferOrder.splice(idx, 1);
  }
  tileBufferOrder.push(key);
  while (tileBufferOrder.length > MAX_CACHED_TILES) {
    const evict = tileBufferOrder.shift();
    if (evict) {
      tileBufferCache.delete(evict);
    }
  }
}

function sourceBaseUrl(url: string): string {
  return url.replace(/\.json$/i, "");
}

function tileJsonUrl(url: string): string {
  const base = sourceBaseUrl(url);
  return /\.json$/i.test(url) ? url : `${base}.json`;
}

async function loadTileJson(sourceUrl: string): Promise<TileJson | null> {
  const key = sourceBaseUrl(sourceUrl);
  let pending = tileJsonCache.get(key);
  if (!pending) {
    pending = (async () => {
      try {
        const res = await fetch(authorizeUrl(tileJsonUrl(sourceUrl)));
        if (!res.ok) return null;
        return (await res.json()) as TileJson;
      } catch {
        return null;
      }
    })();
    tileJsonCache.set(key, pending);
    // Don't stick a failed/null result (e.g. token race → 401); allow retry.
    pending
      .then((tj) => {
        if (!tj) {
          tileJsonCache.delete(key);
        }
      })
      .catch(() => {
        tileJsonCache.delete(key);
      });
  }
  return pending;
}

/**
 * Expand a TileJSON tile URL template.
 * `{y}` is XYZ (Mapbox / SeaSketch); `{-y}` is TMS-flipped (`2^z - 1 - y`).
 */
export function buildTileUrl(
  template: string,
  z: number,
  x: number,
  y: number
): string {
  const tmsY = 2 ** z - 1 - y;
  return template
    .replace(/\{z\}/g, String(z))
    .replace(/\{x\}/g, String(x))
    .replace(/\{y\}/g, String(y))
    .replace(/\{-y\}/g, String(tmsY));
}

async function resolveTileUrl(
  source: RasterPixelQuerySource,
  z: number,
  x: number,
  y: number
): Promise<string | null> {
  const tj = await loadTileJson(source.url);
  if (tj?.tiles?.length) {
    return buildTileUrl(tj.tiles[0], z, x, y);
  }
  // Fallback matching pmtiles-server ZXY layout
  const base = sourceBaseUrl(source.url);
  return `${base}/${z}/${x}/${y}.png`;
}

function decodeImageToBuffer(blob: Blob): Promise<TileBuffer | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        resolve({
          width: imageData.width,
          height: imageData.height,
          data: imageData.data,
        });
      } catch {
        resolve(null);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.crossOrigin = "anonymous";
    img.src = url;
  });
}

async function loadTileBuffer(
  source: RasterPixelQuerySource,
  z: number,
  x: number,
  y: number
): Promise<TileBuffer | null> {
  const cacheKey = `${source.sourceId}:${z}:${x}:${y}`;
  let pending = tileBufferCache.get(cacheKey);
  if (!pending) {
    pending = (async () => {
      try {
        const tileUrl = await resolveTileUrl(source, z, x, y);
        if (!tileUrl) return null;
        const res = await fetch(authorizeUrl(tileUrl));
        if (!res.ok) return null;
        const blob = await res.blob();
        return decodeImageToBuffer(blob);
      } catch {
        return null;
      }
    })();
    tileBufferCache.set(cacheKey, pending);
    // Track pending entries in LRU so concurrent loads can't overgrow the map.
    touchCacheKey(cacheKey);
    pending
      .then((buf) => {
        if (!buf) {
          tileBufferCache.delete(cacheKey);
          const idx = tileBufferOrder.indexOf(cacheKey);
          if (idx >= 0) tileBufferOrder.splice(idx, 1);
        } else {
          touchCacheKey(cacheKey);
        }
      })
      .catch(() => {
        tileBufferCache.delete(cacheKey);
        const idx = tileBufferOrder.indexOf(cacheKey);
        if (idx >= 0) tileBufferOrder.splice(idx, 1);
      });
  } else {
    touchCacheKey(cacheKey);
  }
  return pending;
}

export function lngLatToTilePixel(
  lng: number,
  lat: number,
  zoom: number,
  tileSize: number
): { z: number; x: number; y: number; px: number; py: number } {
  const z = Math.floor(zoom);
  const frac = tilebelt.pointToTileFraction(lng, lat, z) as [
    number,
    number,
    number
  ];
  const x = Math.floor(frac[0]);
  const y = Math.floor(frac[1]);
  const px = Math.min(
    tileSize - 1,
    Math.max(0, Math.floor((frac[0] - x) * tileSize))
  );
  const py = Math.min(
    tileSize - 1,
    Math.max(0, Math.floor((frac[1] - y) * tileSize))
  );
  return { z, x, y, px, py };
}

/**
 * Sample a scalar data value under lng/lat for an RGB-encoded SeaSketch raster.
 * Returns null for nodata / transparent / out-of-range / fetch failures.
 */
export async function queryRasterPixelValue(
  source: RasterPixelQuerySource,
  lng: number,
  lat: number,
  mapZoom: number
): Promise<RasterPixelHit | null> {
  const tj = await loadTileJson(source.url);
  const tileSize = source.tileSize || tj?.tileSize || DEFAULT_TILE_SIZE;
  let z = Math.floor(mapZoom);
  const minz = source.minzoom ?? tj?.minzoom;
  const maxz = source.maxzoom ?? tj?.maxzoom;
  if (typeof minz === "number") z = Math.max(z, minz);
  if (typeof maxz === "number") z = Math.min(z, maxz);

  const { x, y, px, py } = lngLatToTilePixel(lng, lat, z, tileSize);
  const buffer = await loadTileBuffer(source, z, x, y);
  if (!buffer) {
    return null;
  }
  if (px < 0 || py < 0 || px >= buffer.width || py >= buffer.height) {
    return null;
  }
  const i = (py * buffer.width + px) * 4;
  const r = buffer.data[i];
  const g = buffer.data[i + 1];
  const b = buffer.data[i + 2];
  const a = buffer.data[i + 3];
  const encodedValue = decodeRgbEncodedRasterValue(
    r,
    g,
    b,
    a,
    source.encoding
  );
  if (encodedValue === null) {
    return null;
  }
  const value = source.respectScaleAndOffset
    ? applyRasterScaleOffset(
        encodedValue,
        source.rasterScale,
        source.rasterOffset
      )
    : encodedValue;
  return { value, encodedValue, r, g, b, a, z, x, y, px, py };
}

/** Index into a known RGBA buffer (for unit tests / fixtures). */
export function sampleRgbaBuffer(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  px: number,
  py: number,
  encoding: RasterValueEncodingParams
): number | null {
  const i = (py * width + px) * 4;
  return decodeRgbEncodedRasterValue(
    data[i],
    data[i + 1],
    data[i + 2],
    data[i + 3],
    encoding
  );
}
