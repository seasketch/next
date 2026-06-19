/**
 * Curated WMS example services for the playground, live tests, and docs.
 *
 * **Edit `exampleServices.json`** to add or change services — this module
 * re-exports that data with TypeScript types.
 */
import services from "./exampleServices.json";

export interface ExampleWMSService {
  id: string;
  name: string;
  serverType: "GeoServer" | "MapServer" | "ArcGIS WMS" | "OnEarth" | "ERDDAP";
  url: string;
  description: string;
  defaultLayers?: string[];
  mapCenter?: [number, number];
  mapZoom?: number;
  /** Live Playwright: run a GetFeatureInfo smoke test (service has queryable layers). */
  liveGetFeatureInfo?: boolean;
  /**
   * Live Playwright: map coordinate for GetFeatureInfo probe.
   * Defaults to `mapCenter` when omitted.
   */
  identifyAt?: [number, number];
}

export const EXAMPLE_WMS_SERVICES = services as ExampleWMSService[];
