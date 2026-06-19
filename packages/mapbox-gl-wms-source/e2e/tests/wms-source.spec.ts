import { expect, Page, Request, test } from "@playwright/test";
import fs from "fs";
import path from "path";
import { PNG } from "pngjs";

/**
 * Browser integration tests for the WMS source classes. These mirror the manual
 * QA performed against live services, but run deterministically against mocked
 * WMS responses so they can guard against regressions in CI.
 *
 * NOTE: This file is intentionally self-contained (no relative `.ts` imports).
 * Playwright 1.61's sync loader crashes resolving relative TS imports on Node
 * 22.15/22.16 (`context.conditions?.includes is not a function`, fixed in Node
 * 22.17). Keeping helpers inline sidesteps that environment-specific bug.
 */

// ---------------------------------------------------------------------------
// Fixtures + WMS mock
// ---------------------------------------------------------------------------

const fixturesDir = path.resolve(__dirname, "../../src/__fixtures__");
const capabilitiesXml = fs.readFileSync(
  path.join(fixturesDir, "wms130-capabilities.xml"),
  "utf8"
);
const featureInfoJson = fs.readFileSync(
  path.join(fixturesDir, "featureinfo-json.json"),
  "utf8"
);

// 8x8 opaque red PNG (RGBA), generated deterministically. Mocks GetMap so we
// can assert the overlay actually rendered to the canvas.
const redPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAEklEQVR4nGO4Iyf3Hx9mGBkKAO7khcEz5XnsAAAAAElFTkSuQmCC",
  "base64"
);

interface WmsMockOptions {
  capabilities?: string;
  capabilitiesStatus?: number;
  abort?: boolean;
}

interface WmsMockHandle {
  requests: string[];
  byRequestType(type: string): URL[];
}

async function installWmsMock(
  page: Page,
  options: WmsMockOptions = {}
): Promise<WmsMockHandle> {
  const requests: string[] = [];

  // Keep tests hermetic/offline: swallow Mapbox telemetry. The token is
  // validated locally by Mapbox GL, so no Mapbox network access is required.
  await page.route(/events\.mapbox\.com|api\.mapbox\.com/, (route) =>
    route.fulfill({ status: 204, body: "" })
  );

  await page.route("https://example.com/**", async (route) => {
    const request: Request = route.request();
    const urlString = request.url();
    requests.push(urlString);

    if (options.abort) {
      await route.abort("failed");
      return;
    }

    const url = new URL(urlString);
    const reqType = (url.searchParams.get("REQUEST") || "").toLowerCase();

    // Mapbox loads overlay images with crossOrigin, so mocked responses must
    // include permissive CORS headers or the image is blocked and never paints.
    const cors = { "access-control-allow-origin": "*" };

    if (urlString.includes("legend")) {
      await route.fulfill({ contentType: "image/png", body: redPng, headers: cors });
      return;
    }

    switch (reqType) {
      case "getcapabilities":
        await route.fulfill({
          status: options.capabilitiesStatus ?? 200,
          contentType: "text/xml",
          body: options.capabilities ?? capabilitiesXml,
          headers: cors,
        });
        return;
      case "getfeatureinfo":
        await route.fulfill({
          contentType: "application/json",
          body: featureInfoJson,
          headers: cors,
        });
        return;
      default:
        // GetMap, GetLegendGraphic, and tiles all return the red image.
        await route.fulfill({ contentType: "image/png", body: redPng, headers: cors });
    }
  });

  return {
    requests,
    byRequestType(type: string) {
      return requests
        .map((r) => new URL(r))
        .filter(
          (u) =>
            (u.searchParams.get("REQUEST") || "").toLowerCase() ===
            type.toLowerCase()
        );
    },
  };
}

/**
 * Sample the center pixel of the rendered map. We screenshot via Playwright
 * (which captures true composited WebGL output) rather than reading the canvas
 * in-page — headless Chromium returns a blank framebuffer for in-page WebGL
 * readback.
 */
async function sampleMapCenter(page: Page): Promise<{
  r: number;
  g: number;
  b: number;
  a: number;
}> {
  const buf = await page.locator("#map").screenshot();
  const png = PNG.sync.read(buf);
  const cx = Math.floor(png.width / 2);
  const cy = Math.floor(png.height / 2);
  const idx = (cy * png.width + cx) * 4;
  return {
    r: png.data[idx],
    g: png.data[idx + 1],
    b: png.data[idx + 2],
    a: png.data[idx + 3],
  };
}

const MERCATOR_MAX = 20037509;
function isValidWebMercatorBbox(bbox: string | null): boolean {
  if (!bbox) return false;
  const parts = bbox.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return false;
  }
  return parts.every((n) => Math.abs(n) <= MERCATOR_MAX + 1);
}

// ---------------------------------------------------------------------------
// Harness driver (typed wrappers around window.harness)
// ---------------------------------------------------------------------------

type Harness = {
  load(opts?: {
    mode?: "dynamic" | "tiled";
    layers?: string[];
    hidpi?: boolean;
    opacity?: number;
  }): Promise<{
    layerCount: number;
    queryableLayers: string[];
    selectedLayers: string[];
    sourceType?: string;
    tileTemplate?: string;
    styleLayerType?: string;
  }>;
  loadCapabilities(): Promise<{
    title?: string;
    layerCount: number;
    getMapUrl?: string;
  }>;
  identifyAt(
    lng: number,
    lat: number
  ): Promise<{ html?: string; features: Array<{ properties?: unknown }> }>;
  ready(): Promise<void>;
  errors: string[];
};

async function gotoHarness(page: Page) {
  await page.goto("/harness.html");
  await page.waitForFunction(
    () => !!(window as unknown as { harness?: unknown }).harness
  );
  await page.evaluate(() =>
    (window as unknown as { harness: Harness }).harness.ready()
  );
}

function driver(page: Page) {
  return {
    load: (opts?: Parameters<Harness["load"]>[0]) =>
      page.evaluate(
        (o) => (window as unknown as { harness: Harness }).harness.load(o),
        opts
      ),
    loadCapabilities: () =>
      page.evaluate(() =>
        (window as unknown as { harness: Harness }).harness.loadCapabilities()
      ),
    identifyAt: (lng: number, lat: number) =>
      page.evaluate(
        ([a, b]) =>
          (window as unknown as { harness: Harness }).harness.identifyAt(a, b),
        [lng, lat] as const
      ),
    errors: () =>
      page.evaluate(
        () => (window as unknown as { harness: Harness }).harness.errors
      ),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("WMS capabilities", () => {
  test("parses layers from a capabilities document", async ({ page }) => {
    await installWmsMock(page);
    await gotoHarness(page);

    const result = await driver(page).loadCapabilities();
    expect(result.layerCount).toBe(2); // bathymetry + coastline
    expect(result.getMapUrl).toContain("example.com");
  });

  test("rejects on a non-XML capabilities response", async ({ page }) => {
    await installWmsMock(page, { capabilities: "Internal Server Error" });
    await gotoHarness(page);
    await expect(driver(page).loadCapabilities()).rejects.toThrow(/not XML/);
  });

  test("rejects when the request is blocked (CORS/network failure)", async ({
    page,
  }) => {
    await installWmsMock(page, { abort: true });
    await gotoHarness(page);
    await expect(driver(page).loadCapabilities()).rejects.toBeTruthy();
  });
});

test.describe("Dynamic (viewport image) source", () => {
  test("renders the overlay and builds spec-compliant GetMap URLs", async ({
    page,
  }) => {
    const mock = await installWmsMock(page);
    await gotoHarness(page);

    const result = await driver(page).load({ mode: "dynamic" });
    expect(result.sourceType).toBe("image");
    expect(result.styleLayerType).toBe("raster");
    expect(result.selectedLayers).toEqual(["bathymetry"]);

    const getMaps = mock.byRequestType("GetMap");
    expect(getMaps.length).toBeGreaterThan(0);

    const last = getMaps[getMaps.length - 1];
    // Regression guard: STYLES is mandatory per the WMS spec, even when empty.
    expect(last.searchParams.has("STYLES")).toBe(true);
    expect(last.searchParams.get("LAYERS")).toBe("bathymetry");
    expect(last.searchParams.get("CRS")).toBe("EPSG:3857");
    // Regression guard: BBOX must be valid Web Mercator (the globe-projection
    // bug produced out-of-range values in the hundreds of millions).
    expect(isValidWebMercatorBbox(last.searchParams.get("BBOX"))).toBe(true);

    // The mocked GetMap returns a solid red image; the overlay should paint it.
    const px = await sampleMapCenter(page);
    expect(px.r).toBeGreaterThan(120);
    expect(px.g).toBeLessThan(120);
    expect(px.b).toBeLessThan(120);

    expect(await driver(page).errors()).toEqual([]);
  });
});

test.describe("Tiled (raster template) source", () => {
  test("uses a raster source with a bbox tile template and renders", async ({
    page,
  }) => {
    const mock = await installWmsMock(page);
    await gotoHarness(page);

    const result = await driver(page).load({ mode: "tiled" });
    expect(result.sourceType).toBe("raster");
    expect(result.tileTemplate).toContain("{bbox-epsg-3857}");

    const getMaps = mock.byRequestType("GetMap");
    expect(getMaps.length).toBeGreaterThan(0);
    for (const u of getMaps) {
      expect(u.searchParams.has("STYLES")).toBe(true);
      expect(u.searchParams.get("WIDTH")).toBe("256");
    }

    const px = await sampleMapCenter(page);
    expect(px.r).toBeGreaterThan(120);
    expect(await driver(page).errors()).toEqual([]);
  });
});

test.describe("Tiled source on HiDPI displays", () => {
  test.use({ deviceScaleFactor: 2 });

  test("requests 2x tiles", async ({ page }) => {
    const mock = await installWmsMock(page);
    await gotoHarness(page);

    await driver(page).load({ mode: "tiled", hidpi: true });

    const getMaps = mock.byRequestType("GetMap");
    expect(getMaps.length).toBeGreaterThan(0);
    expect(getMaps[getMaps.length - 1].searchParams.get("WIDTH")).toBe("512");
  });
});

test.describe("GetFeatureInfo (interactivity)", () => {
  test("returns features with consistent request parameters", async ({
    page,
  }) => {
    const mock = await installWmsMock(page);
    await gotoHarness(page);

    await driver(page).load({ mode: "dynamic", layers: ["bathymetry"] });
    const result = await driver(page).identifyAt(0, 0);

    expect(result.features.length).toBeGreaterThan(0);
    expect(result.features[0].properties).toMatchObject({ name: "Test EEZ" });

    const gfi = mock.byRequestType("GetFeatureInfo");
    expect(gfi.length).toBeGreaterThan(0);
    const u = gfi[gfi.length - 1];
    expect(u.searchParams.get("QUERY_LAYERS")).toBe("bathymetry");
    expect(isValidWebMercatorBbox(u.searchParams.get("BBOX"))).toBe(true);
    // WMS 1.3.0 uses I/J pixel coordinates.
    expect(u.searchParams.has("I")).toBe(true);
    expect(u.searchParams.has("J")).toBe(true);
    expect(u.searchParams.has("STYLES")).toBe(true);
  });
});
