import {
  GeostatsLayer,
  isNumericGeostatsAttribute,
  isRasterInfo,
  NumericGeostatsAttribute,
  RasterInfo,
} from "@seasketch/geostats-types";
import { AiDataAnalystNotes } from "ai-data-analyst";
import { colord } from "colord";
import { AnyLayer, CircleLayer, Expression, HeatmapLayer } from "mapbox-gl";
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

export function buildSimplePointLayer(
  geostats: GeostatsLayer | RasterInfo,
  aiDataAnalystNotes?: AiDataAnalystNotes | null,
): Omit<AnyLayer, "source" | "id">[] {
  const layers: Omit<AnyLayer, "source" | "id">[] = [];
  if (isRasterInfo(geostats)) {
    throw new Error("Geostats must be a GeostatsLayer");
  }
  if (geostats.geometry !== "Point" && geostats.geometry !== "MultiPoint") {
    throw new Error("Geostats must be a Point or MultiPoint");
  }

  const circleColor =
    getSingleColorFromCustomPalette(aiDataAnalystNotes?.custom_palette) ||
    getDefaultFillColor();

  layers.push({
    type: "circle",
    paint: {
      "circle-radius": 4,
      "circle-color": circleColor,
      "circle-stroke-color": autoStrokeColorForFillColor(circleColor),
      "circle-stroke-width": 2,
      "circle-stroke-opacity": 0.8,
    },
    metadata: {
      "s:type": "Simple Point",
      "s:color-auto": true,
    },
  } as CircleLayer);
  addLabelsLayer(layers, geostats, aiDataAnalystNotes);
  return layers;
}

/**
 * @deprecated AiDataAnalystNotes don't have a means of specifying
 * (or generating) standard mapbox marker images yet, so this isn't very useful.
 * Falls back to simple point layer. Maybe something for the future.
 */
export function buildMarkerImageLayer(
  geostats: GeostatsLayer | RasterInfo,
  aiDataAnalystNotes?: AiDataAnalystNotes | null,
): Omit<AnyLayer, "source" | "id">[] {
  const layers: Omit<AnyLayer, "source" | "id">[] = [];
  if (isRasterInfo(geostats)) {
    throw new Error("Geostats must be a GeostatsLayer");
  }
  if (geostats.geometry !== "Point" && geostats.geometry !== "MultiPoint") {
    throw new Error("Geostats must be a Point or MultiPoint");
  }
  console.warn(
    "Marker image layer building is not supported yet. Falling back to simple point layer.",
  );
  return buildSimplePointLayer(geostats, aiDataAnalystNotes);
}

export function buildCategoricalPointLayer(
  geostats: GeostatsLayer | RasterInfo,
  aiDataAnalystNotes?: AiDataAnalystNotes | null,
): Omit<AnyLayer, "source" | "id">[] {
  const layers: Omit<AnyLayer, "source" | "id">[] = [];
  if (isRasterInfo(geostats)) {
    throw new Error("Geostats must be a GeostatsLayer");
  }
  if (geostats.geometry !== "Point" && geostats.geometry !== "MultiPoint") {
    throw new Error("Geostats must be a Point or MultiPoint");
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

  const categoryColor = buildMatchExpressionForAttribute(
    presentationColumn,
    colorScale,
    Boolean(aiDataAnalystNotes?.reverse_palette),
  );

  const circleLayer = {
    type: "circle",
    paint: {
      "circle-radius": 4,
      "circle-color": categoryColor,
      "circle-stroke-color": categoryColor,
      "circle-opacity": 0.5,
      "circle-stroke-width": 1,
      "circle-stroke-opacity": 1,
    },
    metadata: {
      "s:type": "Categorized Points",
    },
  } as CircleLayer;
  setPaletteMetadata(circleLayer, colorScale);
  layers.push(circleLayer);
  if (aiDataAnalystNotes) {
    addLabelsLayer(layers, geostats, aiDataAnalystNotes);
  }
  return layers;
}

export function buildContinuousPointLayer(
  geostats: GeostatsLayer | RasterInfo,
  aiDataAnalystNotes?: AiDataAnalystNotes | null,
): Omit<AnyLayer, "source" | "id">[] {
  const layers: Omit<AnyLayer, "source" | "id">[] = [];
  if (isRasterInfo(geostats)) {
    throw new Error("Geostats must be a GeostatsLayer");
  }
  if (geostats.geometry !== "Point" && geostats.geometry !== "MultiPoint") {
    throw new Error("Geostats must be a Point or MultiPoint");
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

  const rampColor = buildContinuousColorExpression(
    colorScale,
    Boolean(aiDataAnalystNotes?.reverse_palette),
    [presentationColumn.min || 0, presentationColumn.max!],
    ["get", presentationColumn.attribute],
  );

  const circleLayer = {
    type: "circle",
    paint: {
      "circle-radius": 4,
      "circle-color": rampColor,
      "circle-opacity": 0.8,
      "circle-stroke-color": rampColor,
      "circle-stroke-width": 2,
      "circle-stroke-opacity": 0.8,
    },
    layout: {
      visibility: "visible",
      "circle-sort-key": ["get", presentationColumn.attribute],
    },
  } as Omit<CircleLayer, "id" | "source">;

  setPaletteMetadata(circleLayer, colorScale);
  layers.push(circleLayer);

  if (aiDataAnalystNotes) {
    addLabelsLayer(layers, geostats, aiDataAnalystNotes);
  }
  return layers;
}

/** Min / max circle radius (px) for proportional symbols — matches style editor defaults. */
const PROPORTIONAL_RADIUS_MIN_PX = 5;
const PROPORTIONAL_RADIUS_MAX_PX = 50;

export function buildProportionalSymbolLayer(
  geostats: GeostatsLayer | RasterInfo,
  aiDataAnalystNotes?: AiDataAnalystNotes | null,
): Omit<AnyLayer, "source" | "id">[] {
  const layers: Omit<AnyLayer, "source" | "id">[] = [];
  if (isRasterInfo(geostats)) {
    throw new Error("Geostats must be a GeostatsLayer");
  }
  if (geostats.geometry !== "Point" && geostats.geometry !== "MultiPoint") {
    throw new Error("Geostats must be a Point or MultiPoint");
  }

  let sizeColumn: NumericGeostatsAttribute | undefined;

  if (aiDataAnalystNotes?.chosen_presentation_column) {
    const attr = geostats.attributes.find(
      (a) => a.attribute === aiDataAnalystNotes.chosen_presentation_column,
    );
    if (attr && isNumericGeostatsAttribute(attr)) {
      sizeColumn = attr;
    }
  }

  if (!sizeColumn) {
    const name = findBestContinuousAttribute(geostats);
    if (name) {
      sizeColumn = geostats.attributes.find(
        (a) => a.attribute === name,
      ) as NumericGeostatsAttribute;
    }
  }

  if (!sizeColumn) {
    throw new Error("No continuous attribute found");
  }

  const circleColor =
    getSingleColorFromCustomPalette(aiDataAnalystNotes?.custom_palette) ||
    getDefaultFillColor();

  const rawMin = sizeColumn.min ?? 0;
  const rawMax =
    sizeColumn.max !== undefined && sizeColumn.max !== null
      ? sizeColumn.max
      : rawMin;
  const domainLow = Math.min(rawMin, rawMax);
  const domainHigh = Math.max(rawMin, rawMax);

  const circleRadius: number | Expression =
    domainLow === domainHigh
      ? PROPORTIONAL_RADIUS_MIN_PX
      : ([
          "interpolate",
          ["linear"],
          ["get", sizeColumn.attribute],
          domainLow,
          PROPORTIONAL_RADIUS_MIN_PX,
          domainHigh,
          PROPORTIONAL_RADIUS_MAX_PX,
        ] as Expression);

  const circleLayer = {
    type: "circle",
    paint: {
      "circle-color": circleColor,
      "circle-radius": circleRadius,
      "circle-stroke-width": 1,
      "circle-stroke-color": autoStrokeColorForFillColor(circleColor),
      "circle-stroke-opacity": 1,
      "circle-opacity": 0.8,
    },
    layout: {
      visibility: "visible",
      "circle-sort-key": ["get", sizeColumn.attribute],
    },
    metadata: {
      "s:type": "Proportional Symbol",
      "s:color-auto": true,
    },
  } as Omit<CircleLayer, "id" | "source">;

  layers.push(circleLayer);
  if (aiDataAnalystNotes) {
    addLabelsLayer(layers, geostats, aiDataAnalystNotes);
  }
  return layers;
}

export function buildHeatmapLayer(
  geostats: GeostatsLayer | RasterInfo,
  aiDataAnalystNotes?: AiDataAnalystNotes | null,
): Omit<AnyLayer, "source" | "id">[] {
  const layers: Omit<AnyLayer, "source" | "id">[] = [];
  if (isRasterInfo(geostats)) {
    throw new Error("Geostats must be a GeostatsLayer");
  }
  if (geostats.geometry !== "Point" && geostats.geometry !== "MultiPoint") {
    throw new Error("Geostats must be a Point or MultiPoint");
  }

  const colorScale = getColorScale(
    "continuous",
    aiDataAnalystNotes?.palette || "interpolateTurbo",
  );

  const heatmapColor = [
    ...buildContinuousColorExpression(
      colorScale,
      Boolean(aiDataAnalystNotes?.reverse_palette),
      [0, 1],
      ["heatmap-density"],
    ),
  ] as Expression;

  const lowEndColor = heatmapColor[4];
  if (typeof lowEndColor === "string") {
    heatmapColor[4] = colord(lowEndColor).alpha(0).toRgbString();
  }

  const heatmapLayer = {
    type: "heatmap",
    paint: {
      "heatmap-radius": 10,
      "heatmap-weight": 1,
      "heatmap-intensity": 0.5,
      "heatmap-opacity": 0.9,
      "heatmap-color": heatmapColor,
    },
    metadata: {
      "s:type": "Heatmap",
    },
  } as Omit<HeatmapLayer, "source" | "id">;

  setPaletteMetadata(heatmapLayer, colorScale);
  layers.push(heatmapLayer);
  return layers;
}
