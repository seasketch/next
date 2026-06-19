import { expect, Page, test } from "@playwright/test";
import fs from "fs";
import path from "path";
import { PNG } from "pngjs";

/** Shape of entries in src/exampleServices.json (single source of truth). */
interface ExampleService {
  id: string;
  name: string;
  url: string;
  mapCenter?: [number, number];
  liveGetFeatureInfo?: boolean;
  identifyAt?: [number, number];
}

/**
 * Loaded via fs (not a relative TS import) because Playwright 1.61 on Node
 * 22.15/22.16 crashes resolving relative imports from e2e/tests/.
 * Data lives in src/exampleServices.json — keep in sync with exampleServices.ts.
 */
const EXAMPLE_WMS_SERVICES: ExampleService[] = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../../src/exampleServices.json"),
    "utf8"
  )
);

/**
 * Live Playwright tests against real WMS example services.
 *
 * Run explicitly (never part of the default blocking CI e2e suite):
 *   npm run test:e2e:live           # headless automation
 *   npm run test:e2e:live:headed    # visible browser for manual inspection
 *   npm run test:e2e:live:ui        # Playwright UI mode
 *
 * Set PW_LIVE_PAUSE=1 to pause after each service load (interactive debug).
 */
function identifyCoordinate(service: ExampleService) {
  return service.identifyAt ?? service.mapCenter ?? ([0, 0] as [number, number]);
}

type LiveHarness = {
  ready(): Promise<void>;
  errors: string[];
  loadService(
    url: string,
    opts?: { mode?: "dynamic" | "tiled" }
  ): Promise<{
    layerCount: number;
    selectedLayers: string[];
    sourceType?: string;
    getMapUrls: string[];
    wmsRequestCount: number;
  }>;
  identifyAt(
    lng: number,
    lat: number
  ): Promise<{ features: Array<{ properties?: unknown }> }>;
};

async function gotoLiveHarness(page: Page) {
  // Block Mapbox telemetry only — WMS traffic must reach real servers.
  await page.route(/events\.mapbox\.com/, (route) =>
    route.fulfill({ status: 204, body: "" })
  );
  await page.goto("/live-harness.html");
  await page.waitForFunction(
    () => !!(window as unknown as { liveHarness?: unknown }).liveHarness
  );
  await page.evaluate(() =>
    (window as unknown as { liveHarness: LiveHarness }).liveHarness.ready()
  );
}

/** Collect WMS GetMap URLs from the browser network (Mapbox loads images natively). */
function trackGetMapRequests(page: Page): {
  urls: string[];
  stop: () => void;
} {
  const urls: string[] = [];
  const handler = (req: { url: () => string }) => {
    if (/REQUEST=GetMap/i.test(req.url())) {
      urls.push(req.url());
    }
  };
  page.on("request", handler);
  return {
    urls,
    stop: () => page.off("request", handler),
  };
}

function harness(page: Page) {
  return {
    loadService: (url: string, opts?: { mode?: "dynamic" | "tiled" }) =>
      page.evaluate(
        ([u, o]) =>
          (window as unknown as { liveHarness: LiveHarness }).liveHarness.loadService(
            u,
            o
          ),
        [url, opts] as const
      ),
    identifyAt: (lng: number, lat: number) =>
      page.evaluate(
        ([a, b]) =>
          (window as unknown as { liveHarness: LiveHarness }).liveHarness.identifyAt(
            a,
            b
          ),
        [lng, lat] as const
      ),
    errors: () =>
      page.evaluate(
        () => (window as unknown as { liveHarness: LiveHarness }).liveHarness.errors
      ),
  };
}

/** Sample several pixels; returns true if any differ noticeably from blank white. */
async function mapShowsOverlay(page: Page): Promise<boolean> {
  const buf = await page.locator("#map").screenshot();
  const png = PNG.sync.read(buf);
  const samples = [
    [0.5, 0.5],
    [0.35, 0.45],
    [0.65, 0.55],
    [0.5, 0.35],
    [0.5, 0.65],
  ];
  for (const [nx, ny] of samples) {
    const x = Math.floor(png.width * nx);
    const y = Math.floor(png.height * ny);
    const idx = (y * png.width + x) * 4;
    const r = png.data[idx];
    const g = png.data[idx + 1];
    const b = png.data[idx + 2];
    // Empty map is white/transparent; a rendered WMS overlay adds color.
    if (r < 245 || g < 245 || b < 245) {
      return true;
    }
  }
  return false;
}

async function attachScreenshot(page: Page, name: string) {
  const body = await page.locator("#map").screenshot();
  await test.info().attach(name, { body, contentType: "image/png" });
}

async function maybePause(page: Page) {
  if (process.env.PW_LIVE_PAUSE === "1") {
    await page.pause();
  }
}

test.describe.configure({ mode: "serial" });

for (const service of EXAMPLE_WMS_SERVICES) {
  test(`@live ${service.name} — dynamic render`, async ({ page }) => {
    test.setTimeout(90_000);
    await gotoLiveHarness(page);
    const getMap = trackGetMapRequests(page);

    try {
      const result = await harness(page).loadService(service.url, {
        mode: "dynamic",
      });

      expect(result.layerCount).toBeGreaterThan(0);
      expect(result.selectedLayers.length).toBeGreaterThan(0);
      expect(result.sourceType).toBe("image");

      // Mapbox fetches GetMap images outside our fetch wrapper — observe network.
      await expect
        .poll(() => getMap.urls.length, { timeout: 30_000 })
        .toBeGreaterThan(0);

      const lastGetMap = new URL(getMap.urls[getMap.urls.length - 1]);
      expect(lastGetMap.searchParams.has("STYLES")).toBe(true);
      expect(lastGetMap.searchParams.get("LAYERS")).toBeTruthy();

      expect(await mapShowsOverlay(page)).toBe(true);
      await attachScreenshot(page, `${service.id}-dynamic`);

      const errs = await harness(page).errors();
      expect(errs.filter((e) => !/telemetry/i.test(e))).toEqual([]);
    } finally {
      getMap.stop();
    }

    await maybePause(page);
  });

  if (service.liveGetFeatureInfo) {
    test(`@live ${service.name} — GetFeatureInfo`, async ({ page }) => {
      test.setTimeout(90_000);
      await gotoLiveHarness(page);
      await harness(page).loadService(service.url, { mode: "dynamic" });

      const [lng, lat] = identifyCoordinate(service);
      const info = await harness(page).identifyAt(lng, lat);
      // Some servers return HTML-only responses; accept either features or html body.
      const hit =
        info.features.length > 0 ||
        Boolean((info as { html?: string }).html?.length);
      expect(hit).toBe(true);

      await attachScreenshot(page, `${service.id}-featureinfo`);
      await maybePause(page);
    });
  }
}

test("@live tiled render smoke (EMODnet bathymetry)", async ({ page }) => {
  test.setTimeout(90_000);
  await gotoLiveHarness(page);
  const getMap = trackGetMapRequests(page);

  try {
    const svc = EXAMPLE_WMS_SERVICES[0];
    const result = await harness(page).loadService(svc.url, { mode: "tiled" });

    expect(result.sourceType).toBe("raster");
    await expect
      .poll(() => getMap.urls.length, { timeout: 30_000 })
      .toBeGreaterThan(0);
    expect(await mapShowsOverlay(page)).toBe(true);
    await attachScreenshot(page, `${svc.id}-tiled`);
  } finally {
    getMap.stop();
  }

  await maybePause(page);
});
