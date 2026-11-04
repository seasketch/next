/**
 * S-57 object classes the spike tiles, grouped the way the chart style draws
 * them. Classes not listed are left out of the tiles.
 */
export const ENC_LAYER_BY_CLASS: Record<string, string> = {
  DEPARE: "depth_area",
  DRGARE: "depth_area",
  UNSARE: "depth_area",
  LNDARE: "land",
  BUAARE: "land",
  LAKARE: "land",
  COALNE: "coast",
  SLCONS: "coast",
  DEPCNT: "depth_contour",
  SOUNDG: "sounding",
  LIGHTS: "aid",
  BOYSPP: "aid",
  BOYCAR: "aid",
  BOYISD: "aid",
  BOYLAT: "aid",
  BOYSAW: "aid",
  BCNSPP: "aid",
  BCNCAR: "aid",
  BCNISD: "aid",
  BCNLAT: "aid",
  DAYMAR: "aid",
  FOGSIG: "aid",
  OBSTRN: "hazard",
  WRECKS: "hazard",
  UWTROC: "hazard",
  SEAARE: "place",
  LNDRGN: "place",
  LNDMRK: "place",
  RESARE: "regulated",
  ACHARE: "regulated",
  CTNARE: "regulated",
  FAIRWY: "route",
  RECTRC: "route",
  NAVLNE: "route",
  M_COVR: "coverage",
};

/** Record bookkeeping GDAL copies onto every feature. Not useful in a tile. */
const DROPPED_ATTRIBUTES = new Set([
  "RCID",
  "PRIM",
  "GRUP",
  "OBJL",
  "RVER",
  "AGEN",
  "FIDN",
  "FIDS",
  "LNAM",
  "LNAM_REFS",
  "NAME_RCID",
  "NAME_RCNM",
  "ORNT",
  "USAG",
  "MASK",
  "RUIN",
]);

/** Web-mercator zoom range for an ENC usage band (1 overview … 6 berthing). */
const BAND_ZOOM: Record<number, [number, number]> = {
  1: [0, 6],
  2: [4, 8],
  3: [6, 10],
  4: [8, 12],
  5: [10, 14],
  6: [12, 16],
};

export type EncFeatureMeta = {
  cell: string;
  /** Usage band from the cell name, or null when the name has none. */
  band: number | null;
  /** Tile source-layer. */
  layer: string;
};

export function bandFromCellName(name: string): number | null {
  const match = name.toUpperCase().match(/^[A-Z]{2}(\d)/);
  if (!match) return null;
  const band = Number(match[1]);
  if (!Number.isInteger(band) || band < 1 || band > 6) return null;
  return band;
}

/**
 * Zoom at which a feature with this S-57 SCAMIN (scale denominator) may
 * appear. Larger denominators are smaller scales, so they show up sooner.
 */
export function zoomForScaleDenominator(denominator: number): number {
  if (!Number.isFinite(denominator) || denominator <= 0) return 0;
  const zoom = Math.log2(156543.03392 / (denominator * 0.00028));
  return Math.max(0, Math.min(16, Math.round(zoom)));
}

export function zoomRangeForFeature(
  band: number | null,
  scamin: number | null
): { minzoom: number; maxzoom: number } {
  const [bandMin, bandMax] = band != null ? BAND_ZOOM[band] : [0, 14];
  let minzoom = bandMin;
  let maxzoom = bandMax;
  if (scamin != null && Number.isFinite(scamin) && scamin > 0) {
    minzoom = Math.max(minzoom, zoomForScaleDenominator(scamin));
  }
  if (minzoom > maxzoom) {
    maxzoom = Math.min(16, minzoom);
  }
  return { minzoom, maxzoom };
}

function scalarProperty(value: unknown): string | number | boolean | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 && trimmed.length <= 200 ? trimmed : null;
  }
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

/**
 * One GeoJSON feature as tippecanoe reads it: chart attributes, plus the
 * source-layer and zoom hint. Returns null when the input is not a feature
 * with geometry.
 */
export function rewriteEncFeature(
  value: unknown,
  meta: EncFeatureMeta
): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const feature = value as { type?: unknown; geometry?: unknown; properties?: unknown };
  if (feature.type !== "Feature" || !feature.geometry || typeof feature.geometry !== "object") {
    return null;
  }
  const source =
    feature.properties && typeof feature.properties === "object"
      ? (feature.properties as Record<string, unknown>)
      : {};
  const properties: Record<string, string | number | boolean> = {
    cls: meta.layer,
    cell: meta.cell,
  };
  if (meta.band != null) properties.band = meta.band;
  let scamin: number | null = null;
  for (const [key, raw] of Object.entries(source)) {
    if (DROPPED_ATTRIBUTES.has(key)) continue;
    const scalar = scalarProperty(raw);
    if (scalar == null) continue;
    properties[key] = scalar;
    if (key === "SCAMIN" && typeof scalar === "number") scamin = scalar;
  }
  const { minzoom, maxzoom } = zoomRangeForFeature(meta.band, scamin);
  return {
    type: "Feature",
    geometry: feature.geometry,
    properties,
    tippecanoe: { layer: meta.layer, minzoom, maxzoom },
  };
}

/** West, south, east, north. Ignores a missing or empty geometry. */
export function extendBounds(
  bounds: [number, number, number, number] | null,
  geometry: unknown
): [number, number, number, number] | null {
  if (!geometry || typeof geometry !== "object") return bounds;
  const coordinates = (geometry as { coordinates?: unknown }).coordinates;
  let next = bounds;
  const visit = (value: unknown) => {
    if (!Array.isArray(value) || value.length === 0) return;
    if (typeof value[0] === "number" && typeof value[1] === "number") {
      const x = value[0];
      const y = value[1];
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      if (!next) {
        next = [x, y, x, y];
        return;
      }
      next = [
        Math.min(next[0], x),
        Math.min(next[1], y),
        Math.max(next[2], x),
        Math.max(next[3], y),
      ];
      return;
    }
    for (const child of value) visit(child);
  };
  visit(coordinates);
  return next;
}
