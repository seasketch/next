import { BBox, Feature, MultiPolygon, Polygon } from "geojson";
import distance from "@turf/distance";
import { point } from "@turf/helpers";
import proj4 from "proj4";
import { RasterBandStats } from "./metrics/metrics";
import calcBBox from "@turf/bbox";
export type HistogramEntry = [number, number];

/**
 * Verbose `console.log` for raster stats / VRM (set `RASTER_STATS_VERBOSE=0` to disable).
 */
const RASTER_STATS_VERBOSE = true;

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

/** Target sub-cell size for virtual resampling (~10 m on the ground). */
const TARGET_GROUND_SAMPLE_METERS = 50;
/**
 * Upper bound per axis to avoid pathological work when rasters are extremely coarse.
 * At the cap, effective ground resolution may be coarser than TARGET_GROUND_SAMPLE_METERS.
 */
const MAX_VRM_PER_AXIS = 20;

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
 * True when native pixels are **coarser** than {@link TARGET_GROUND_SAMPLE_METERS} on the ground
 * on either axis (so virtual resampling is needed).
 */
export function needsVirtualResamplingForGroundResolution(dims: {
  mX: number;
  mY: number;
}): boolean {
  if (
    !Number.isFinite(dims.mX) ||
    !Number.isFinite(dims.mY) ||
    dims.mX <= 0 ||
    dims.mY <= 0
  ) {
    return false;
  }
  return (
    dims.mX > TARGET_GROUND_SAMPLE_METERS ||
    dims.mY > TARGET_GROUND_SAMPLE_METERS
  );
}

/**
 * VRM so that virtually subdivided cells are about {@link TARGET_GROUND_SAMPLE_METERS}
 * on a side. See [geoblaze stats / vrm](https://docs.geoblaze.io/#stats).
 */
export function vrmFromGroundPixelDimensions(dims: {
  mX: number;
  mY: number;
}): [number, number] {
  if (
    !Number.isFinite(dims.mX) ||
    !Number.isFinite(dims.mY) ||
    dims.mX <= 0 ||
    dims.mY <= 0
  ) {
    return [1, 1];
  }
  const vx = Math.min(
    MAX_VRM_PER_AXIS,
    Math.max(1, Math.ceil(dims.mX / TARGET_GROUND_SAMPLE_METERS)),
  );
  const vy = Math.min(
    MAX_VRM_PER_AXIS,
    Math.max(1, Math.ceil(dims.mY / TARGET_GROUND_SAMPLE_METERS)),
  );
  return [vx, vy];
}

function isSafeVrmForGeoblaze(vrm: [number, number]): boolean {
  const [a, b] = vrm;
  return (
    Number.isInteger(a) &&
    Number.isInteger(b) &&
    a >= 1 &&
    b >= 1 &&
    a <= MAX_VRM_PER_AXIS &&
    b <= MAX_VRM_PER_AXIS
  );
}

/** Convenience: ground size → VRM (use when you always pass `vrm` to geoblaze). */
export function vrmForTargetGroundResolution(
  raster: GeorasterLike,
  centerLonLat: [number, number],
): [number, number] {
  return vrmFromGroundPixelDimensions(
    groundPixelDimensionsMeters(raster, centerLonLat),
  );
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

export async function calculateRasterStats(
  sourceUrl: string,
  feature: Feature<Polygon | MultiPolygon>,
): Promise<{ bands: RasterBandStats[] }> {
  const geoblaze = getGeoblaze();
  try {
    const raster = await geoblaze.parse(sourceUrl);
    const featureBBox = calcBBox(feature, { recompute: true });
    const rasterBBox = [raster.xmin, raster.ymin, raster.xmax, raster.ymax];
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
      // Without this check we just get errors like this:
      // Cannot read properties of undefined (reading 'vrm')
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
          },
        ],
      };
    }
    // GeoJSON bbox is WGS84; rasterBBox is in the raster CRS — do not mix them.
    // Representative location for ground-distance → VRM: center of the sketch fragment.
    const centerLonLat: [number, number] = [
      (featureBBox[0] + featureBBox[2]) / 2,
      (featureBBox[1] + featureBBox[3]) / 2,
    ];
    const groundDims = groundPixelDimensionsMeters(raster, centerLonLat);
    const wantVrm = needsVirtualResamplingForGroundResolution(groundDims);
    const vrmCandidate = wantVrm
      ? vrmFromGroundPixelDimensions(groundDims)
      : null;
    const statsExtra =
      wantVrm && vrmCandidate && isSafeVrmForGeoblaze(vrmCandidate)
        ? { vrm: vrmCandidate, rescale: true as const }
        : undefined;

    logRasterStatsVerbose("geoblaze.stats input summary", {
      sourceUrl,
      centerLonLat,
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
      targetGroundSampleMeters: TARGET_GROUND_SAMPLE_METERS,
      maxVrmPerAxis: MAX_VRM_PER_AXIS,
      wantVrm,
      vrmCandidate,
      vrmPassesSafetyCheck:
        vrmCandidate != null && isSafeVrmForGeoblaze(vrmCandidate),
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
        };
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
