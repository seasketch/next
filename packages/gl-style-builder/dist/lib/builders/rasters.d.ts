import { type GeostatsLayer, type RasterInfo } from "@seasketch/geostats-types";
import { type AiDataAnalystNotes } from "ai-data-analyst";
import type { RasterLayer } from "mapbox-gl";
export declare function buildRGBRasterLayer(geostats: GeostatsLayer | RasterInfo, aiDataAnalystNotes?: AiDataAnalystNotes | null): Omit<RasterLayer, "source" | "id">[];
export declare function buildContinuousRasterLayer(geostats: GeostatsLayer | RasterInfo, aiDataAnalystNotes?: AiDataAnalystNotes | null): Omit<RasterLayer, "source" | "id">[];
export declare function buildCategoricalRasterLayer(geostats: GeostatsLayer | RasterInfo, aiDataAnalystNotes?: AiDataAnalystNotes | null): Omit<RasterLayer, "source" | "id">[];
//# sourceMappingURL=rasters.d.ts.map