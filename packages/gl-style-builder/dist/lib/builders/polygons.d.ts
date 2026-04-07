import { GeostatsLayer, RasterInfo } from "@seasketch/geostats-types";
import { AiDataAnalystNotes } from "ai-data-analyst";
import { AnyLayer } from "mapbox-gl";
export declare function buildSimplePolygonLayer(geostats: GeostatsLayer | RasterInfo, aiDataAnalystNotes?: AiDataAnalystNotes | null): Omit<AnyLayer, "source" | "id">[];
export declare function buildCategoricalPolygonLayer(geostats: GeostatsLayer | RasterInfo, aiDataAnalystNotes?: AiDataAnalystNotes | null): Omit<AnyLayer, "source" | "id">[];
export declare function buildContinuousPolygonLayer(geostats: GeostatsLayer | RasterInfo, aiDataAnalystNotes?: AiDataAnalystNotes | null): Omit<AnyLayer, "source" | "id">[];
//# sourceMappingURL=polygons.d.ts.map