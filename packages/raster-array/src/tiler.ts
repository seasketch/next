import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from "fs";
import { join, parse as parsePath } from "path";
import { tmpdir } from "os";
import {
  gdalBuildVrt,
  gdalInfo,
  gdalTranslate,
  gdalWarp,
  GdalDatasetInfo,
  isNetCdf,
} from "./gdal";
import { readEnviBands, readEnviByteBands } from "./envi";
import { encodeMrtTile, encodeSample } from "./mrt/encode";
import { MRT_NODATA } from "./mrt/types";
import { buildTileJson, RasterArrayTileJson } from "./tilejson";
import {
  BBox,
  bboxLonLatToMercator,
  bufferedTileBounds3857,
  tilesForBbox,
  uniqueTilesForBboxes,
  zoomForResolution,
} from "./webmercator";

export type Resampling = "near" | "bilinear" | "cubic" | "mode";

export type EncodeTilesetOptions = {
  input: string;
  outputDir: string;
  layerName?: string;
  units?: string;
  tileSize?: number;
  buffer?: number;
  minzoom?: number;
  maxzoom?: number;
  /**
   * TileJSON minzoom. Defaults to the lowest zoom that actually wrote a tile.
   * Pass 0 when appending a higher zoom onto an existing tileset so z0–n stay advertised.
   */
  tilejsonMinzoom?: number;
  /** Name bands as startYear, startYear+1, ... (GMW 4.1 is 1985). */
  startYear?: number;
  bandIds?: string[];
  offset?: number;
  scale?: number;
  bandsPerBlock?: number | "all";
  resampling?: Resampling;
  nodata?: number;
  /** TileJSON `tiles` template. `{name}` is replaced with the layer folder. */
  tileUrl?: string;
  skipEmpty?: boolean;
  workingDirectory?: string;
  /** Subdataset name or 0-based index when the file is NetCDF. */
  subdataset?: string | number;
  keepWarped?: boolean;
  concurrency?: number;
  /**
   * If set, only cut XYZ tiles that intersect these mercator boxes (e.g. the
   * footprints of scenes in a mosaic). The envelope of a global mosaic is
   * mostly empty ocean; passing scene bounds avoids spawning GDAL for those.
   */
  coverageBboxes?: BBox[];
  onProgress?: (message: string) => void;
};

export type EncodeTilesetResult = {
  tilejson: RasterArrayTileJson;
  tileCount: number;
  skippedEmpty: number;
  warpedPath: string;
  bandIds: string[];
  offset: number;
  scale: number;
  range: [number, number];
  candidateTiles: number;
  bytesOut: number;
  elapsedMs: number;
};

export async function encodeTileset(
  options: EncodeTilesetOptions,
): Promise<EncodeTilesetResult> {
  const tileSize = options.tileSize ?? 256;
  const buffer = options.buffer ?? 1;
  const resampling = options.resampling ?? "near";
  const skipEmpty = options.skipEmpty ?? true;
  const concurrency = options.concurrency ?? 4;
  const log = options.onProgress ?? (() => undefined);
  const started = Date.now();

  mkdirSync(options.outputDir, { recursive: true });
  const work =
    options.workingDirectory ??
    mkdtempSync(join(tmpdir(), "raster-array-"));
  mkdirSync(work, { recursive: true });
  const cleanupWork = !options.workingDirectory && !options.keepWarped;

  try {
    const sourcePath = await resolveSource(options.input, work, options.subdataset, log);
    log(`Reading ${sourcePath}`);
    let info = await gdalInfo(sourcePath);
    if (info.bands.length === 0) {
      throw new Error(`No raster bands found in ${sourcePath}`);
    }

    const nodata = options.nodata ?? firstNodata(info);
    const bandIds = resolveBandIds(info, options);
    const { offset, scale } = chooseEncoding(info, options);
    log(
      `${info.bands.length} bands → ${bandIds[0]}…${bandIds[bandIds.length - 1]}  offset=${offset} scale=${scale} nodata=${nodata}`,
    );

    let warpedPath = sourcePath;
    if (isWebMercator(info.projection)) {
      log("Input is already EPSG:3857; skipping warp");
    } else {
      warpedPath = join(work, `${parsePath(sourcePath).name}.3857.tif`);
      log("Warping to EPSG:3857…");
      await gdalWarp(sourcePath, warpedPath, [
        "-overwrite",
        "-t_srs",
        "EPSG:3857",
        "-r",
        resampling,
        "-of",
        "GTiff",
        "-co",
        "TILED=YES",
        "-co",
        "COMPRESS=DEFLATE",
        "-co",
        "SPARSE_OK=YES",
        "-co",
        "BIGTIFF=IF_SAFER",
        "-co",
        "NUM_THREADS=ALL_CPUS",
        "-wo",
        "SKIP_NOSOURCE=YES",
        "-wo",
        "NUM_THREADS=ALL_CPUS",
        ...(nodata != null
          ? ["-srcnodata", String(nodata), "-dstnodata", String(nodata)]
          : []),
      ]);
    }

    info = await gdalInfo(warpedPath);
    if (!info.wgs84Extent || !info.geoTransform) {
      throw new Error("Warped raster is missing geotransform / WGS84 extent");
    }
    const bounds = info.wgs84Extent;
    const mercatorBbox = bboxLonLatToMercator(bounds[0], bounds[1], bounds[2], bounds[3]);
    const metersPerPixel = Math.abs(info.geoTransform[1]);
    const nativeZoom = zoomForResolution(metersPerPixel, tileSize);
    const minzoom = options.minzoom ?? 0;
    const maxzoom = options.maxzoom ?? Math.min(nativeZoom, 12);
    log(`Zoom ${minzoom}–${maxzoom} (native ~${nativeZoom}), bounds ${bounds.map((n) => n.toFixed(3)).join(", ")}`);

    const jobs: Array<{ z: number; x: number; y: number }> = [];
    for (let z = minzoom; z <= maxzoom; z++) {
      const tiles = options.coverageBboxes?.length
        ? uniqueTilesForBboxes(options.coverageBboxes, z)
        : tilesForBbox(mercatorBbox, z);
      jobs.push(...tiles);
    }
    log(
      `${jobs.length} candidate XYZ tiles` +
        (options.coverageBboxes?.length
          ? ` (coverage of ${options.coverageBboxes.length} footprints)`
          : ""),
    );

    const outDim = tileSize + 2 * buffer;
    let tileCount = 0;
    let skippedEmpty = 0;
    let bytesOut = 0;
    let rangeMin = Infinity;
    let rangeMax = -Infinity;
    let writtenMinZoom = Infinity;
    let done = 0;
    let lastLog = Date.now();
    const tick = () => {
      done++;
      const now = Date.now();
      if (now - lastLog > 4000 || done === jobs.length) {
        lastLog = now;
        const elapsed = (now - started) / 1000;
        const rate = done / Math.max(elapsed, 0.001);
        const remaining = (jobs.length - done) / Math.max(rate, 0.01);
        log(
          `  tiles ${done}/${jobs.length}  wrote ${tileCount}  skip ${skippedEmpty}  ${rate.toFixed(1)}/s  ETA ${fmtSec(remaining)}`,
        );
      }
    };

    await mapPool(jobs, concurrency, async (tile) => {
      const window = bufferedTileBounds3857(tile.z, tile.x, tile.y, tileSize, buffer);
      const enviPath = join(work, `t-${tile.z}-${tile.x}-${tile.y}`);
      try {
        await gdalTranslate(warpedPath, enviPath, [
          "-of",
          "ENVI",
          "-co",
          "INTERLEAVE=BSQ",
          "-projwin",
          String(window.minX),
          String(window.maxY),
          String(window.maxX),
          String(window.minY),
          "-outsize",
          String(outDim),
          String(outDim),
          "-r",
          resampling,
          ...(nodata != null ? ["-a_nodata", String(nodata)] : []),
          "-q",
        ]);
      } catch {
        skippedEmpty++;
        tick();
        return;
      }

      const bands = readTileBands(enviPath);
      rmEnvi(enviPath);
      if (bands.length !== bandIds.length) {
        throw new Error(
          `Expected ${bandIds.length} bands in tile ${tile.z}/${tile.x}/${tile.y}, got ${bands.length}`,
        );
      }

      const encodedBands = bands.map((physical, i) => {
        const values = new Uint32Array(physical.length);
        for (let p = 0; p < physical.length; p++) {
          const v = physical[p]!;
          if (nodata != null && v === nodata) {
            values[p] = MRT_NODATA;
          } else {
            if (v < rangeMin) rangeMin = v;
            if (v > rangeMax) rangeMax = v;
            values[p] = encodeSample(v, offset, scale, nodata);
          }
        }
        return { id: bandIds[i]!, values };
      });

      if (skipEmpty && encodedBands.every((b) => b.values.every((v) => v === MRT_NODATA))) {
        skippedEmpty++;
        tick();
        return;
      }

      const mrt = encodeMrtTile({
        z: tile.z,
        x: tile.x,
        y: tile.y,
        layers: [
          {
            name: options.layerName ?? "data",
            units: options.units,
            tileSize,
            buffer,
            offset,
            scale,
            bands: encodedBands,
            bandsPerBlock: options.bandsPerBlock ?? "all",
          },
        ],
      });
      const tileDir = join(options.outputDir, String(tile.z), String(tile.x));
      mkdirSync(tileDir, { recursive: true });
      writeFileSync(join(tileDir, `${tile.y}.mrt`), mrt);
      bytesOut += mrt.length;
      tileCount++;
      if (tile.z < writtenMinZoom) writtenMinZoom = tile.z;
      tick();
    });

    if (!Number.isFinite(rangeMin) || !Number.isFinite(rangeMax)) {
      rangeMin = 0;
      rangeMax = 1;
    }

    const layerName = options.layerName ?? "data";
    const tileUrl =
      options.tileUrl ??
      `{z}/{x}/{y}.mrt`;
    const jsonMinzoom =
      options.tilejsonMinzoom ??
      (Number.isFinite(writtenMinZoom) ? writtenMinZoom : minzoom);
    const tilejson = buildTileJson({
      name: layerName,
      tiles: [tileUrl],
      minzoom: jsonMinzoom,
      maxzoom,
      bounds,
      layers: [
        {
          id: layerName,
          bands: bandIds,
          tileSize,
          buffer,
          units: options.units,
          scale,
          offset,
          range: [rangeMin, rangeMax],
        },
      ],
    });
    writeFileSync(
      join(options.outputDir, "tilejson.json"),
      JSON.stringify(tilejson, null, 2),
    );
    const elapsedMs = Date.now() - started;
    log(
      `Wrote ${tileCount} tiles (${skippedEmpty} empty skipped, ${(bytesOut / 1e6).toFixed(1)} MB) in ${fmtSec(elapsedMs / 1000)} → ${options.outputDir}`,
    );

    return {
      tilejson,
      tileCount,
      skippedEmpty,
      warpedPath,
      bandIds,
      offset,
      scale,
      range: [rangeMin, rangeMax],
      candidateTiles: jobs.length,
      bytesOut,
      elapsedMs,
    };
  } finally {
    if (cleanupWork) {
      rmSync(work, { recursive: true, force: true });
    }
  }
}

async function resolveSource(
  input: string,
  work: string,
  subdataset: string | number | undefined,
  log: (m: string) => void,
): Promise<string> {
  const info = await gdalInfo(input);
  if (info.subdatasets.length > 0 || (isNetCdf(input) && info.bands.length === 0)) {
    const ids = info.subdatasets.length > 0 ? info.subdatasets : [];
    if (ids.length === 0) {
      throw new Error("NetCDF has no GDAL subdatasets and no bands");
    }
    if (typeof subdataset === "number") {
      const chosen = ids[subdataset];
      if (!chosen) throw new Error(`subdataset index ${subdataset} not found`);
      const tif = join(work, "source.tif");
      log(`Translating NetCDF subdataset to GeoTIFF:\n  ${chosen}`);
      await gdalTranslate(chosen, tif, ["-co", "COMPRESS=DEFLATE"]);
      return tif;
    }
    if (typeof subdataset === "string") {
      const chosen =
        ids.find((id) => id.includes(subdataset)) ??
        (subdataset.startsWith("NETCDF:") ? subdataset : undefined);
      if (!chosen) throw new Error(`subdataset "${subdataset}" not found`);
      const tif = join(work, "source.tif");
      log(`Translating NetCDF subdataset to GeoTIFF:\n  ${chosen}`);
      await gdalTranslate(chosen, tif, ["-co", "COMPRESS=DEFLATE"]);
      return tif;
    }
    // Default: stack Band1..BandN (how GDAL writes multi-band GeoTIFF → NetCDF).
    if (ids.length > 1) {
      const vrt = join(work, "stacked.vrt");
      log(`Stacking ${ids.length} NetCDF subdatasets into a multi-band VRT`);
      await gdalBuildVrt(vrt, ids, ["-separate"]);
      return vrt;
    }
    const tif = join(work, "source.tif");
    log(`Translating NetCDF subdataset to GeoTIFF:\n  ${ids[0]}`);
    await gdalTranslate(ids[0]!, tif, ["-co", "COMPRESS=DEFLATE"]);
    return tif;
  }
  return input;
}

function readTileBands(enviPath: string): ArrayLike<number>[] {
  try {
    return readEnviByteBands(enviPath).bands;
  } catch {
    return readEnviBands(enviPath).bands;
  }
}

function isWebMercator(wkt: string | null): boolean {
  if (!wkt) return false;
  return /3857|Pseudo-Mercator|Popular Visualisation Pseudo/i.test(wkt);
}

function fmtSec(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "?";
  const m = Math.floor(s / 60);
  const sec = Math.round(s - m * 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function firstNodata(info: GdalDatasetInfo): number | null {
  for (const b of info.bands) {
    if (b.noDataValue != null) return b.noDataValue;
  }
  return null;
}

function resolveBandIds(info: GdalDatasetInfo, options: EncodeTilesetOptions): string[] {
  if (options.bandIds && options.bandIds.length === info.bands.length) {
    return options.bandIds;
  }
  if (options.startYear != null) {
    return info.bands.map((_, i) => String(options.startYear! + i));
  }
  return info.bands.map((b, i) => {
    const meta = b.metadata;
    const fromMeta =
      meta["NETCDF_DIM_time"] ||
      meta["GRIB_VALID_TIME"] ||
      meta["TIME"] ||
      b.description;
    if (fromMeta && fromMeta.trim()) return fromMeta.trim();
    return String(i + 1);
  });
}

function chooseEncoding(
  info: GdalDatasetInfo,
  options: EncodeTilesetOptions,
): { offset: number; scale: number } {
  if (options.offset != null && options.scale != null) {
    return { offset: options.offset, scale: options.scale };
  }
  const mins = info.bands.map((b) => b.minimum).filter((n): n is number => n != null);
  const maxs = info.bands.map((b) => b.maximum).filter((n): n is number => n != null);
  const min = mins.length ? Math.min(...mins) : 0;
  const max = maxs.length ? Math.max(...maxs) : 1;
  const isFloat = info.bands.some((b) => /float/i.test(b.type));
  if (options.offset != null) {
    return { offset: options.offset, scale: options.scale ?? (isFloat ? 0.1 : 1) };
  }
  if (options.scale != null) {
    return { offset: min < 0 ? min : 0, scale: options.scale };
  }
  if (!isFloat) {
    return { offset: min < 0 ? min : 0, scale: 1 };
  }
  return { offset: min, scale: niceScale(max - min) };
}

function niceScale(range: number): number {
  if (range <= 0) return 0.1;
  const mag = Math.pow(10, Math.floor(Math.log10(range)) - 3);
  return Math.max(mag, 0.01);
}

function rmEnvi(path: string): void {
  for (const p of [path, path + ".hdr", path + ".aux.xml"]) {
    try {
      rmSync(p, { force: true });
    } catch {
      /* ignore */
    }
  }
}

async function mapPool<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      await fn(items[i]!);
    }
  }
  const n = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: n }, worker));
}

export function mercatorBBoxFromWgs84(bounds: [number, number, number, number]): BBox {
  return bboxLonLatToMercator(bounds[0], bounds[1], bounds[2], bounds[3]);
}