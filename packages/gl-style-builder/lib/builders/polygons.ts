import {
  GeostatsLayer,
  isGeostatsLayer,
  isRasterInfo,
  RasterInfo,
} from "@seasketch/geostats-types";
import { AiDataAnalystNotes } from "ai-data-analyst";
import { AnyLayer, FillLayer, LineLayer } from "mapbox-gl";
import {
  autoStrokeColorForFillColor,
  buildMatchExpressionForAttribute,
  getColorScale,
  getDefaultFillColor,
  getSingleColorFromCustomPalette,
} from "../colorScales";
import { addLabelsLayer } from "./labels";

export function buildSimplePolygonLayer(
  geostats: GeostatsLayer | RasterInfo,
  aiDataAnalystNotes?: AiDataAnalystNotes | null,
): Omit<AnyLayer, "source" | "id">[] {
  console.log("building simple polygon layer", aiDataAnalystNotes);
  const layers: Omit<AnyLayer, "source" | "id">[] = [];
  if (isRasterInfo(geostats)) {
    throw new Error("Geostats must be a GeostatsLayer");
  }
  if (geostats.geometry !== "Polygon" && geostats.geometry !== "MultiPolygon") {
    throw new Error("Geostats must be a Polygon or MultiPolygon");
  }

  const fillColor =
    getSingleColorFromCustomPalette(aiDataAnalystNotes?.custom_palette) ||
    getDefaultFillColor();

  layers.push({
    type: "fill",
    paint: {
      "fill-color": fillColor,
      "fill-opacity": 0.8,
    },
    metadata: {
      "s:type": "Simple Polygon",
    },
  } as FillLayer);
  layers.push({
    type: "line",
    layout: {
      "line-join": "round",
      "line-cap": "round",
      visibility: "visible",
    },
    paint: {
      "line-color": autoStrokeColorForFillColor(fillColor),
      "line-width": 1,
      "line-opacity": 1,
    },
    metadata: {
      "s:color-auto": true,
    },
  } as LineLayer);
  addLabelsLayer(layers, geostats, aiDataAnalystNotes);
  return layers;
}

export function buildCategoricalPolygonLayer(
  geostats: GeostatsLayer | RasterInfo,
  aiDataAnalystNotes?: AiDataAnalystNotes | null,
): Omit<AnyLayer, "source" | "id">[] {
  console.log("building categorical polygon layer", aiDataAnalystNotes);
  const layers: Omit<AnyLayer, "source" | "id">[] = [];
  if (isRasterInfo(geostats)) {
    throw new Error("Geostats must be a GeostatsLayer");
  }
  if (geostats.geometry !== "Polygon" && geostats.geometry !== "MultiPolygon") {
    throw new Error("Geostats must be a Polygon or MultiPolygon");
  }
  if (!aiDataAnalystNotes) {
    throw new Error("AiDataAnalystNotes is required");
  }
  if (!aiDataAnalystNotes?.chosen_presentation_column) {
    throw new Error("chosen_presentation_column is required");
  }

  const presentationColumn = geostats.attributes.find(
    (a) => a.attribute === aiDataAnalystNotes?.chosen_presentation_column,
  );
  if (!presentationColumn) {
    throw new Error(
      "chosen_presentation_column not found in geostats attributes",
    );
  }

  const colorScale = getColorScale(
    "categorical",
    aiDataAnalystNotes?.palette || "schemeTableau10",
    aiDataAnalystNotes?.custom_palette,
  );

  layers.push({
    type: "fill",
    paint: {
      "fill-color": buildMatchExpressionForAttribute(
        presentationColumn,
        colorScale,
        Boolean(aiDataAnalystNotes?.reverse_palette),
      ),
      "fill-opacity": 0.7,
    },
    metadata: {
      "s:type": "Categories",
      "s:palette": colorScale.name,
    },
  } as FillLayer);
  layers.push({
    type: "line",
    layout: {
      "line-join": "round",
      "line-cap": "round",
      visibility: "visible",
    },
    paint: {
      "line-color": buildMatchExpressionForAttribute(
        presentationColumn,
        colorScale,
        Boolean(aiDataAnalystNotes?.reverse_palette),
      ),
      "line-width": 1,
      "line-opacity": 1,
    },
    metadata: {
      "s:color-auto": true,
    },
  } as LineLayer);
  addLabelsLayer(layers, geostats, aiDataAnalystNotes);
  return layers;
}
