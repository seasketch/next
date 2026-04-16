import { BBox, Feature, MultiPolygon, Polygon } from "geojson";
import distance from "@turf/distance";
import { point } from "@turf/helpers";
// @ts-ignore
import proj4 from "proj4";
import { RasterBandStats } from "./metrics/metrics";
import calcBBox from "@turf/bbox";

export type HistogramEntry = [number, number];

/**
 * Verbose `console.log` for raster stats / VRM (set `RASTER_STATS_VERBOSE=0` to disable).
 */
const RASTER_STATS_VERBOSE = false;

function logRasterStatsVerbose(
  message: string,
  data?: Record<string, unknown>,
) {
  if (!RASTER_STATS_VERBOSE) return;
  if (data !== undefined) {
    console.log(`[rasterStats] ${message}`, data);
  } else {
    console.log(`[rasterStats] ${message}`);
  }
}

/**
 * Per-axis cap for VRM to prevent geoblaze from allocating pathologically
 * large arrays (new Array(height * yVrm)).
 */
const MAX_VRM_PER_AXIS = 100;

interface GeorasterLike {
  pixelWidth: number;
  pixelHeight: number;
  projection?: number;
}

/**
 * Geodesic length in meters of one raster pixel in X and Y at `centerLonLat`, using
 * COG/georaster metadata (pixelWidth/Height in CRS units + EPSG from GeoKeys).
 */
export function groundPixelDimensionsMeters(
  raster: GeorasterLike,
  centerLonLat: [number, number],
): { mX: number; mY: number } {
  const pw = raster.pixelWidth;
  const ph = raster.pixelHeight;
  const epsg = raster.projection;

  if (epsg == null || typeof epsg !== "number") {
    return { mX: Math.abs(pw), mY: Math.abs(ph) };
  }

  const rasterCrs = `EPSG:${epsg}`;
  let toRaster: (lonLat: [number, number]) => [number, number];
  let toWgs84: (xy: [number, number]) => [number, number];
  try {
    toRaster = proj4("EPSG:4326", rasterCrs).forward as (
      lonLat: [number, number],
    ) => [number, number];
    toWgs84 = proj4(rasterCrs, "EPSG:4326").forward as (
      xy: [number, number],
    ) => [number, number];
  } catch {
    return { mX: Math.abs(pw), mY: Math.abs(ph) };
  }

  const [cx, cy] = toRaster(centerLonLat);
  const origin = toWgs84([cx, cy]);
  const east = toWgs84([cx + pw, cy]);
  const north = toWgs84([cx, cy + ph]);

  const mX = distance(point(origin), point(east), { units: "meters" });
  const mY = distance(point(origin), point(north), { units: "meters" });

  // Bad transforms (e.g. pole/antimeridian) or invalid coords can yield NaN distances.
  // geoblaze does `new Array(sample_height * yvrm)` — NaN there throws "Invalid array length".
  if (!Number.isFinite(mX) || !Number.isFinite(mY) || mX <= 0 || mY <= 0) {
    return { mX: Math.abs(pw), mY: Math.abs(ph) };
  }

  return { mX, mY };
}

/**
 * Resolve the VRM value to apply given user options and fragment area.
 *
 * - `false`   → VRM disabled; returns null.
 * - `number`  → explicit value; expands to [n, n] (min 1).
 * - `'auto'`  → targets ~100 m virtual grid cells. Returns [1, 1] when
 *               native pixels are already finer than 100 m.
 *               Hard per-axis cap: MAX_VRM_PER_AXIS.
 */
export function resolveVrm(
  vrmOpt: false | "auto" | number | undefined,
  fragmentAreaSqM: number,
  groundDims: { mX: number; mY: number },
): [number, number] | null {
  if (vrmOpt === false) return null;

  if (typeof vrmOpt === "number") {
    const v = Math.max(1, Math.round(vrmOpt));
    return [v, v];
  }

  // 'auto': upsample until virtual pixels are ~100 m on each axis
  const targetMeters = 100;

  if (
    !Number.isFinite(groundDims.mX) ||
    !Number.isFinite(groundDims.mY) ||
    groundDims.mX <= 0 ||
    groundDims.mY <= 0
  ) {
    return [1, 1];
  }

  const vx = Math.min(
    MAX_VRM_PER_AXIS,
    Math.max(1, Math.ceil(groundDims.mX / targetMeters)),
  );
  const vy = Math.min(
    MAX_VRM_PER_AXIS,
    Math.max(1, Math.ceil(groundDims.mY / targetMeters)),
  );
  return [vx, vy];
}

export function downsampleHistogram(
  histogram: HistogramEntry[],
  maxEntries: number,
): HistogramEntry[] {
  if (histogram.length === 0 || histogram.length <= maxEntries) {
    return histogram;
  }

  // Ensure sorted by value (x)
  const sorted = [...histogram].sort((a, b) => a[0] - b[0]);
  const minValue = sorted[0][0];
  const maxValue = sorted[sorted.length - 1][0];

  if (!isFinite(minValue) || !isFinite(maxValue) || minValue === maxValue) {
    const totalCount = sorted.reduce((acc, [, count]) => acc + count, 0);
    return [[minValue, totalCount]];
  }

  const numBins = maxEntries;
  const binCounts = new Array<number>(numBins).fill(0);

  const span = maxValue - minValue;

  for (const [value, count] of sorted) {
    const normalized = (value - minValue) / span;
    let binIndex = Math.round(normalized * (numBins - 1));
    if (binIndex < 0) binIndex = 0;
    if (binIndex >= numBins) binIndex = numBins - 1;
    binCounts[binIndex] += count;
  }

  const result: HistogramEntry[] = [];
  for (let i = 0; i < numBins; i++) {
    const count = binCounts[i];
    if (count === 0) continue;
    const value = minValue + (span * i) / (numBins - 1);
    result.push([value, count]);
  }

  return result;
}

let _geoblaze: any;

function getGeoblaze() {
  if (!_geoblaze) {
    _geoblaze = require("geoblaze");
  }
  return _geoblaze;
}

/**
 * Calculate raster statistics for a feature that has already been reprojected
 * into the raster's native CRS.
 *
 * Reprojection is the caller's responsibility so that this function — and by
 * extension overlay-engine — does not need to bundle epsg-index (6 MB).
 *
 * @param sourceUrl  URL of the COG.
 * @param feature    Feature already projected into the raster's native CRS.
 * @param options.vrm
 *   - `false`  → disable VRM (recommended for large geography subjects).
 *   - `'auto'` (default) → fragment-size-aware dynamic VRM.
 *   - `number` → explicit VRM value, applied as [n, n].
 * @param options.centerLonLat
 *   WGS84 [lon, lat] of the sketch fragment centre.  Used for accurate
 *   ground-pixel-size measurement in the auto-VRM calculation.  When omitted
 *   the VRM defaults to [1, 1] (no upsampling).
 * @param options.fragmentAreaSqM
 *   Area of the original WGS84 feature in square metres.  Used by auto-VRM
 *   to size virtual pixels relative to the fragment.  When omitted alongside
 *   centerLonLat the VRM defaults to [1, 1].
 */
export async function calculateRasterStats(
  sourceUrl: string,
  feature: Feature<Polygon | MultiPolygon>,
  options?: {
    vrm?: false | "auto" | number;
    centerLonLat?: [number, number];
    fragmentAreaSqM?: number;
  },
): Promise<{ bands: RasterBandStats[] }> {
  const geoblaze = getGeoblaze();

  try {
    const raster = await geoblaze.parse(sourceUrl);
    const featureBBox = calcBBox(feature, { recompute: true });
    const rasterBBox = [raster.xmin, raster.ymin, raster.xmax, raster.ymax];
    const rasterEpsg =
      typeof raster.projection === "number" &&
      Number.isFinite(raster.projection)
        ? raster.projection
        : undefined;
    if (!intersects(featureBBox as BBox, rasterBBox as BBox)) {
      logRasterStatsVerbose(
        "no intersection between feature bbox and raster extent",
        {
          sourceUrl,
          featureBBox,
          rasterBBox,
          rasterSize: { width: raster.width, height: raster.height },
        },
      );
      return {
        bands: [
          {
            count: 0,
            min: NaN,
            max: NaN,
            mean: NaN,
            median: NaN,
            range: NaN,
            histogram: [],
            invalid: 0,
            sum: 0,
            vrm: null,
            ...(rasterEpsg != null ? { epsg: rasterEpsg } : {}),
          },
        ],
      };
    }

    // Resolve VRM. centerLonLat and fragmentAreaSqM are optional; if not
    // provided the auto calculation falls back to [1, 1] (no upsampling).
    const centerLonLat = options?.centerLonLat;
    const fragmentAreaSqM = options?.fragmentAreaSqM ?? 0;
    const groundDims =
      centerLonLat != null
        ? groundPixelDimensionsMeters(raster, centerLonLat)
        : { mX: 0, mY: 0 };
    const vrmOpt = options?.vrm ?? "auto";
    const resolvedVrm = resolveVrm(vrmOpt, fragmentAreaSqM, groundDims);

    const statsExtra =
      resolvedVrm != null
        ? { vrm: resolvedVrm, rescale: true as const }
        : undefined;

    logRasterStatsVerbose("geoblaze.stats input summary", {
      sourceUrl,
      centerLonLat,
      fragmentAreaSqM,
      featureBBox,
      raster: {
        width: raster.width,
        height: raster.height,
        pixelWidth: raster.pixelWidth,
        pixelHeight: raster.pixelHeight,
        projection: raster.projection,
        xmin: raster.xmin,
        ymin: raster.ymin,
        xmax: raster.xmax,
        ymax: raster.ymax,
      },
      groundDimsMeters: groundDims,
      vrmOption: vrmOpt,
      resolvedVrm,
      statsExtra: statsExtra ?? null,
    });

    const stats = await geoblaze.stats(
      raster,
      feature,
      {
        stats: [
          "count",
          "min",
          "max",
          "mean",
          "median",
          "range",
          "histogram",
          "invalid",
          "sum",
        ],
      },
      undefined,
      statsExtra,
    );

    logRasterStatsVerbose("geoblaze.stats completed", {
      sourceUrl,
      bandCount: stats.length,
      perBand: stats.map(
        (
          s: { count?: number; sum?: number; min?: number; max?: number },
          i: number,
        ) => ({
          bandIndex: i,
          count: s.count,
          sum: s.sum,
          min: s.min,
          max: s.max,
        }),
      ),
    });

    return {
      bands: stats.map((stat: any) => {
        const rawHistogram: HistogramEntry[] = Array.isArray(stat.histogram)
          ? (stat.histogram as HistogramEntry[])
          : Object.values(
              stat.histogram as Record<string, { n: number; ct: number }>,
            ).map((r) => [r.n, r.ct] as HistogramEntry);

        const histogram = downsampleHistogram(rawHistogram, 200);

        return {
          count: stat.count,
          min: stat.min,
          max: stat.max,
          mean: stat.mean,
          median: stat.median,
          range: stat.range,
          histogram,
          invalid: stat.invalid,
          sum: stat.sum,
          vrm: resolvedVrm,
          ...(rasterEpsg != null ? { epsg: rasterEpsg } : {}),
        } as RasterBandStats;
      }),
    };
  } catch (e) {
    console.error("Error calculating raster stats", e);
    console.log(sourceUrl);
    console.log(feature);
    console.log(feature.geometry.coordinates);
    if (typeof e === "string" && e.includes("No Values")) {
      return {
        bands: [
          {
            count: 0,
            min: NaN,
            max: NaN,
            mean: NaN,
            median: NaN,
            range: NaN,
            histogram: [],
            invalid: 0,
            sum: 0,
            vrm: null,
          } as RasterBandStats,
        ],
      };
    } else {
      throw e;
    }
  }
}

function intersects(bbox1: BBox, bbox2: BBox) {
  return (
    bbox1[0] <= bbox2[2] &&
    bbox1[2] >= bbox2[0] &&
    bbox1[1] <= bbox2[3] &&
    bbox1[3] >= bbox2[1]
  );
}
