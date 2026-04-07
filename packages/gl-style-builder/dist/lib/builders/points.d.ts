import { GeostatsLayer, RasterInfo } from "@seasketch/geostats-types";
import { AiDataAnalystNotes } from "ai-data-analyst";
import { AnyLayer } from "mapbox-gl";
export declare function buildSimplePointLayer(geostats: GeostatsLayer | RasterInfo, aiDataAnalystNotes?: AiDataAnalystNotes | null): Omit<AnyLayer, "source" | "id">[];
/**
 * @deprecated AiDataAnalystNotes don't have a means of specifying
 * (or generating) standard mapbox marker images yet, so this isn't very useful.
 * Falls back to simple point layer. Maybe something for the future.
 */
export declare function buildMarkerImageLayer(geostats: GeostatsLayer | RasterInfo, aiDataAnalystNotes?: AiDataAnalystNotes | null): Omit<AnyLayer, "source" | "id">[];
export declare function buildCategoricalPointLayer(geostats: GeostatsLayer | RasterInfo, aiDataAnalystNotes?: AiDataAnalystNotes | null): Omit<AnyLayer, "source" | "id">[];
export declare function buildContinuousPointLayer(geostats: GeostatsLayer | RasterInfo, aiDataAnalystNotes?: AiDataAnalystNotes | null): Omit<AnyLayer, "source" | "id">[];
export declare function buildProportionalSymbolLayer(geostats: GeostatsLayer | RasterInfo, aiDataAnalystNotes?: AiDataAnalystNotes | null): Omit<AnyLayer, "source" | "id">[];
export declare function buildHeatmapLayer(geostats: GeostatsLayer | RasterInfo, aiDataAnalystNotes?: AiDataAnalystNotes | null): Omit<AnyLayer, "source" | "id">[];
//# sourceMappingURL=points.d.ts.map