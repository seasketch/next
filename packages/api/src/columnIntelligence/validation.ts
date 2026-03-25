import {
  VisualizationTypeId,
  isRasterPresentationTypeId,
  visualizationTypeIds,
} from "@seasketch/geostats-types";

/** Re-export for callers that need the id list (same source as prompts). */
export const VISUALIZATION_TYPES = visualizationTypeIds();

export type { VisualizationTypeId };

const VISUALIZATION_SET = new Set<string>(
  visualizationTypeIds() as string[],
);

function isVisualizationType(s: unknown): s is VisualizationTypeId {
  return typeof s === "string" && VISUALIZATION_SET.has(s);
}

function optString(v: unknown): string | null | undefined {
  if (v === null || v === undefined) {
    return v as null | undefined;
  }
  if (typeof v === "string") {
    return v;
  }
  return undefined;
}

/** Max stored length for LLM rationale (Postgres `text` is unbounded; cap for safety). */
export const AI_CARTOGRAPHER_RATIONALE_MAX_LEN = 8000;

/** Max length for human-friendly layer title from column intelligence. */
export const BEST_LAYER_TITLE_MAX_LEN = 200;

export function clampBestLayerTitle(
  s: string | null | undefined,
): string | null {
  if (s == null || typeof s !== "string") {
    return null;
  }
  const t = s.trim();
  if (t.length === 0) {
    return null;
  }
  if (t.length <= BEST_LAYER_TITLE_MAX_LEN) {
    return t;
  }
  return t.slice(0, BEST_LAYER_TITLE_MAX_LEN);
}

export interface ColumnIntelligenceResponse {
  best_label_column: string | null;
  best_category_column: string | null;
  best_numeric_column: string | null;
  best_date_column: string | null;
  best_popup_description_column: string | null;
  best_id_column: string | null;
  junk_columns: string[];
  chosen_presentation_type: VisualizationTypeId | null;
  /**
   * Attribute column that drives the chosen visualization (e.g. numeric field for
   * CONTINUOUS_POLYGON). Null when the style does not use a data attribute.
   */
  chosen_presentation_column: string | null;
  /** Succinct explanation of why chosen_presentation_type fits the data. */
  ai_cartographer_rationale: string | null;
  /**
   * Human-friendly map layer title derived from upload filename (UI); null if unsure.
   */
  best_layer_title: string | null;
}

function clampRationale(s: string | null): string | null {
  if (s == null || s === "") {
    return null;
  }
  if (s.length <= AI_CARTOGRAPHER_RATIONALE_MAX_LEN) {
    return s;
  }
  return s.slice(0, AI_CARTOGRAPHER_RATIONALE_MAX_LEN);
}

/**
 * Parse and validate LLM JSON (no zod — keeps api install working where private packages block npm i).
 */
export function parseColumnIntelligenceResponse(
  parsed: unknown,
): ColumnIntelligenceResponse | null {
  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    return null;
  }
  const o = parsed as Record<string, unknown>;

  const junkRaw = o.junk_columns;
  const junk_columns = Array.isArray(junkRaw)
    ? junkRaw.filter((x): x is string => typeof x === "string")
    : [];

  const pres =
    o.chosen_presentation_type ?? o.best_presentation_type;
  let chosen_presentation_type: VisualizationTypeId | null = null;
  if (pres === null || pres === undefined) {
    chosen_presentation_type = null;
  } else if (isVisualizationType(pres)) {
    chosen_presentation_type = pres;
  }

  return {
    best_label_column: optString(o.best_label_column) ?? null,
    best_category_column: optString(o.best_category_column) ?? null,
    best_numeric_column: optString(o.best_numeric_column) ?? null,
    best_date_column: optString(o.best_date_column) ?? null,
    best_popup_description_column:
      optString(o.best_popup_description_column) ?? null,
    best_id_column: optString(o.best_id_column) ?? null,
    junk_columns,
    chosen_presentation_type,
    chosen_presentation_column:
      optString(o.chosen_presentation_column) ?? null,
    ai_cartographer_rationale: clampRationale(
      optString(o.ai_cartographer_rationale) ?? null,
    ),
    best_layer_title: clampBestLayerTitle(optString(o.best_layer_title) ?? null),
  };
}

function normalizeColumnName(
  name: string | null | undefined,
  allowed: Set<string>,
): string | null {
  if (name == null || name === "") {
    return null;
  }
  if (allowed.has(name)) {
    return name;
  }
  const lower = name.toLowerCase();
  for (const c of allowed) {
    if (c.toLowerCase() === lower) {
      return c;
    }
  }
  return null;
}

/**
 * After sanitization and geometry/raster filtering, choose the attribute column
 * that drives the presentation style (LLM may omit; use sensible fallbacks).
 */
export function derivePresentationColumnForStorage(
  presentation: VisualizationTypeId | null,
  parsed: ColumnIntelligenceResponse,
  isRaster: boolean,
): string | null {
  if (isRaster || presentation == null) {
    return null;
  }
  const chosen = parsed.chosen_presentation_column;
  if (chosen) {
    return chosen;
  }
  switch (presentation) {
    case "CONTINUOUS_POLYGON":
    case "CONTINUOUS_POINT":
    case "CONTINUOUS_RASTER":
    case "PROPORTIONAL_SYMBOL":
      return parsed.best_numeric_column ?? null;
    case "CATEGORICAL_POLYGON":
    case "CATEGORICAL_POINT":
    case "CATEGORICAL_RASTER":
      return parsed.best_category_column ?? null;
    case "HEATMAP":
      return parsed.best_numeric_column ?? null;
    default:
      return null;
  }
}

const RASTER_TYPES = new Set<VisualizationTypeId>(
  visualizationTypeIds().filter((id) =>
    isRasterPresentationTypeId(id as string),
  ) as VisualizationTypeId[],
);

const POINT_TYPES = new Set<VisualizationTypeId>([
  "SIMPLE_POINT",
  "MARKER_IMAGE",
  "CATEGORICAL_POINT",
  "PROPORTIONAL_SYMBOL",
  "CONTINUOUS_POINT",
  "HEATMAP",
]);

const POLYGON_LINE_TYPES = new Set<VisualizationTypeId>([
  "SIMPLE_POLYGON",
  "CATEGORICAL_POLYGON",
  "CONTINUOUS_POLYGON",
]);

function geometryBucket(
  geometry: string | undefined,
): "point" | "polygonLine" | "unknown" {
  if (!geometry) {
    return "unknown";
  }
  const g = geometry.toLowerCase();
  if (g.includes("point")) {
    return "point";
  }
  if (
    g.includes("polygon") ||
    g.includes("line") ||
    g === "geometrycollection"
  ) {
    return "polygonLine";
  }
  return "unknown";
}

/**
 * Keep presentation only if it matches dataset kind (raster vs vector geometry).
 */
export function filterPresentationType(
  presentation: VisualizationTypeId | null | undefined,
  opts: {
    isRaster: boolean;
    primaryGeometry?: string;
  },
): VisualizationTypeId | null {
  if (presentation == null) {
    return null;
  }
  if (opts.isRaster) {
    return RASTER_TYPES.has(presentation) ? presentation : null;
  }
  if (RASTER_TYPES.has(presentation)) {
    return null;
  }
  const bucket = geometryBucket(opts.primaryGeometry);
  if (bucket === "point") {
    return POINT_TYPES.has(presentation) ? presentation : null;
  }
  if (bucket === "polygonLine") {
    return POLYGON_LINE_TYPES.has(presentation) ? presentation : null;
  }
  if (
    POINT_TYPES.has(presentation) ||
    POLYGON_LINE_TYPES.has(presentation)
  ) {
    return presentation;
  }
  return null;
}

/**
 * Restrict column names to known attributes; drop unknowns with no fuzzy match.
 */
export function sanitizeColumnFields(
  parsed: ColumnIntelligenceResponse,
  allowedColumns: string[] | null,
): ColumnIntelligenceResponse {
  const allowed = new Set(
    (allowedColumns || []).filter((c) => c && c.length > 0),
  );
  if (allowed.size === 0) {
    return {
      ...parsed,
      best_label_column: null,
      best_category_column: null,
      best_numeric_column: null,
      best_date_column: null,
      best_popup_description_column: null,
      best_id_column: null,
      junk_columns: [],
      chosen_presentation_type: null,
      chosen_presentation_column: null,
      ai_cartographer_rationale: parsed.ai_cartographer_rationale ?? null,
      best_layer_title: clampBestLayerTitle(parsed.best_layer_title),
    };
  }
  const junk = (parsed.junk_columns || [])
    .map((j: string) => normalizeColumnName(j, allowed))
    .filter((j: string | null): j is string => j != null);
  return {
    best_label_column: normalizeColumnName(parsed.best_label_column, allowed),
    best_category_column: normalizeColumnName(
      parsed.best_category_column,
      allowed,
    ),
    best_numeric_column: normalizeColumnName(
      parsed.best_numeric_column,
      allowed,
    ),
    best_date_column: normalizeColumnName(parsed.best_date_column, allowed),
    best_popup_description_column: normalizeColumnName(
      parsed.best_popup_description_column,
      allowed,
    ),
    best_id_column: normalizeColumnName(parsed.best_id_column, allowed),
    junk_columns: [...new Set(junk)],
    chosen_presentation_type: parsed.chosen_presentation_type ?? null,
    chosen_presentation_column: normalizeColumnName(
      parsed.chosen_presentation_column,
      allowed,
    ),
    ai_cartographer_rationale: parsed.ai_cartographer_rationale ?? null,
    best_layer_title: clampBestLayerTitle(parsed.best_layer_title),
  };
}
