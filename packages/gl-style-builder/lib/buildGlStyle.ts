import {
  isGeostatsLayer,
  isRasterInfo,
  SuggestedRasterPresentation,
  type GeostatsLayer,
  type RasterInfo,
} from "@seasketch/geostats-types";
import type { AiDataAnalystNotes } from "ai-data-analyst";
import { VisualizationType } from "./visualizationTypes";
import { AnyLayer } from "mapbox-gl";
import {
  buildCategoricalRasterLayer,
  // buildCategoricalRasterLayer,
  buildContinuousRasterLayer,
  buildRGBRasterLayer,
} from "./builders/rasters";
import {
  buildCategoricalLineLayer,
  buildContinuousLineLayer,
  buildSimpleLineLayer,
} from "./builders/lines";
import {
  buildCategoricalPolygonLayer,
  buildContinuousPolygonLayer,
  buildSimplePolygonLayer,
} from "./builders/polygons";
import {
  buildCategoricalPointLayer,
  buildContinuousPointLayer,
  buildHeatmapLayer,
  buildMarkerImageLayer,
  buildProportionalSymbolLayer,
  buildSimplePointLayer,
} from "./builders/points";

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
export function buildGlStyle({
  geostats,
  aiDataAnalystNotes,
}: BuildGlStyleInput): Omit<AnyLayer, "source" | "id">[] {
  let targetVisualizationType =
    aiDataAnalystNotes?.chosen_presentation_type &&
    isValidVisualizationType(
      geostats,
      aiDataAnalystNotes?.chosen_presentation_type,
    ).isValid
      ? VisualizationType[aiDataAnalystNotes.chosen_presentation_type]
      : defaultVisualizationTypeForGeostats(geostats);

  if (!targetVisualizationType) {
    throw new Error("Invalid visualization type");
  }

  switch (targetVisualizationType) {
    case VisualizationType.RGB_RASTER:
      return buildRGBRasterLayer(geostats, aiDataAnalystNotes);
    case VisualizationType.CONTINUOUS_RASTER:
      return buildContinuousRasterLayer(geostats, aiDataAnalystNotes);
    case VisualizationType.CATEGORICAL_RASTER:
      return buildCategoricalRasterLayer(geostats, aiDataAnalystNotes);
    case VisualizationType.SIMPLE_POLYGON:
      return buildSimplePolygonLayer(geostats, aiDataAnalystNotes);
    case VisualizationType.CATEGORICAL_POLYGON:
      return buildCategoricalPolygonLayer(geostats, aiDataAnalystNotes);
    case VisualizationType.CONTINUOUS_POLYGON:
      return buildContinuousPolygonLayer(geostats, aiDataAnalystNotes);
    case VisualizationType.SIMPLE_LINE:
      return buildSimpleLineLayer(geostats, aiDataAnalystNotes);
    case VisualizationType.CATEGORICAL_LINE:
      return buildCategoricalLineLayer(geostats, aiDataAnalystNotes);
    case VisualizationType.CONTINUOUS_LINE:
      return buildContinuousLineLayer(geostats, aiDataAnalystNotes);
    case VisualizationType.SIMPLE_POINT:
      return buildSimplePointLayer(geostats, aiDataAnalystNotes);
    case VisualizationType.MARKER_IMAGE:
      return buildMarkerImageLayer(geostats, aiDataAnalystNotes);
    case VisualizationType.CATEGORICAL_POINT:
      return buildCategoricalPointLayer(geostats, aiDataAnalystNotes);
    case VisualizationType.PROPORTIONAL_SYMBOL:
      return buildProportionalSymbolLayer(geostats, aiDataAnalystNotes);
    case VisualizationType.CONTINUOUS_POINT:
      return buildContinuousPointLayer(geostats, aiDataAnalystNotes);
    case VisualizationType.HEATMAP:
      return buildHeatmapLayer(geostats, aiDataAnalystNotes);
    default:
      throw new Error(
        `Unsupported visualization type: ${targetVisualizationType}`,
      );
  }

  return [];
}

function defaultVisualizationTypeForGeostats(
  geostats: GeostatsLayer | RasterInfo,
): VisualizationType {
  if (isRasterInfo(geostats)) {
    if (geostats.presentation === SuggestedRasterPresentation.rgb) {
      return VisualizationType.RGB_RASTER;
    } else if (
      geostats.presentation === SuggestedRasterPresentation.categorical
    ) {
      return VisualizationType.CATEGORICAL_RASTER;
    } else if (
      geostats.presentation === SuggestedRasterPresentation.continuous
    ) {
      return VisualizationType.CONTINUOUS_RASTER;
    }
  } else if (isGeostatsLayer(geostats)) {
    if (geostats.geometry === "Polygon") {
      return VisualizationType.SIMPLE_POLYGON;
    } else if (geostats.geometry === "MultiPolygon") {
      return VisualizationType.SIMPLE_POLYGON;
    } else if (geostats.geometry === "Point") {
      return VisualizationType.SIMPLE_POINT;
    } else if (geostats.geometry === "MultiPoint") {
      return VisualizationType.SIMPLE_POINT;
    } else if (
      geostats.geometry === "LineString" ||
      geostats.geometry === "MultiLineString"
    ) {
      return VisualizationType.SIMPLE_LINE;
    }
  }
  return VisualizationType.SIMPLE_POLYGON;
}

function isValidVisualizationType(
  geostats: GeostatsLayer | RasterInfo,
  visualizationType?: VisualizationType | string | undefined,
): { isValid: boolean; errorMessage?: string } {
  if (!visualizationType) {
    return { isValid: false, errorMessage: "No visualization type specified" };
  }
  if (isRasterInfo(geostats)) {
    const band1 = geostats.bands[0];
    if (visualizationType === VisualizationType.RGB_RASTER) {
      if (geostats.bands.length < 3) {
        return { isValid: false, errorMessage: "RGB raster must have 3 bands" };
      }
      if (geostats.presentation !== SuggestedRasterPresentation.rgb) {
        return { isValid: false, errorMessage: "Raster must be RGB" };
      }
    } else if (visualizationType === VisualizationType.CATEGORICAL_RASTER) {
      if (!band1) {
        return {
          isValid: false,
          errorMessage: "Categorical raster must have at least one band",
        };
      }
      if (
        geostats.byteEncoding ||
        geostats.presentation === SuggestedRasterPresentation.categorical
      ) {
        return { isValid: true };
      }
      return {
        isValid: false,
        errorMessage: "Raster does not support categorical visualization",
      };
    } else if (visualizationType === VisualizationType.CONTINUOUS_RASTER) {
      if (geostats.bands.length < 1) {
        return {
          isValid: false,
          errorMessage: "Continuous raster must have at least one band",
        };
      }
      if (geostats.presentation !== SuggestedRasterPresentation.continuous) {
        return {
          isValid: false,
          errorMessage: "Raster does not support continuous presentation",
        };
      }
    } else {
      return {
        isValid: false,
        errorMessage: "Invalid visualization type for raster",
      };
    }
  } else {
    const hasCategoricalAttribute = geostats.attributes.some(
      (attribute) => Object.keys(attribute.values).length > 0,
    );
    const hasContinuousAttribute = geostats.attributes.some(
      (attribute) => attribute.type === "number",
    );
    switch (visualizationType) {
      // make sure rasters aren't styled as vectors
      case VisualizationType.CATEGORICAL_RASTER:
      case VisualizationType.CONTINUOUS_RASTER:
      case VisualizationType.RGB_RASTER:
        return {
          isValid: false,
          errorMessage: "Invalid visualization type for vector source",
        };
      // Simple vector types
      case VisualizationType.SIMPLE_POLYGON:
        if (
          geostats.geometry !== "Polygon" &&
          geostats.geometry !== "MultiPolygon"
        ) {
          return {
            isValid: false,
            errorMessage: "Invalid visualization type for polygon source",
          };
        }
        return { isValid: true };
      case VisualizationType.SIMPLE_LINE:
        if (
          geostats.geometry !== "LineString" &&
          geostats.geometry !== "MultiLineString"
        ) {
          return {
            isValid: false,
            errorMessage: "Invalid visualization type for line source",
          };
        }
        return { isValid: true };
      case VisualizationType.SIMPLE_POINT:
      case VisualizationType.MARKER_IMAGE:
      case VisualizationType.HEATMAP:
        if (
          geostats.geometry !== "Point" &&
          geostats.geometry !== "MultiPoint"
        ) {
          return {
            isValid: false,
            errorMessage: `${visualizationType} must be a point source`,
          };
        }
        return { isValid: true };
      // now, check categorical vector types
      case VisualizationType.CATEGORICAL_POLYGON:
        if (
          geostats.geometry !== "Polygon" &&
          geostats.geometry !== "MultiPolygon"
        ) {
          return {
            isValid: false,
            errorMessage:
              "Invalid visualization type for categorical polygon source",
          };
        }
        if (!hasCategoricalAttribute) {
          return {
            isValid: false,
            errorMessage: "Source has no categorical attributes",
          };
        }
        return { isValid: true };
      case VisualizationType.CATEGORICAL_LINE:
        if (
          geostats.geometry !== "LineString" &&
          geostats.geometry !== "MultiLineString"
        ) {
          return {
            isValid: false,
            errorMessage:
              "Invalid visualization type for categorical line source",
          };
        }
        if (!hasCategoricalAttribute) {
          return {
            isValid: false,
            errorMessage: "Source has no categorical attributes",
          };
        }
        return { isValid: true };
      case VisualizationType.CATEGORICAL_POINT:
        if (
          geostats.geometry !== "Point" &&
          geostats.geometry !== "MultiPoint"
        ) {
          return {
            isValid: false,
            errorMessage:
              "Invalid visualization type for categorical point source",
          };
        }
        if (!hasCategoricalAttribute) {
          return {
            isValid: false,
            errorMessage: "Source has no categorical attributes",
          };
        }
        return { isValid: true };
      // now, check continuous vector types
      case VisualizationType.CONTINUOUS_POLYGON:
        if (
          geostats.geometry !== "Polygon" &&
          geostats.geometry !== "MultiPolygon"
        ) {
          return {
            isValid: false,
            errorMessage:
              "Invalid visualization type for continuous polygon source",
          };
        }
        if (!hasContinuousAttribute) {
          return {
            isValid: false,
            errorMessage: "Source has no continuous attributes",
          };
        }
        return { isValid: true };
      case VisualizationType.CONTINUOUS_LINE:
        if (
          geostats.geometry !== "LineString" &&
          geostats.geometry !== "MultiLineString"
        ) {
          return {
            isValid: false,
            errorMessage:
              "Invalid visualization type for continuous line source",
          };
        }
        if (!hasContinuousAttribute) {
          return {
            isValid: false,
            errorMessage: "Source has no continuous attributes",
          };
        }
        return { isValid: true };
      case VisualizationType.CONTINUOUS_POINT:
        if (
          geostats.geometry !== "Point" &&
          geostats.geometry !== "MultiPoint"
        ) {
          return {
            isValid: false,
            errorMessage:
              "Invalid visualization type for continuous point source",
          };
        }
        if (!hasContinuousAttribute) {
          return {
            isValid: false,
            errorMessage: "Source has no continuous attributes",
          };
        }
        return { isValid: true };
      case VisualizationType.PROPORTIONAL_SYMBOL:
        if (
          geostats.geometry !== "Point" &&
          geostats.geometry !== "MultiPoint"
        ) {
          return {
            isValid: false,
            errorMessage:
              "Invalid visualization type for proportional symbol source",
          };
        }
        if (!hasContinuousAttribute) {
          return {
            isValid: false,
            errorMessage: "Source has no continuous attributes",
          };
        }
        return { isValid: true };
      default:
        return { isValid: false, errorMessage: "Invalid visualization type" };
    }
  }
  return { isValid: false, errorMessage: "Invalid visualization type" };
}
