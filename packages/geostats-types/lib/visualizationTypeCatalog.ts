/**
 * Canonical visualization type ids (Postgres enum / LLM) and human labels for the style editor.
 * Imported by the API column-intelligence prompts and re-exported from the client style editor.
 */

export enum VisualizationType {
  // Raster
  RGB_RASTER = "Raster Image",
  CATEGORICAL_RASTER = "Categorical Raster",
  CONTINUOUS_RASTER = "Continuous Raster",
  // Vector
  // Polygon or MultiPolygon
  SIMPLE_POLYGON = "Simple Polygon",
  CATEGORICAL_POLYGON = "Categories",
  CONTINUOUS_POLYGON = "Color Range",
  // Point or MultiPoint
  SIMPLE_POINT = "Simple Points",
  MARKER_IMAGE = "Marker Image",
  CATEGORICAL_POINT = "Categorized Points",
  PROPORTIONAL_SYMBOL = "Proportional Symbol",
  CONTINUOUS_POINT = "Point Color Range",
  HEATMAP = "Heatmap",
}

export const VisualizationTypeDescriptions: { [key: string]: string } = {
  [VisualizationType.CATEGORICAL_RASTER]:
    "Discrete pixel values rendered as unique colors",
  [VisualizationType.CONTINUOUS_RASTER]:
    "Range of colors based on numeric values",
  [VisualizationType.RGB_RASTER]: "RGB pixels are displayed as uploaded",
  [VisualizationType.SIMPLE_POLYGON]: "Style features with a single color",
  [VisualizationType.CONTINUOUS_POLYGON]:
    "Choropleth maps based on continuous values",
  [VisualizationType.CATEGORICAL_POLYGON]:
    "Group polygons by discrete string values",
  [VisualizationType.SIMPLE_POINT]: "Circle markers indicating point locations",
  [VisualizationType.MARKER_IMAGE]: "Locations indicated by symbols",
  [VisualizationType.CATEGORICAL_POINT]: "Circles with unique colors",
  [VisualizationType.PROPORTIONAL_SYMBOL]: "Circle size determined by values",
  [VisualizationType.HEATMAP]: "Visualize densely packed locations",
  [VisualizationType.CONTINUOUS_POINT]: "Color range based on numeric values",
};

/** Enum member names matching Postgres `visualization_type` (e.g. RGB_RASTER). */
export function visualizationTypeIds(): (keyof typeof VisualizationType)[] {
  return (Object.keys(VisualizationType) as (keyof typeof VisualizationType)[]).filter(
    (k) => typeof VisualizationType[k] === "string",
  );
}

/** True if the presentation id is a raster type (name contains `RASTER`). */
export function isRasterPresentationTypeId(id: string): boolean {
  return /RASTER/i.test(id);
}

/** Postgres `visualization_type` / LLM enum key (e.g. RGB_RASTER). */
export type VisualizationTypeId = keyof typeof VisualizationType;
