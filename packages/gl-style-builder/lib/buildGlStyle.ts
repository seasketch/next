import type { GeostatsLayer, RasterInfo } from "@seasketch/geostats-types";
import type { AiDataAnalystNotes } from "ai-data-analyst";
import { VisualizationType } from "./visualizationTypes";
import { AnyLayer } from "mapbox-gl";

export type BuildGlStyleInput = {
  geostats: GeostatsLayer | RasterInfo;
  aiDataAnalystNotes?: AiDataAnalystNotes | null;
  targetVisualizationType?: VisualizationType;
};

/**
 * From {@link GeostatsLayer} or {@link RasterInfo}, plus optional
 * {@link AiDataAnalystNotes}, produce Mapbox GL style layers for SeaSketch.
 * (Implementation will grow alongside the graphical cartography tool.)
 */
export function buildGlStyle(_input: BuildGlStyleInput): AnyLayer[] {
  return [];
}
