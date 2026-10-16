import { expect, test, type Page } from "@playwright/test";
import { basemapSwatch, openMap, visibleButton } from "../src/project";

type StyleSource = {
  type: string;
  url: string;
  tiles: string[];
};

/** Sources from the stylesheet Mapbox GL is actually drawing. */
async function installedStyleSources(page: Page): Promise<StyleSource[] | null> {
  return page.evaluate(() => {
    const map = (
      window as unknown as {
        mapContext?: {
          map?: {
            getStyle: () => {
              sources?: Record<string, { type?: string; url?: string; tiles?: string[] }>;
            };
          };
        };
      }
    ).mapContext?.map;
    if (!map) {
      return null;
    }
    let style;
    try {
      style = map.getStyle();
    } catch {
      return null;
    }
    return Object.values(style.sources ?? {}).map((source) => ({
      type: source.type ?? "",
      url: typeof source.url === "string" ? source.url : "",
      tiles: Array.isArray(source.tiles) ? source.tiles : [],
    }));
  });
}

function satelliteRaster(sources: StyleSource[] | null) {
  return (sources ?? []).filter(
    (source) =>
      source.type === "raster" &&
      (source.url.includes("mapbox.satellite") ||
        source.tiles.some((tile) => tile.includes("mapbox.satellite")))
  );
}

test.describe("demo-samoa basemaps", () => {
  test("an anonymous visitor can switch from Light to Satellite", async ({ page }) => {
    test.setTimeout(90_000);
    await openMap(page, "/demo-samoa/app");
    await visibleButton(page, "Maps").click();

    await expect(page.getByRole("button", { name: "Light", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Satellite", exact: true })).toBeVisible();
    await expect(basemapSwatch(page, "Light")).toHaveClass(/ring-blue-500/);
    await expect
      .poll(async () => {
        const sources = await installedStyleSources(page);
        return {
          vector: (sources ?? []).some((source) => source.type === "vector"),
          satellite: satelliteRaster(sources).map((source) => source.url || source.tiles[0]),
        };
      })
      .toEqual({ vector: true, satellite: [] });

    await page.getByRole("button", { name: "Satellite", exact: true }).click();
    await expect(basemapSwatch(page, "Satellite")).toHaveClass(/ring-blue-500/);
    await expect(basemapSwatch(page, "Light")).not.toHaveClass(/ring-blue-500/);
    await expect
      .poll(
        async () =>
          satelliteRaster(await installedStyleSources(page)).flatMap((source) =>
            source.tiles.length > 0 ? source.tiles : [source.url]
          ),
        { timeout: 30_000 }
      )
      .toEqual(expect.arrayContaining([expect.stringContaining("mapbox.satellite")]));
    await expect(page.locator(".mapboxgl-map[data-map-loaded='true']")).toBeVisible();
  });
});
