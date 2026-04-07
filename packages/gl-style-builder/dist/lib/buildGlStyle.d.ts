import { type GeostatsLayer, type RasterInfo } from "@seasketch/geostats-types";
import type { AiDataAnalystNotes } from "ai-data-analyst";
import { AnyLayer } from "mapbox-gl";
export type BuildGlStyleInput = {
    geostats: GeostatsLayer | RasterInfo;
    aiDataAnalystNotes?: AiDataAnalystNotes | null;
};
/**
 * Given layer geostats and optionally ai cartographer notes, produce a set of
 * Mapbox GL style layers for this data source. These layers include
 * SeaSketch-specific metadata where appropriate to drive GUIStyleEditor and
 * legend functionality.
 */
export declare function buildGlStyle({ geostats, aiDataAnalystNotes, }: BuildGlStyleInput): Omit<AnyLayer, "source" | "id">[];
//# sourceMappingURL=buildGlStyle.d.ts.map