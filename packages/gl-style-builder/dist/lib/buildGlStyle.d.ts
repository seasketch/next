import type { GeostatsLayer, RasterInfo } from "@seasketch/geostats-types";
import type { AiDataAnalystNotes } from "ai-data-analyst";
export type BuildGlStyleInput = {
    geostats: GeostatsLayer | RasterInfo;
    aiDataAnalystNotes?: AiDataAnalystNotes | null;
};
/**
 * From {@link GeostatsLayer} or {@link RasterInfo}, plus optional
 * {@link AiDataAnalystNotes}, produce Mapbox GL style layers for SeaSketch.
 * (Implementation will grow alongside the graphical cartography tool.)
 */
export declare function buildGlStyle(_input: BuildGlStyleInput): unknown[];
//# sourceMappingURL=buildGlStyle.d.ts.map