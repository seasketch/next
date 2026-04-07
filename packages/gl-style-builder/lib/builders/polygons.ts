import {
  GeostatsLayer,
  isGeostatsLayer,
  isRasterInfo,
  NumericGeostatsAttribute,
  RasterInfo,
} from "@seasketch/geostats-types";
import { AiDataAnalystNotes } from "ai-data-analyst";
import { AnyLayer, FillLayer, LineLayer } from "mapbox-gl";
import {
  autoStrokeColorForFillColor,
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

export function buildSimplePolygonLayer(
  geostats: GeostatsLayer | RasterInfo,
  aiDataAnalystNotes?: AiDataAnalystNotes | null,
): Omit<AnyLayer, "source" | "id">[] {
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
  const layers: Omit<AnyLayer, "source" | "id">[] = [];
  if (isRasterInfo(geostats)) {
    throw new Error("Geostats must be a GeostatsLayer");
  }
  if (geostats.geometry !== "Polygon" && geostats.geometry !== "MultiPolygon") {
    throw new Error("Geostats must be a Polygon or MultiPolygon");
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

  const fillLayer = {
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
    },
  } as FillLayer;
  setPaletteMetadata(fillLayer, colorScale);
  layers.push(fillLayer);
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
  if (aiDataAnalystNotes) {
    addLabelsLayer(layers, geostats, aiDataAnalystNotes);
  }
  return layers;
}

export function buildContinuousPolygonLayer(
  geostats: GeostatsLayer | RasterInfo,
  aiDataAnalystNotes?: AiDataAnalystNotes | null,
): Omit<AnyLayer, "source" | "id">[] {
  const layers: Omit<AnyLayer, "source" | "id">[] = [];
  if (isRasterInfo(geostats)) {
    throw new Error("Geostats must be a GeostatsLayer");
  }
  if (geostats.geometry !== "Polygon" && geostats.geometry !== "MultiPolygon") {
    throw new Error("Geostats must be a Polygon or MultiPolygon");
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

  const fillLayer = {
    type: "fill",
    paint: {
      "fill-color": buildContinuousColorExpression(
        colorScale,
        Boolean(aiDataAnalystNotes?.reverse_palette),
        [presentationColumn.min || 0, presentationColumn.max!],
        ["get", presentationColumn.attribute],
      ),
      "fill-opacity": 0.8,
    },
    layout: {
      visibility: "visible",
    },
  } as FillLayer;

  setPaletteMetadata(fillLayer, colorScale);
  layers.push(fillLayer);

  if (aiDataAnalystNotes) {
    addLabelsLayer(layers, geostats, aiDataAnalystNotes);
  }
  return layers;
}
