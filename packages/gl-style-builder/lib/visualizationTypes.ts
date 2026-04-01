import {
  Bucket,
  GeostatsAttribute,
  GeostatsLayer,
  NumericGeostatsAttribute,
  RasterInfo,
  SuggestedRasterPresentation,
  isNumericGeostatsAttribute,
  isRasterInfo,
} from "@seasketch/geostats-types";

export enum VisualizationType {
  // Raster
  RGB_RASTER = "Raster Image",
  CATEGORICAL_RASTER = "Categorical Raster",
  CONTINUOUS_RASTER = "Continuous Raster",
  // Vector
  // Polygon or MultiPolygon
  SIMPLE_POLYGON = "Simple Polygon",
  CATEGORICAL_POLYGON = "Categories",
  CONTINUOUS_POLYGON = "Color Range",
  // Point or MultiPoint
  SIMPLE_POINT = "Simple Points",
  MARKER_IMAGE = "Marker Image",
  CATEGORICAL_POINT = "Categorized Points",
  PROPORTIONAL_SYMBOL = "Proportional Symbol",
  CONTINUOUS_POINT = "Point Color Range",
  HEATMAP = "Heatmap",
  // Line
  SIMPLE_LINE = "Simple Line",
  CONTINUOUS_LINE = "Continuous Line",
  CATEGORICAL_LINE = "Categorical Line",
}

export function validVisualizationTypesForGeostats(
  geostats: GeostatsLayer | RasterInfo,
) {
  const types: VisualizationType[] = [];
  if (isRasterInfo(geostats)) {
    if (geostats.presentation === SuggestedRasterPresentation.rgb) {
      types.push(VisualizationType.RGB_RASTER);
    } else if (
      geostats.presentation === SuggestedRasterPresentation.categorical &&
      geostats.bands[0].stats.categories &&
      geostats.bands[0].stats.categories.length > 0
    ) {
      types.push(VisualizationType.CATEGORICAL_RASTER);
      if (geostats.bands[0].stats.categories.length > 4) {
        types.push(VisualizationType.CONTINUOUS_RASTER);
      }
    } else if (
      geostats.presentation === SuggestedRasterPresentation.continuous
    ) {
      types.push(VisualizationType.CONTINUOUS_RASTER);
      if (geostats.byteEncoding) {
        types.push(VisualizationType.CATEGORICAL_RASTER);
      }
    }
  } else {
    if (
      geostats.geometry === "Polygon" ||
      geostats.geometry === "MultiPolygon"
    ) {
      types.push(VisualizationType.SIMPLE_POLYGON);
      if (findBestCategoricalAttribute(geostats) !== null) {
        types.push(VisualizationType.CATEGORICAL_POLYGON);
      }
      if (findBestContinuousAttribute(geostats) !== null) {
        types.push(VisualizationType.CONTINUOUS_POLYGON);
      }
    } else if (
      geostats.geometry === "Point" ||
      geostats.geometry === "MultiPoint"
    ) {
      types.push(
        VisualizationType.SIMPLE_POINT,
        // TODO: implement VisualizationType.MARKER_IMAGE
      );
      // check for categorical attributes and add CATEGORICAL_POINT if so
      const categorical = findBestCategoricalAttribute(geostats);
      if (categorical) {
        types.push(VisualizationType.CATEGORICAL_POINT);
      }
      // check for continuous data values
      if (findBestContinuousAttribute(geostats) !== null) {
        types.push(
          VisualizationType.PROPORTIONAL_SYMBOL,
          VisualizationType.CONTINUOUS_POINT,
        );
      }
      types.push(VisualizationType.HEATMAP);
    }
  }
  return types;
}
