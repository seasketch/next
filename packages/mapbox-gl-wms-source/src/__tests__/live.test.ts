import { describe, expect, it } from "vitest";
import { EXAMPLE_WMS_SERVICES } from "../exampleServices";
import { fetchCapabilities, getNamedLayers } from "../catalog";
import { buildGetMapUrl } from "../urls";
import { getSupportedWebMercatorCrs } from "../capabilities";

/**
 * Opt-in smoke tests against the real example services. These are gated behind
 * WMS_LIVE=1 (run via `npm run test:live`) so CI is not coupled to third-party
 * server availability. They catch drift between our parser/URL builders and how
 * real GeoServer / MapServer / ArcGIS / OnEarth deployments actually behave.
 */
const live = process.env.WMS_LIVE === "1";

describe.skipIf(!live)("live WMS smoke tests", () => {
  for (const service of EXAMPLE_WMS_SERVICES) {
    describe(service.name, () => {
      it("fetches and parses capabilities", async () => {
        const { metadata } = await fetchCapabilities(service.url);
        expect(getNamedLayers(metadata.layers).length).toBeGreaterThan(0);
        expect(metadata.getMap.url).toBeTruthy();
      }, 30000);

      it("returns a renderable image for a GetMap request", async () => {
        const { metadata } = await fetchCapabilities(service.url);
        const named = getNamedLayers(metadata.layers);
        const layerName =
          service.defaultLayers?.find((n) =>
            named.some((l) => l.name === n)
          ) || named[0]?.name;
        expect(layerName).toBeTruthy();

        const crs = getSupportedWebMercatorCrs(metadata) || "EPSG:4326";
        const mercator = crs === "EPSG:3857" || crs === "EPSG:900913";
        // Web Mercator meters vs. geographic degrees, depending on CRS.
        const bbox: [number, number, number, number] = mercator
          ? [-2000000, 4000000, 2000000, 8000000]
          : [-18, 34, 18, 60];
        const url = buildGetMapUrl({
          baseUrl: metadata.getMap.url,
          version: metadata.version,
          layers: [layerName!],
          crs,
          bbox,
          width: 256,
          height: 256,
          format: "image/png",
        });

        const res = await fetch(url);
        expect(res.status).toBe(200);
        const contentType = res.headers.get("content-type") || "";
        // A WMS ServiceException is returned as XML; a real render is an image.
        expect(contentType).toMatch(/image\//);
      }, 30000);
    });
  }
});
