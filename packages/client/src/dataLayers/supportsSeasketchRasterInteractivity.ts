/* eslint-disable i18next/no-literal-string */
import {
  GeostatsLayer,
  isGeostatsLayer,
  isRasterInfo,
  RasterInfo,
  SuggestedRasterPresentation,
} from "@seasketch/geostats-types";
import { encodingParamsFromGlStyles } from "./rasterValueEncoding";

/** Matches DataSourceTypes.SeasketchRaster without importing generated GraphQL. */
const SEASKETCH_RASTER = "SEASKETCH_RASTER";

/**
 * Admin UI eligibility: single-band SeaSketch rasters that are RGB-encoded
 * (Gray continuous or Palette categorical — not true RGB imagery).
 * Runtime sampling still keys off raster-color-mix.
 */
export function supportsSeasketchRasterInteractivity(
  sourceType: string | undefined | null,
  geostats: unknown
): boolean {
  if (sourceType !== SEASKETCH_RASTER) {
    return false;
  }
  if (!isRasterInfo(geostats)) {
    return false;
  }
  if (!geostats.bands?.length || geostats.bands.length !== 1) {
    return false;
  }
  const colorInterp = geostats.bands[0].colorInterpretation;
  if (colorInterp !== "Gray" && colorInterp !== "Palette") {
    return false;
  }
  if (geostats.presentation === SuggestedRasterPresentation.rgb) {
    return false;
  }
  return true;
}

/** Resolve vector GeostatsLayer or RasterInfo from a data source geostats blob. */
export function resolveSourceGeostats(
  sourceGeostats: unknown,
  sourceLayer?: string | null
): GeostatsLayer | RasterInfo | undefined {
  if (!sourceGeostats) {
    return undefined;
  }
  if (isRasterInfo(sourceGeostats)) {
    return sourceGeostats;
  }
  if (
    typeof sourceGeostats !== "object" ||
    sourceGeostats === null ||
    !("layers" in sourceGeostats) ||
    !Array.isArray((sourceGeostats as { layers?: unknown }).layers)
  ) {
    return undefined;
  }
  const layers = (sourceGeostats as { layers: unknown[] }).layers;
  const match = layers.find((l) => {
    if (!isGeostatsLayer(l)) {
      return false;
    }
    if (!sourceLayer) {
      return true;
    }
    return l.layer === sourceLayer;
  });
  return isGeostatsLayer(match) ? match : undefined;
}

/**
 * Whether a layer's style can be sampled for raster values at runtime
 * (admin + published maps share this check).
 */
export function layerHasRasterValueEncoding(
  mapboxGlStyles: unknown
): boolean {
  return encodingParamsFromGlStyles(mapboxGlStyles) !== null;
}
