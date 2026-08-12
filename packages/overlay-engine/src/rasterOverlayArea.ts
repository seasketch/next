import { BBox, Feature, MultiPolygon, Polygon } from "geojson";
import calcBBox from "@turf/bbox";
import turfArea from "@turf/area";
import {
  MAX_RASTER_OVERLAY_AREA_CLASSES,
  RasterOverlayAreaAreas,
  RasterOverlayAreaMetricValue,
  RasterOverlayAreaOverlapInfo,
} from "./metrics/metrics";
import {
  groundPixelDimensionsMeters,
  resolveVrm,
} from "./rasterStats";
import {
  computeGeoblazeBandStats,
  intersectingWindowPixelCounts,
} from "./geoblazeBandStats";

// geoblaze is CommonJS; keep the same lazy require pattern as rasterStats.ts
let _geoblaze: any = null;
function getGeoblaze() {
  if (!_geoblaze) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _geoblaze = require("geoblaze");
  }
  return _geoblaze;
}

function intersects(bbox1: BBox, bbox2: BBox) {
  return (
    bbox1[0] <= bbox2[2] &&
    bbox1[2] >= bbox2[0] &&
    bbox1[1] <= bbox2[3] &&
    bbox1[3] >= bbox2[1]
  );
}

/**
 * Convert per-value (or total) pixel counts to km² using geodesic ground
 * pixel size.
 *
 * Counts must already be in native-pixel units. With geoblaze
 * `{ vrm, rescale: true }`, `valid` / histogram totals are fractional native
 * pixels — do **not** divide by VRM again (that would shrink area as VRM grows).
 *
 * areaKm2 = count × mX × mY / 1e6
 */
export function pixelCountsToAreaKm2(
  counts: RasterOverlayAreaAreas,
  groundDims: { mX: number; mY: number },
): RasterOverlayAreaAreas {
  const pixelAreaM2 = groundDims.mX * groundDims.mY;
  if (!Number.isFinite(pixelAreaM2) || pixelAreaM2 <= 0) {
    const zero: RasterOverlayAreaAreas = {};
    for (const key of Object.keys(counts)) {
      zero[key] = 0;
    }
    return zero;
  }
  const scale = pixelAreaM2 / 1_000_000;
  const areas: RasterOverlayAreaAreas = {};
  for (const [key, count] of Object.entries(counts)) {
    areas[key] =
      typeof count === "number" && Number.isFinite(count)
        ? count * scale
        : 0;
  }
  return areas;
}

/**
 * Parse geoblaze histogram (array or object form) into rounded class-key counts.
 * Does **not** downsample — class keys must stay exact.
 */
export function histogramToClassCounts(
  histogram: unknown,
  groupByValue: boolean,
  validCount: number,
): RasterOverlayAreaAreas {
  const counts: RasterOverlayAreaAreas = { "*": validCount };
  if (!groupByValue) {
    return counts;
  }

  const entries: [number, number][] = [];
  if (Array.isArray(histogram)) {
    for (const entry of histogram) {
      if (
        Array.isArray(entry) &&
        entry.length >= 2 &&
        typeof entry[0] === "number" &&
        typeof entry[1] === "number"
      ) {
        entries.push([entry[0], entry[1]]);
      }
    }
  } else if (histogram && typeof histogram === "object") {
    for (const row of Object.values(
      histogram as Record<string, { n?: number; ct?: number } | number>,
    )) {
      if (typeof row === "number") {
        // keyed by value string
        continue;
      }
      if (
        row &&
        typeof row === "object" &&
        typeof row.n === "number" &&
        typeof row.ct === "number"
      ) {
        entries.push([row.n, row.ct]);
      }
    }
    // Also handle { "1": count, "2": count } style
    if (entries.length === 0) {
      for (const [k, v] of Object.entries(
        histogram as Record<string, unknown>,
      )) {
        const n = Number(k);
        if (Number.isFinite(n) && typeof v === "number" && Number.isFinite(v)) {
          entries.push([n, v]);
        }
      }
    }
  }

  for (const [value, count] of entries) {
    if (!Number.isFinite(value) || !Number.isFinite(count)) {
      continue;
    }
    const key = String(Math.round(value));
    counts[key] = (counts[key] ?? 0) + count;
  }

  const classKeyCount = Object.keys(counts).filter((k) => k !== "*").length;
  if (classKeyCount > MAX_RASTER_OVERLAY_AREA_CLASSES) {
    throw new Error(
      `raster_overlay_area groupBy "value" produced ${classKeyCount} distinct classes (max ${MAX_RASTER_OVERLAY_AREA_CLASSES}). Grouping a continuous raster by value is not supported.`,
    );
  }

  return counts;
}

function subtractAreas(
  areas: RasterOverlayAreaAreas,
  collar: RasterOverlayAreaAreas,
): RasterOverlayAreaAreas {
  const keys = new Set([...Object.keys(areas), ...Object.keys(collar)]);
  const inner: RasterOverlayAreaAreas = {};
  for (const k of keys) {
    inner[k] = Math.max(0, (areas[k] ?? 0) - (collar[k] ?? 0));
  }
  return inner;
}

export type CalculateRasterOverlayAreaOptions = {
  vrm?: false | "auto" | number;
  centerLonLat?: [number, number];
  fragmentAreaSqM?: number;
  /** When true, produce per-value class keys (groupBy: "value"). */
  groupByValue?: boolean;
  /**
   * Optional collar geometry (already in raster CRS) + WGS84 bbox metadata.
   * When provided, a second stats pass fills overlap collar/inner areas.
   * Caller must resolve a single VRM from the buffered subject for both passes.
   */
  collar?: {
    feature: Feature<Polygon | MultiPolygon>;
    /** WGS84 bbox of the buffered subject. */
    bbox: [number, number, number, number];
    bufferKm: number;
  };
  /**
   * Test-only: run the streaming pixel path even when the window is below
   * the geoblaze value-array threshold. Production callers must omit this.
   */
  forceStream?: boolean;
  /**
   * Test-only: run geoblaze.stats even when the bbox window is above the
   * streaming threshold. Production callers must omit this.
   */
  forceCollect?: boolean;
};

/**
 * Calculate raster overlay area (km²) for a feature already reprojected into
 * the raster's native CRS.
 *
 * Per-value pixel counts come from geoblaze's histogram stat (exact, not the
 * condensed 200-entry display histogram used by raster_stats). Counts are
 * converted to km² and discarded — the metric stores only `areas`.
 *
 * When `collar` is provided, both the subject and collar passes share one
 * resolved VRM (from the buffered subject options).
 */
export async function calculateRasterOverlayArea(
  sourceUrl: string,
  feature: Feature<Polygon | MultiPolygon>,
  options?: CalculateRasterOverlayAreaOptions,
): Promise<RasterOverlayAreaMetricValue> {
  const geoblaze = getGeoblaze();
  const groupByValue = options?.groupByValue === true;

  try {
    const raster = await geoblaze.parse(sourceUrl);
    const featureBBox = calcBBox(feature, { recompute: true });
    const rasterBBox = [raster.xmin, raster.ymin, raster.xmax, raster.ymax];
    const rasterEpsg =
      typeof raster.projection === "number" &&
      Number.isFinite(raster.projection)
        ? raster.projection
        : undefined;

    if (raster.numberOfRasters != null && raster.numberOfRasters > 1) {
      // geoblaze may expose bands differently; also check maxs length
    }
    if (Array.isArray(raster.maxs) && raster.maxs.length > 1) {
      throw new Error(
        "raster_overlay_area supports single-band rasters only",
      );
    }

    if (!intersects(featureBBox as BBox, rasterBBox as BBox)) {
      return {
        areas: { "*": 0 },
        vrm: null,
        ...(rasterEpsg != null ? { epsg: rasterEpsg } : {}),
      };
    }

    const centerLonLat = options?.centerLonLat;
    const fragmentAreaSqM = options?.fragmentAreaSqM ?? 0;

    // Geodesic ground-pixel size at the sketch centre. Used for both VRM
    // sizing and area conversion (correct for geographic CRS and Web
    // Mercator; for equal-area meter CRSs the product ≈ pw×ph).
    const groundDims =
      centerLonLat != null
        ? groundPixelDimensionsMeters(raster, centerLonLat)
        : {
            mX: Math.abs(raster.pixelWidth),
            mY: Math.abs(raster.pixelHeight),
          };

    const intersectingPixelCounts = intersectingWindowPixelCounts(
      featureBBox as BBox,
      raster,
    );

    const vrmOpt = options?.vrm ?? "auto";
    const resolvedVrm = resolveVrm(
      vrmOpt,
      fragmentAreaSqM,
      groundDims,
      intersectingPixelCounts,
    );
    const statsExtra =
      resolvedVrm != null
        ? { vrm: resolvedVrm, rescale: true as const }
        : undefined;

    const subjectAreas = await statsPassToAreas(
      geoblaze,
      raster,
      feature,
      groupByValue,
      groundDims,
      statsExtra,
      options?.forceStream === true,
      options?.forceCollect === true,
    );

    const result: RasterOverlayAreaMetricValue = {
      areas: subjectAreas,
      vrm: resolvedVrm,
      ...(rasterEpsg != null ? { epsg: rasterEpsg } : {}),
    };

    if (options?.collar) {
      const collarAreas = await statsPassToAreas(
        geoblaze,
        raster,
        options.collar.feature,
        groupByValue,
        groundDims,
        statsExtra,
        options?.forceStream === true,
        options?.forceCollect === true,
      );
      const innerAreas = subtractAreas(subjectAreas, collarAreas);
      const bboxAreaKm2 =
        turfArea({
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [options.collar.bbox[0], options.collar.bbox[1]],
                [options.collar.bbox[2], options.collar.bbox[1]],
                [options.collar.bbox[2], options.collar.bbox[3]],
                [options.collar.bbox[0], options.collar.bbox[3]],
                [options.collar.bbox[0], options.collar.bbox[1]],
              ],
            ],
          },
        }) / 1_000_000;

      const overlap: RasterOverlayAreaOverlapInfo = {
        bufferKm: options.collar.bufferKm,
        bbox: options.collar.bbox,
        bboxAreaKm2,
        collarAreas,
        innerAreas,
      };
      result.overlap = overlap;
    }

    return result;
  } catch (e) {
    if (typeof e === "string" && e.includes("No Values")) {
      return {
        areas: { "*": 0 },
        vrm: null,
      };
    }
    if (
      e instanceof Error &&
      e.message.includes("No Values were found in the given geometry")
    ) {
      return {
        areas: { "*": 0 },
        vrm: null,
      };
    }
    throw e;
  }
}

async function statsPassToAreas(
  geoblaze: any,
  raster: any,
  feature: Feature<Polygon | MultiPolygon>,
  groupByValue: boolean,
  groundDims: { mX: number; mY: number },
  statsExtra: { vrm: [number, number]; rescale: true } | undefined,
  forceStream = false,
  forceCollect = false,
): Promise<RasterOverlayAreaAreas> {
  const featureBBox = calcBBox(feature, { recompute: true });
  const rasterBBox = [raster.xmin, raster.ymin, raster.xmax, raster.ymax];
  if (!intersects(featureBBox as BBox, rasterBBox as BBox)) {
    return { "*": 0 };
  }

  try {
    // Prefer `valid` (non-nodata) over `count` (includes nodata). Same as
    // geoprocessing's area = valid * pw * ph.
    const stats = await computeGeoblazeBandStats(
      geoblaze,
      raster,
      feature,
      {
        stats: groupByValue
          ? ["valid", "count", "histogram"]
          : ["valid", "count"],
      },
      statsExtra,
      intersectingWindowPixelCounts(featureBBox as BBox, raster),
      { forceStream, forceCollect },
    );
    const band0 = stats[0] ?? {
      valid: 0,
      count: 0,
      histogram: {},
    };
    const validCount =
      typeof band0.valid === "number" && Number.isFinite(band0.valid)
        ? band0.valid
        : typeof band0.count === "number" && Number.isFinite(band0.count)
          ? band0.count
          : 0;
    const counts = histogramToClassCounts(
      band0.histogram,
      groupByValue,
      validCount,
    );
    // Counts are already native-pixel equivalents when statsExtra uses
    // rescale:true (or when VRM is off). VRM only improves partial-pixel
    // inclusion — it must not change the m²-per-count scale.
    return pixelCountsToAreaKm2(counts, groundDims);
  } catch (e) {
    if (
      (typeof e === "string" && e.includes("No Values")) ||
      (e instanceof Error &&
        e.message.includes("No Values were found in the given geometry"))
    ) {
      return { "*": 0 };
    }
    throw e;
  }
}
