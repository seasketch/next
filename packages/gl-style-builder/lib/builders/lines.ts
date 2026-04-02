import {
  GeostatsLayer,
  isGeostatsLayer,
  isRasterInfo,
  NumericGeostatsAttribute,
  RasterInfo,
} from "@seasketch/geostats-types";
import { AiDataAnalystNotes } from "ai-data-analyst";
import { AnyLayer, LineLayer } from "mapbox-gl";
import {
  buildContinuousColorExpression,
  buildMatchExpressionForAttribute,
  getColorScale,
  getDefaultFillColor,
  getSingleColorFromCustomPalette,
  setPaletteMetadata,
} from "../colorScales";
import { addLabelsLayer } from "./labels";
import {
  findBestCategoricalAttribute,
  findBestContinuousAttribute,
} from "../columnPickers";

export function buildSimpleLineLayer(
  geostats: GeostatsLayer | RasterInfo,
  aiDataAnalystNotes?: AiDataAnalystNotes | null,
): Omit<AnyLayer, "source" | "id">[] {
  const layers: Omit<AnyLayer, "source" | "id">[] = [];
  if (isRasterInfo(geostats)) {
    throw new Error("Geostats must be a GeostatsLayer");
  }
  if (
    geostats.geometry !== "LineString" &&
    geostats.geometry !== "MultiLineString"
  ) {
    throw new Error("Geostats must be a LineString or MultiLineString");
  }

  const lineColor =
    getSingleColorFromCustomPalette(aiDataAnalystNotes?.custom_palette) ||
    getDefaultFillColor();

  layers.push({
    type: "line",
    layout: {
      "line-join": "round",
      "line-cap": "round",
      visibility: "visible",
    },
    paint: {
      "line-color": lineColor,
      "line-width": 2,
      "line-opacity": 1,
    },
    metadata: {
      "s:type": "Simple Line",
    },
  } as LineLayer);
  addLabelsLayer(layers, geostats, aiDataAnalystNotes);
  return layers;
}

export function buildCategoricalLineLayer(
  geostats: GeostatsLayer | RasterInfo,
  aiDataAnalystNotes?: AiDataAnalystNotes | null,
): Omit<AnyLayer, "source" | "id">[] {
  const layers: Omit<AnyLayer, "source" | "id">[] = [];
  if (isRasterInfo(geostats)) {
    throw new Error("Geostats must be a GeostatsLayer");
  }
  if (
    geostats.geometry !== "LineString" &&
    geostats.geometry !== "MultiLineString"
  ) {
    throw new Error("Geostats must be a LineString or MultiLineString");
  }

  const presentationColumn = aiDataAnalystNotes?.chosen_presentation_column
    ? geostats.attributes.find(
        (a) => a.attribute === aiDataAnalystNotes?.chosen_presentation_column,
      )
    : findBestCategoricalAttribute(geostats);

  if (!presentationColumn) {
    throw new Error("No categorical attribute found");
  }

  const colorScale = getColorScale(
    "categorical",
    aiDataAnalystNotes?.palette || "schemeTableau10",
    aiDataAnalystNotes?.custom_palette,
  );

  const lineLayer = {
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
      "line-width": 2,
      "line-opacity": 1,
    },
    metadata: {
      "s:type": "Categorized Lines",
    },
  } as LineLayer;
  setPaletteMetadata(lineLayer, colorScale);
  layers.push(lineLayer);
  if (aiDataAnalystNotes) {
    addLabelsLayer(layers, geostats, aiDataAnalystNotes);
  }
  return layers;
}

export function buildContinuousLineLayer(
  geostats: GeostatsLayer | RasterInfo,
  aiDataAnalystNotes?: AiDataAnalystNotes | null,
): Omit<AnyLayer, "source" | "id">[] {
  const layers: Omit<AnyLayer, "source" | "id">[] = [];
  if (isRasterInfo(geostats)) {
    throw new Error("Geostats must be a GeostatsLayer");
  }
  if (
    geostats.geometry !== "LineString" &&
    geostats.geometry !== "MultiLineString"
  ) {
    throw new Error("Geostats must be a LineString or MultiLineString");
  }

  let presentationColumn: NumericGeostatsAttribute | undefined;

  if (aiDataAnalystNotes?.chosen_presentation_column) {
    presentationColumn = geostats.attributes.find(
      (a) => a.attribute === aiDataAnalystNotes?.chosen_presentation_column,
    ) as NumericGeostatsAttribute;
  }

  if (!presentationColumn) {
    const attr = findBestContinuousAttribute(geostats);
    if (attr) {
      presentationColumn = geostats.attributes.find(
        (a) => a.attribute === attr,
      ) as NumericGeostatsAttribute;
    }
  }

  if (!presentationColumn) {
    throw new Error("No continuous attribute found");
  }

  const colorScale = getColorScale(
    "continuous",
    aiDataAnalystNotes?.palette || "interpolatePlasma",
  );

  const lineLayer = {
    type: "line",
    paint: {
      "line-color": buildContinuousColorExpression(
        colorScale,
        Boolean(aiDataAnalystNotes?.reverse_palette),
        [presentationColumn.min || 0, presentationColumn.max!],
        ["get", presentationColumn.attribute],
      ),
      "line-width": 2,
      "line-opacity": 1,
    },
    layout: {
      visibility: "visible",
    },
  } as LineLayer;

  setPaletteMetadata(lineLayer, colorScale);
  layers.push(lineLayer);

  if (aiDataAnalystNotes) {
    addLabelsLayer(layers, geostats, aiDataAnalystNotes);
  }
  return layers;
}
