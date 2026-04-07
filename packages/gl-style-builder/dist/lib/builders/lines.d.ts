import { GeostatsLayer, RasterInfo } from "@seasketch/geostats-types";
import { AiDataAnalystNotes } from "ai-data-analyst";
import { AnyLayer } from "mapbox-gl";
export declare function buildSimpleLineLayer(geostats: GeostatsLayer | RasterInfo, aiDataAnalystNotes?: AiDataAnalystNotes | null): Omit<AnyLayer, "source" | "id">[];
export declare function buildCategoricalLineLayer(geostats: GeostatsLayer | RasterInfo, aiDataAnalystNotes?: AiDataAnalystNotes | null): Omit<AnyLayer, "source" | "id">[];
export declare function buildContinuousLineLayer(geostats: GeostatsLayer | RasterInfo, aiDataAnalystNotes?: AiDataAnalystNotes | null): Omit<AnyLayer, "source" | "id">[];
//# sourceMappingURL=lines.d.ts.map