import { codes, lightDescription, markLabel, seabedLabel } from "./labels.js";
import { areaCenterSymbol } from "./portrayal.js";

/**
 * S-57 object classes the chart tiles, grouped the way the style draws them.
 * Classes not listed are left out of the tiles.
 */
export const ENC_LAYER_BY_CLASS: Record<string, string> = {
  DEPARE: "depth_area",
  DRGARE: "depth_area",
  UNSARE: "depth_area",
  LNDARE: "land",
  BUAARE: "land",
  LNDELV: "land_detail",
  LNDMRK: "land_detail",
  BUISGL: "land_detail",
  SILTNK: "land_detail",
  CGUSTA: "land_detail",
  DYKCON: "land_detail",
  FNCLNE: "land_detail",
  SLOGRD: "land_detail",
  SLOTOP: "land_detail",
  PRDARE: "land_detail",
  RDOSTA: "land_detail",
  SBDARE: "seabed",
  WEDKLP: "seabed",
  SNDWAV: "seabed",
  WATTUR: "seabed",
  // Lakes and rivers sit inside the land polygon. They are drawn after land
  // so they read as water rather than as another tan fill.
  LAKARE: "inland_water",
  LOKBSN: "inland_water",
  RIVERS: "inland_water",
  CANALS: "inland_water",
  COALNE: "coast",
  SLCONS: "coast",
  DEPCNT: "depth_contour",
  SOUNDG: "sounding",
  LIGHTS: "aid",
  LITFLT: "aid",
  LITVES: "aid",
  BOYSPP: "aid",
  BOYCAR: "aid",
  BOYISD: "aid",
  BOYLAT: "aid",
  BOYSAW: "aid",
  BOYINB: "aid",
  BCNSPP: "aid",
  BCNCAR: "aid",
  BCNISD: "aid",
  BCNLAT: "aid",
  BCNSAW: "aid",
  DAYMAR: "aid",
  TOPMAR: "aid",
  FOGSIG: "aid",
  RTPBCN: "aid",
  OBSTRN: "hazard",
  WRECKS: "hazard",
  UWTROC: "hazard",
  PILPNT: "pile",
  OFSPLF: "platform",
  MORFAC: "mooring",
  BERTHS: "mooring",
  CBLSUB: "cable",
  CBLARE: "cable",
  PIPSOL: "cable",
  TSSLPT: "separation",
  TSSBND: "separation",
  TSELNE: "separation",
  DWRTPT: "separation",
  TSEZNE: "separation",
  BRIDGE: "structure",
  SEAARE: "place",
  LNDRGN: "place",
  RESARE: "regulated",
  ACHARE: "regulated",
  CTNARE: "regulated",
  MIPARE: "regulated",
  DMPGRD: "regulated",
  PRCARE: "regulated",
  MARCUL: "regulated",
  PILBOP: "regulated",
  FAIRWY: "route",
  RECTRC: "route",
  NAVLNE: "route",
  // Group-1 skin that is not land or depth. Drawn with the land so the
  // chart does not leave a hole where a dock or hulk sits.
  FLODOC: "land",
  HULKES: "land",
  PONTON: "land",
  SMCFAC: "land",
  // Jurisdictional limits. Dashed, and cut at the cell edge, so a limit that
  // is the cell itself draws nothing.
  ADMARE: "limit",
  CONZNE: "limit",
  COSARE: "limit",
  EXEZNE: "limit",
  TESARE: "limit",
};

/**
 * Skin-of-the-earth classes. They tessellate each cell, so a scale minimum
 * must not hide one of them or the chart develops a hole.
 */
export const SKIN_CLASSES = new Set([
  "DEPARE",
  "DRGARE",
  "UNSARE",
  "LNDARE",
  "FLODOC",
  "HULKES",
  "PONTON",
]);

/**
 * These objects are the chart at that usage band, so they appear for the whole
 * time the band is the one on screen. A scale minimum would hide the coastal
 * contours while the coastal depth areas were already drawn.
 */
export function ignoresScaleMinimum(objectClass: string | undefined): boolean {
  return (
    objectClass != null && (SKIN_CLASSES.has(objectClass) || objectClass === "DEPCNT")
  );
}

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

/**
 * First zoom at which a usage band is the chart to draw. A smaller-scale
 * cell stops at the next band's zoom wherever that larger-scale cell covers
 * the same water, so a generalized shoreline is not drawn on top of a
 * harbour chart. Overview stays available from zoom 0.
 */
export const BAND_MIN_ZOOM: Record<number, number> = {
  1: 0,
  2: 6,
  3: 8,
  4: 10,
  5: 12,
  6: 14,
};

export const ENC_MAX_ZOOM = 16;

export type EncSource = { id: string; bands: number[]; maxzoom: number };

/**
 * One tile archive per group of usage bands, each cut only as deep as its
 * data. The map overzooms past that. In one archive, every overview depth
 * area runs to zoom 16 wherever no harbour chart covers it: a coastline's
 * open ocean becomes millions of tiles of a single fill.
 */
export const ENC_SOURCES: EncSource[] = [
  { id: "small", bands: [1, 2], maxzoom: 10 },
  { id: "coastal", bands: [3], maxzoom: 12 },
  { id: "approach", bands: [4], maxzoom: 14 },
  { id: "harbour", bands: [5, 6], maxzoom: ENC_MAX_ZOOM },
];

/** The archive a band's features go in. A cell without a band is treated as harbour scale. */
export function sourceForBand(band: unknown): EncSource {
  const found = ENC_SOURCES.find((source) => typeof band === "number" && source.bands.includes(band));
  return found || ENC_SOURCES[ENC_SOURCES.length - 1];
}

/**
 * Fit a feature's zoom range into its archive. Past the archive's last zoom
 * the map overzooms that tile, so a range that ends or starts there moves to
 * `zmin` / `zmax` properties for the style to filter on.
 */
export function fitToSource(
  feature: { properties: Record<string, unknown>; tippecanoe: { minzoom: number; maxzoom: number } },
  source: EncSource
): void {
  const { minzoom, maxzoom } = feature.tippecanoe;
  if (source.maxzoom >= ENC_MAX_ZOOM) return;
  if (minzoom > source.maxzoom) {
    feature.properties.zmin = minzoom;
    feature.tippecanoe.minzoom = source.maxzoom;
  }
  if (maxzoom >= source.maxzoom && maxzoom < ENC_MAX_ZOOM) feature.properties.zmax = maxzoom;
  feature.tippecanoe.maxzoom = Math.min(maxzoom, source.maxzoom);
}

export function bandMinZoom(band: number | null): number {
  if (band == null) return 0;
  const zoom = BAND_MIN_ZOOM[band];
  return zoom == null ? 0 : zoom;
}

export type EncFeatureMeta = {
  cell: string;
  /** Usage band from the cell name, or null when the name has none. */
  band: number | null;
  /** Tile source-layer. */
  layer: string;
  /** S-57 object class, such as DEPARE or BOYLAT. */
  objectClass?: string;
  /**
   * When set, SCAMIN does not raise minzoom. Skin-of-the-earth features need
   * this so one depth area cannot vanish and leave a hole in the cell.
   */
  ignoreScaleMinimum?: boolean;
};

export function bandFromCellName(name: string): number | null {
  const match = name.toUpperCase().match(/^[A-Z]{2}(\d)/);
  if (!match) return null;
  const band = Number(match[1]);
  if (!Number.isInteger(band) || band < 1 || band > 6) return null;
  return band;
}

/** Metres per screen pixel the S-52 display scale assumes. */
const S52_PIXEL_METRES = 0.00028;
const EARTH_CIRCUMFERENCE = 40075016.686;
/** Mapbox and MapLibre zoom 0 is one 512-pixel tile for the whole world. */
const WORLD_PIXELS_AT_ZOOM_0 = 512;

/**
 * Zoom at which the display scale reaches this S-57 SCAMIN (a scale
 * denominator), at that latitude. Larger denominators are smaller scales, so
 * they show up sooner. Rounded to the nearest zoom, so a symbol appears close
 * to the scale the chart compiler chose rather than a whole zoom late.
 */
export function zoomForScaleDenominator(denominator: number, latitude = 0): number {
  if (!Number.isFinite(denominator) || denominator <= 0) return 0;
  const lat = Number.isFinite(latitude) ? Math.max(-85, Math.min(85, latitude)) : 0;
  const metresAcross = EARTH_CIRCUMFERENCE * Math.cos((lat * Math.PI) / 180);
  const zoom = Math.log2(metresAcross / (WORLD_PIXELS_AT_ZOOM_0 * denominator * S52_PIXEL_METRES));
  return Math.max(0, Math.min(16, Math.round(zoom)));
}

export function zoomRangeForFeature(
  band: number | null,
  scamin: number | null,
  latitude = 0
): { minzoom: number; maxzoom: number } {
  let minzoom = bandMinZoom(band);
  const maxzoom = ENC_MAX_ZOOM;
  if (scamin != null && Number.isFinite(scamin) && scamin > 0) {
    minzoom = Math.max(minzoom, zoomForScaleDenominator(scamin, latitude));
  }
  if (minzoom > maxzoom) minzoom = maxzoom;
  return { minzoom, maxzoom };
}

function scalarProperty(value: unknown): string | number | boolean | null {
  // GDAL writes S-57 list attributes (COLOUR, NATSUR, CATLMK) as arrays.
  // Tiles only hold scalars, so keep them as the comma list S-57 uses.
  if (Array.isArray(value)) {
    const items = value.filter(
      (item) => typeof item === "string" || (typeof item === "number" && Number.isFinite(item))
    );
    return items.length ? scalarProperty(items.join(",")) : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 && trimmed.length <= 200 ? trimmed : null;
  }
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

/** First S-57 COLOUR code. Lists look like "3,1" (red, white). */
export function firstColour(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const code = Number(value.split(",")[0]);
  return Number.isFinite(code) ? code : null;
}

/**
 * A short mark class so the style can colour buoys and beacons the way
 * IALA-B (the United States) does, without parsing attribute lists itself.
 */
export function aidMark(
  objectClass: string,
  source: Record<string, unknown>
): string | null {
  if (objectClass === "BOYLAT" || objectClass === "BCNLAT") {
    const category = Number(source.CATLAM);
    if (category === 1) return "port";
    if (category === 2) return "starboard";
    return "lateral";
  }
  const fixed: Record<string, string> = {
    BOYSPP: "special",
    BCNSPP: "special",
    BOYSAW: "safe",
    BCNSAW: "safe",
    BOYCAR: "cardinal",
    BCNCAR: "cardinal",
    BOYISD: "isolated",
    BCNISD: "isolated",
    LIGHTS: "light",
    LITFLT: "light",
    LITVES: "light",
    FOGSIG: "fog",
    DAYMAR: "daymark",
  };
  return fixed[objectClass] || null;
}

/**
 * Sprite for a landmark, building or tank: the INT 1 shapes for the
 * categories that read differently from the water, else a position circle.
 */
export function landmarkSymbol(objectClass: string, source: Record<string, unknown>): string | null {
  if (objectClass === "SILTNK") return "tank";
  if (objectClass === "BUISGL") return "building";
  if (objectClass !== "LNDMRK") return null;
  const category = codes(scalarProperty(source.CATLMK))[0];
  const byCategory: Record<number, string> = {
    3: "landmark-chimney",
    6: "landmark-chimney",
    4: "landmark-mast",
    5: "landmark-mast",
    7: "landmark-mast",
    16: "landmark-mast",
    15: "landmark-dome",
    17: "landmark-tower",
    18: "landmark-windmill",
    19: "landmark-windmill",
    20: "landmark-spire",
    9: "landmark-monument",
    10: "landmark-monument",
    12: "landmark-monument",
    13: "landmark-monument",
    14: "landmark-monument",
  };
  return (category && byCategory[category]) || "landmark";
}

/**
 * Sprite for a topmark, by TOPSHP. Drawn black, as S-52 does, so the shape
 * reads against any buoy colour.
 */
export function topmarkSymbol(shape: unknown): string {
  const byShape: Record<number, string> = {
    1: "topmark-cone-up",
    24: "topmark-cone-up",
    2: "topmark-cone-down",
    25: "topmark-cone-down",
    3: "topmark-sphere",
    26: "topmark-sphere",
    4: "topmark-spheres",
    5: "topmark-can",
    7: "topmark-x",
    8: "topmark-cross",
    27: "topmark-cross",
    28: "topmark-cross",
    9: "topmark-diamond",
    12: "topmark-diamond",
    10: "topmark-cones-in",
    11: "topmark-cones-out",
    13: "topmark-cones-up",
    14: "topmark-cones-down",
  };
  const code = codes(scalarProperty(shape))[0];
  return (code && byShape[code]) || "topmark-board";
}

function firstLatitude(geometry: unknown): number {
  let value: unknown = (geometry as { coordinates?: unknown }).coordinates;
  while (Array.isArray(value) && Array.isArray(value[0])) value = value[0];
  if (Array.isArray(value) && typeof value[1] === "number") return value[1];
  return 0;
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
  if (meta.objectClass) properties.obj = meta.objectClass;
  let scamin: number | null = null;
  for (const [key, raw] of Object.entries(source)) {
    if (DROPPED_ATTRIBUTES.has(key)) continue;
    const scalar = scalarProperty(raw);
    if (scalar == null) continue;
    properties[key] = scalar;
    if (key === "SCAMIN" && typeof scalar === "number" && !meta.ignoreScaleMinimum) {
      scamin = scalar;
    }
  }
  if (meta.objectClass) {
    const objectClass = meta.objectClass;
    const mark = aidMark(objectClass, source);
    if (mark) properties.mark = mark;
    const colour = firstColour(properties.COLOUR);
    if (colour != null) properties.colour = colour;
    const label = markLabel(objectClass, properties.OBJNAM);
    if (label && (mark || objectClass === "LIGHTS")) properties.label = label;
    if (objectClass === "LIGHTS") {
      const description = lightDescription(properties);
      if (description) properties.litdsn = description;
    }
    if (objectClass === "SBDARE") {
      const seabed = seabedLabel(properties);
      if (seabed) properties.seabed = seabed;
    }
    if (objectClass === "TOPMAR") properties.topmark = topmarkSymbol(properties.TOPSHP);
    const symbol = landmarkSymbol(objectClass, properties) || areaCenterSymbol(objectClass);
    if (symbol) properties.symbol = symbol;
  }
  const range = zoomRangeForFeature(meta.band, scamin, firstLatitude(feature.geometry));
  return {
    type: "Feature",
    geometry: feature.geometry,
    properties,
    tippecanoe: { layer: meta.layer, minzoom: range.minzoom, maxzoom: range.maxzoom },
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
