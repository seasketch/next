import {
  GeostatsLayer,
  RasterInfo,
  SuggestedRasterPresentation,
  isRasterInfo,
} from "@seasketch/geostats-types";

export enum VisualizationTypes {
  RGB_RASTER = "rgb-raster",
}

export function validVisualizationTypesForGeostats(
  geostats: GeostatsLayer | RasterInfo
) {
  const types: VisualizationTypes[] = [];
  if (isRasterInfo(geostats)) {
    if (geostats.presentation === SuggestedRasterPresentation.rgb) {
      types.push(VisualizationTypes.RGB_RASTER);
    }
  }
  return types;
}
