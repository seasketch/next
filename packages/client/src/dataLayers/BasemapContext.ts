import { createContext } from "react";
import type { BasemapDetailsFragment } from "../generated/graphql";

/** Basemap selection and terrain/optional-layer state. Changes on basemap switch. */
export interface BasemapContextState {
  selectedBasemap?: string;
  terrainEnabled: boolean;
  prefersTerrainEnabled?: boolean;
  basemapError?: Error;
  basemapOptionalLayerStates: { [layerName: string]: any };
  basemapOptionalLayerStatePreferences?: { [layerName: string]: any };
  /** Basemap list from useMapData - exposed for component consumption */
  basemaps?: BasemapDetailsFragment[];
}

/** Basemap selection, terrain, optional-layer state. */
export const BasemapContext = createContext<BasemapContextState>({
  terrainEnabled: false,
  basemapOptionalLayerStates: {},
});
