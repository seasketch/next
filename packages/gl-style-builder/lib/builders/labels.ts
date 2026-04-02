import {
  GeostatsLayer,
  isRasterInfo,
  RasterInfo,
} from "@seasketch/geostats-types";
import { AiDataAnalystNotes } from "ai-data-analyst";
import { AnyLayer, SymbolLayer } from "mapbox-gl";

export function addLabelsLayer(
  layers: Omit<AnyLayer, "source" | "id">[],
  geostats: GeostatsLayer | RasterInfo,
  aiDataAnalystNotes?: AiDataAnalystNotes | null,
) {
  if (isRasterInfo(geostats)) {
    throw new Error("Labels not supported for raster layers");
  }
  if (
    !aiDataAnalystNotes?.best_label_column ||
    !aiDataAnalystNotes?.show_labels
  ) {
    return;
  }
  layers.push({
    type: "symbol",
    layout: {
      "text-field": ["get", aiDataAnalystNotes.best_label_column],
      "text-size": 13,
      ...(geostats.geometry === "Point" || geostats.geometry === "MultiPoint"
        ? {
            visibility: "visible",
            "text-anchor": "left",
            "text-offset": [0.5, 0.5],
            "symbol-placement": "point",
          }
        : {}),
    },
    paint: {
      "text-color": "#000000",
      "text-halo-color": "rgba(255, 255, 255, 0.9)",
      "text-halo-width": 1.3,
    },
    minzoom: aiDataAnalystNotes.labels_min_zoom || 12,
  } as Omit<SymbolLayer, "source" | "id">);
}
