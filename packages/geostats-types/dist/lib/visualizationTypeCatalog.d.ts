/**
 * Canonical visualization type ids (Postgres enum / LLM) and human labels for the style editor.
 * Imported by the API column-intelligence prompts and re-exported from the client style editor.
 */
export declare enum VisualizationType {
    RGB_RASTER = "Raster Image",
    CATEGORICAL_RASTER = "Categorical Raster",
    CONTINUOUS_RASTER = "Continuous Raster",
    SIMPLE_POLYGON = "Simple Polygon",
    CATEGORICAL_POLYGON = "Categories",
    CONTINUOUS_POLYGON = "Color Range",
    SIMPLE_POINT = "Simple Points",
    MARKER_IMAGE = "Marker Image",
    CATEGORICAL_POINT = "Categorized Points",
    PROPORTIONAL_SYMBOL = "Proportional Symbol",
    CONTINUOUS_POINT = "Point Color Range",
    HEATMAP = "Heatmap"
}
export declare const VisualizationTypeDescriptions: {
    [key: string]: string;
};
/** Enum member names matching Postgres `visualization_type` (e.g. RGB_RASTER). */
export declare function visualizationTypeIds(): (keyof typeof VisualizationType)[];
/** True if the presentation id is a raster type (name contains `RASTER`). */
export declare function isRasterPresentationTypeId(id: string): boolean;
/** Postgres `visualization_type` / LLM enum key (e.g. RGB_RASTER). */
export type VisualizationTypeId = keyof typeof VisualizationType;
//# sourceMappingURL=visualizationTypeCatalog.d.ts.map