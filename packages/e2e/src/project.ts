import { expect, type APIRequestContext, type Page, type Response } from "@playwright/test";
import { installSession, issueToken } from "./auth";

export async function signIn(
  page: Page,
  request: APIRequestContext,
  persona: { sub: string; superuser: boolean }
) {
  const issued = await issueToken(request, persona);
  await installSession(page.context(), issued);
  return issued;
}

/** Desktop and the closed mobile drawer both render the same nav link. */
export function visibleNavLink(page: Page, name: string) {
  return page.getByRole("link", { name }).filter({ visible: true }).first();
}

/** The collapsed toolbar and the open drawer both render the same control. */
export function visibleButton(page: Page, name: string | RegExp) {
  return page.getByRole("button", { name }).filter({ visible: true }).first();
}

/**
 * A Mapbox GL style document: version 8, with sources and at least one layer.
 * This is the same check the client uses before it will install a basemap.
 */
export function isMapboxGlStyle(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  const style = value as { version?: unknown; sources?: unknown; layers?: unknown };
  return (
    style.version === 8 &&
    !!style.sources &&
    typeof style.sources === "object" &&
    Array.isArray(style.layers) &&
    style.layers.length > 0
  );
}

/**
 * Read the style body as soon as the response arrives. A later navigation
 * drops the body, and a project page often follows a redirect that already
 * requested the same basemap style.
 */
export function waitForMapboxStyle(page: Page): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      page.off("response", onResponse);
      reject(new Error("Timed out waiting for a Mapbox GL style"));
    }, 30_000);
    const finish = (style: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      page.off("response", onResponse);
      resolve(style);
    };
    const onResponse = (response: Response) => {
      const url = response.url();
      if (
        !response.ok() ||
        !url.includes("api.mapbox.com/styles/v1/") ||
        url.includes("/sprite")
      ) {
        return;
      }
      response
        .json()
        .then((style) => {
          if (isMapboxGlStyle(style)) {
            finish(style);
          }
        })
        .catch(() => {
          // The document that made this request has already been replaced.
        });
    };
    page.on("response", onResponse);
  });
}

/**
 * Open a project and wait until the map has booted. Call this when the step
 * uses the map. The sidebar, forums, and admin navigation do not. The canvas
 * exists before any style is installed, so this waits for a Mapbox GL style
 * response and the map's load event (data-map-loaded), not for every tile.
 */
export async function openMap(page: Page, path: string) {
  const style = waitForMapboxStyle(page);
  await page.goto(path);
  expect(isMapboxGlStyle(await style)).toBe(true);
  await expect(page.locator(".mapboxgl-map[data-map-loaded='true']")).toBeVisible({
    timeout: 30_000,
  });
}

/** The selected basemap square draws a blue ring. */
export function basemapSwatch(page: Page, name: string) {
  return page.getByRole("button", { name, exact: true }).locator("div").first();
}
