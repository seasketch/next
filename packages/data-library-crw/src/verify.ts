import { existsSync } from "fs";
import { openPmtiles } from "../../raster-array/src/pmtiles/read";
import { decodeMrtTile } from "../../raster-array/src/mrt/decode";
import { decodeSample } from "../../raster-array/src/mrt/encode";
import { runGdal } from "../../raster-array/src/gdal";
import {
  lonLatToMercator,
  tileBounds3857,
} from "../../raster-array/src/webmercator";
import { CrwProduct, NATIVE_MAXZOOM, TILE_SIZE } from "./products";

/** Great Barrier Reef — reliably ocean with CRW coverage. */
const SAMPLE = { lon: 146.5, lat: -18.2 };

export type VerifyResult = {
  lon: number;
  lat: number;
  z: number;
  x: number;
  y: number;
  band: string;
  tileValue: number | null;
  gdalValue: number | null;
  delta: number | null;
  ok: boolean;
};

function tileForLonLat(lon: number, lat: number, z: number) {
  const { x: mx, y: my } = lonLatToMercator(lon, lat);
  const n = 2 ** z;
  const world = 20037508.342789244 * 2;
  const origin = -20037508.342789244;
  const x = Math.floor(((mx - origin) / world) * n);
  const y = Math.floor(((origin + world - my) / world) * n);
  return { z, x, y };
}

async function gdalValueAt(
  raster: string,
  lon: number,
  lat: number,
  bandIndex: number,
): Promise<number | null> {
  const stdout = await runGdal(
    "gdallocationinfo",
    [
      "-wgs84",
      "-valonly",
      "-b",
      String(bandIndex),
      raster,
      String(lon),
      String(lat),
    ],
    `gdallocationinfo failed for ${raster}`,
  );
  const text = stdout.trim();
  if (!text || /nan/i.test(text)) return null;
  const n = Number(text.split("\n").pop());
  return Number.isFinite(n) ? n : null;
}

export async function verifyProduct(options: {
  product: CrwProduct;
  bands: string[];
  archive: string;
  warped: string;
  lon?: number;
  lat?: number;
}): Promise<VerifyResult> {
  const lon = options.lon ?? SAMPLE.lon;
  const lat = options.lat ?? SAMPLE.lat;
  if (!existsSync(options.archive)) {
    throw new Error(`Archive not found: ${options.archive}`);
  }
  if (!existsSync(options.warped)) {
    throw new Error(`Warped raster not found: ${options.warped}`);
  }

  const z = NATIVE_MAXZOOM;
  const { x, y } = tileForLonLat(lon, lat, z);
  const archive = openPmtiles(options.archive);
  const tile = archive.getTile(z, x, y);
  if (!tile) {
    throw new Error(`No MRT tile at ${z}/${x}/${y}`);
  }
  const decoded = decodeMrtTile(tile);
  const layer = decoded.layers[options.product.layerName];
  if (!layer) {
    throw new Error(
      `Layer "${options.product.layerName}" missing. Have: ${Object.keys(decoded.layers).join(", ")}`,
    );
  }
  const band = options.bands[options.bands.length - 1]!;
  const bandIndex = options.bands.length;
  const values = layer.bandData[band];
  if (!values) {
    throw new Error(`Band ${band} missing from tile`);
  }

  const bounds = tileBounds3857(z, x, y, TILE_SIZE);
  const merc = lonLatToMercator(lon, lat);
  const px = Math.round(
    ((merc.x - bounds.minX) / (bounds.maxX - bounds.minX)) * (TILE_SIZE - 1),
  );
  const py = Math.round(
    ((bounds.maxY - merc.y) / (bounds.maxY - bounds.minY)) * (TILE_SIZE - 1),
  );
  const dim = layer.tileSize + 2 * layer.buffer;
  const col = Math.min(TILE_SIZE - 1, Math.max(0, px)) + layer.buffer;
  const row = Math.min(TILE_SIZE - 1, Math.max(0, py)) + layer.buffer;
  const idx = row * dim + col;
  const code = values[idx];
  const tileValue =
    code == null
      ? null
      : decodeSample(code, options.product.offset, options.product.scale);

  const sourceValue = await gdalValueAt(options.warped, lon, lat, bandIndex);
  const gdalValue =
    sourceValue != null && sourceValue === options.product.nodata
      ? null
      : sourceValue;
  const delta =
    tileValue != null && gdalValue != null ? Math.abs(tileValue - gdalValue) : null;
  const tolerance = Math.max(options.product.scale * 8, 0.1);
  const ok =
    (tileValue == null && gdalValue == null) ||
    (delta != null && delta <= tolerance);

  return {
    lon,
    lat,
    z,
    x,
    y,
    band,
    tileValue,
    gdalValue,
    delta,
    ok,
  };
}
