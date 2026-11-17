import { expect, test, type Page } from "@playwright/test";
import { issueToken } from "../src/auth";
import { personas } from "../src/config";
import { hardDeleteProject } from "../src/db";
import { graphql } from "../src/graphql";
import { addLegendLayer, createShellProject } from "../src/shellProject";
import {
  basemapSwatch,
  openMap,
  reloadMap,
  signIn,
  visibleButton,
} from "../src/project";

const created: string[] = [];
let slugSerial = 0;

test.afterEach(async () => {
  for (const projectSlug of created.splice(0)) {
    await hardDeleteProject(projectSlug);
  }
});

function projectSlug(label: string) {
  slugSerial += 1;
  return `e2e-${label}-${slugSerial}${Date.now().toString(36)}`.slice(0, 24);
}

type Camera = { lng: number; lat: number; zoom: number; bearing: number };

async function camera(page: Page): Promise<Camera | null> {
  return page.evaluate(() => {
    const map = (
      window as unknown as {
        mapContext?: {
          map?: {
            getCenter: () => { lng: number; lat: number };
            getZoom: () => number;
            getBearing: () => number;
          };
        };
      }
    ).mapContext?.map;
    if (!map) {
      return null;
    }
    const center = map.getCenter();
    return {
      lng: center.lng,
      lat: center.lat,
      zoom: map.getZoom(),
      bearing: map.getBearing(),
    };
  });
}

async function jumpTo(
  page: Page,
  view: { lng: number; lat: number; zoom: number; bearing?: number }
) {
  await page.evaluate((next) => {
    const map = (
      window as unknown as {
        mapContext?: {
          map?: {
            jumpTo: (camera: {
              center: [number, number];
              zoom: number;
              bearing: number;
            }) => void;
          };
        };
      }
    ).mapContext?.map;
    map?.jumpTo({
      center: [next.lng, next.lat],
      zoom: next.zoom,
      bearing: next.bearing ?? 0,
    });
  }, view);
}

function mapLoaded(page: Page) {
  return page.locator(".mapboxgl-map[data-map-loaded='true']");
}

async function collapseToolbar(page: Page) {
  const collapse = page.getByRole("button", { name: "Collapse Navigation" });
  if (await collapse.isVisible()) {
    await collapse.click();
  }
  await expect(page.getByRole("button", { name: "Expand Navigation" })).toBeVisible();
}

async function expandToolbar(page: Page) {
  const expand = page.getByRole("button", { name: "Expand Navigation" });
  if (await expand.isVisible()) {
    await expand.click();
  }
  await expect(page.getByRole("button", { name: "Collapse Navigation" })).toBeVisible();
}

async function openMapSettings(page: Page) {
  await page.getByRole("button", { name: "Map settings" }).click();
}

async function turnOnEez(page: Page) {
  await visibleButton(page, "Overlay Layers").click();
  const folder = page.getByRole("treeitem", { name: "Geography layers" });
  await expect(folder).toBeVisible();
  await folder.getByRole("button", { name: "Expand" }).click();
  const eez = page.getByRole("checkbox", { name: "Exclusive Economic Zone" });
  await eez.click();
  await expect(eez).toBeChecked();
}

function legend(page: Page) {
  return page.getByTestId("map-legend");
}

/**
 * The legend trigger is aria-disabled while the panel is open, because the
 * accordion is not collapsible. The header click still toggles it, and a
 * forced click reaches that handler.
 */
async function toggleLegend(page: Page) {
  await page.getByRole("button", { name: "Legend" }).click({ force: true });
}

function legendItem(page: Page, name: string) {
  return page.locator('li[id^="legend-item-"]').filter({ hasText: name });
}

const USER_GUIDE = "https://docs.seasketch.org/seasketch-documentation/users-guide/getting-started";

test.describe("map shell @enduser @map", () => {
  test("the mini sidebar offers the project tools, and expanding it shows the project name", async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    const project = await createShellProject(request, {
      name: "Chrome Project",
      slug: projectSlug("chrome"),
      about: true,
    });
    created.push(project.slug);

    await openMap(page, `/${project.slug}/app`);
    await collapseToolbar(page);

    for (const name of ["About", "Maps", "Overlay Layers", "Sketches", "Discussion Forums"]) {
      await expect(visibleButton(page, name)).toBeVisible();
    }
    await expect(page.getByRole("heading", { level: 1, name: project.name })).toHaveCount(0);

    await expandToolbar(page);
    await expect(page.getByRole("heading", { level: 1, name: project.name })).toBeVisible();
    await expect(visibleButton(page, "About")).toBeVisible();
    await expect(visibleButton(page, "Maps")).toBeVisible();
  });

  test("collapsing the sidebar leaves the icon buttons and the map stays loaded", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openMap(page, "/demo-samoa/app");
    await expect(mapLoaded(page)).toBeVisible();
    await collapseToolbar(page);

    for (const name of ["Maps", "Overlay Layers", "Sketches", "Discussion Forums"]) {
      await expect(visibleButton(page, name)).toBeVisible();
    }
    await expect(mapLoaded(page)).toBeVisible();
  });

  test("About is absent when the about page is turned off", async ({ page, request }) => {
    test.setTimeout(90_000);
    const project = await createShellProject(request, {
      name: "No About",
      slug: projectSlug("about"),
    });
    created.push(project.slug);

    await openMap(page, `/${project.slug}/app`);
    await expect(page.getByRole("button", { name: "About", exact: true })).toHaveCount(0);
    await expect(visibleButton(page, "Maps")).toBeVisible();
  });

  test("hiding sketches, forums, or overlays removes those buttons", async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    const project = await createShellProject(request, {
      name: "Hidden Tools",
      slug: projectSlug("hide"),
      patch: { hideSketches: true, hideForums: true, hideOverlays: true },
    });
    created.push(project.slug);

    await openMap(page, `/${project.slug}/app`);
    await expect(visibleButton(page, "Maps")).toBeVisible();
    await expect(page.getByRole("button", { name: "Overlay Layers" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sketches" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Discussion Forums" })).toHaveCount(0);
  });

  test("User Guide opens the SeaSketch user guide", async ({ page, request }) => {
    test.setTimeout(90_000);
    const admin = await issueToken(request, personas.admin);
    const doc = await graphql<{
      projectBySlug: { customDocLink: string | null } | null;
    }>(
      request,
      admin.accessToken,
      `query Doc($slug: String!) { projectBySlug(slug: $slug) { customDocLink } }`,
      { slug: "demo-samoa" }
    );
    const custom = doc.projectBySlug?.customDocLink;
    const expected = custom && custom.length > 1 ? custom : USER_GUIDE;

    await openMap(page, "/demo-samoa/app");
    const popupPromise = page.waitForEvent("popup");
    await visibleButton(page, "User Guide").click();
    const popup = await popupPromise;
    await expect(popup).toHaveURL(expected);
    await popup.close();
  });

  test("a custom documentation link opens instead of the SeaSketch guide", async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    const guide = "https://example.com/e2e-user-guide";
    const project = await createShellProject(request, {
      name: "Custom Guide",
      slug: projectSlug("guide"),
      patch: { customDocLink: guide },
    });
    created.push(project.slug);

    await openMap(page, `/${project.slug}/app`);
    const popupPromise = page.waitForEvent("popup");
    await visibleButton(page, "User Guide").click();
    const popup = await popupPromise;
    await expect(popup).toHaveURL(guide);
    await popup.close();
  });

  test("the expanded footer links to terms, contact, and the homepage", async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    const admin = await issueToken(request, personas.admin);
    const details = await graphql<{
      projectBySlug: { supportEmail: string; name: string } | null;
    }>(
      request,
      admin.accessToken,
      `query Contact($slug: String!) {
        projectBySlug(slug: $slug) { supportEmail name }
      }`,
      { slug: "demo-samoa" }
    );
    const email = details.projectBySlug?.supportEmail;
    if (!email) {
      throw new Error("demo-samoa has no support email");
    }

    await openMap(page, "/demo-samoa/app");
    await expandToolbar(page);
    await expect(page.getByRole("link", { name: "Terms of Use" })).toHaveAttribute(
      "href",
      "/terms-of-use"
    );
    await page.getByRole("link", { name: "Contact Us" }).click();
    // The dialog shell is a zero-size motion wrapper. The panel inside it is what shows.
    await expect(
      page.getByRole("heading", { name: "Who would you like to contact?" })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Email project administrator" })).toHaveAttribute(
      "href",
      new RegExp(`mailto:${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)
    );
    await page.keyboard.press("Escape");

    await page.getByRole("link", { name: "SeaSketch Logo" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("Accessibility opens the statement in the sidebar", async ({ page }) => {
    test.setTimeout(90_000);
    await openMap(page, "/demo-samoa/app");
    await expandToolbar(page);
    await page.getByRole("link", { name: "Accessibility" }).click();
    await expect(page).toHaveURL(/\/demo-samoa\/app\/accessibility/);
    await expect(page.getByText("accessibility@seasketch.org")).toBeVisible();
  });

  test("the expanded footer shows the client build id", async ({ page }) => {
    test.setTimeout(90_000);
    await openMap(page, "/demo-samoa/app");
    await expandToolbar(page);
    await expect(page.getByTestId("client-build-id")).toBeVisible();
    await expect(page.getByTestId("client-build-id")).toHaveText(/Build\s+\S+/);
  });

  test("zoom in and zoom out change the map zoom and the map stays loaded", async ({ page }) => {
    test.setTimeout(90_000);
    await openMap(page, "/demo-samoa/app");
    const start = await camera(page);
    expect(start).not.toBeNull();

    await page.locator(".mapboxgl-ctrl-zoom-in").click();
    await expect
      .poll(async () => (await camera(page))?.zoom ?? 0)
      .toBeGreaterThan((start?.zoom ?? 0) + 0.4);

    const zoomed = (await camera(page))?.zoom ?? 0;
    await page.locator(".mapboxgl-ctrl-zoom-out").click();
    await expect.poll(async () => (await camera(page))?.zoom ?? zoomed).toBeLessThan(zoomed);
    await expect(mapLoaded(page)).toBeVisible();
  });

  test("the compass resets a rotated map to north", async ({ page }) => {
    test.setTimeout(90_000);
    await openMap(page, "/demo-samoa/app");
    await page.evaluate(() => {
      const map = (
        window as unknown as {
          mapContext?: { map?: { easeTo: (options: { bearing: number; duration: number }) => void } };
        }
      ).mapContext?.map;
      map?.easeTo({ bearing: 40, duration: 0 });
    });
    await expect.poll(async () => Math.abs((await camera(page))?.bearing ?? 0)).toBeGreaterThan(20);

    await page.locator(".mapboxgl-ctrl-compass").click();
    await expect.poll(async () => Math.abs((await camera(page))?.bearing ?? 90)).toBeLessThan(1);
  });

  test("Reset view returns the map to the project extent", async ({ page }) => {
    test.setTimeout(90_000);
    await openMap(page, "/demo-samoa/app");
    const start = await camera(page);
    expect(start).not.toBeNull();
    await jumpTo(page, {
      lng: start!.lng,
      lat: start!.lat,
      zoom: start!.zoom + 3,
    });
    await expect
      .poll(async () => (await camera(page))?.zoom ?? 0)
      .toBeGreaterThan(start!.zoom + 2);

    await openMapSettings(page);
    await page.getByRole("button", { name: "Reset view" }).click();
    await expect.poll(async () => (await camera(page))?.zoom ?? 99, { timeout: 15_000 }).toBeLessThan(start!.zoom + 0.5);
    await expect
      .poll(async () => {
        const next = await camera(page);
        if (!next || !start) {
          return 999;
        }
        return Math.hypot(next.lng - start.lng, next.lat - start.lat);
      })
      .toBeLessThan(1);
  });

  test("the scale bar can be shown and hidden and the map stays loaded", async ({ page }) => {
    test.setTimeout(90_000);
    await openMap(page, "/demo-samoa/app");
    await openMapSettings(page);
    await page.getByRole("button", { name: "Show scale bar" }).click();
    await expect(page.locator(".mapboxgl-ctrl-scale")).toBeVisible();
    await page.getByRole("button", { name: "Show scale bar" }).click();
    await expect(page.locator(".mapboxgl-ctrl-scale")).toHaveCount(0);
    await expect(mapLoaded(page)).toBeVisible();
  });

  test("coordinates follow the pointer and can be turned off", async ({ page }) => {
    test.setTimeout(90_000);
    await openMap(page, "/demo-samoa/app");
    await openMapSettings(page);
    await page.getByRole("button", { name: "Show coordinates" }).click();
    const readout = page.getByTestId("map-coordinates");
    await expect(readout).toBeVisible();

    const canvas = page.locator(".mapboxgl-canvas");
    const box = await canvas.boundingBox();
    if (!box) {
      throw new Error("The map canvas has no box");
    }
    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.3);
    await expect.poll(async () => readout.innerText()).toMatch(/-?\d+\.\d{4,}, -?\d+\.\d{4,}/);
    const first = await readout.innerText();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.75);
    await expect.poll(async () => readout.innerText()).not.toBe(first);

    // The settings menu stays open, so clicking the trigger again would close it.
    await page.getByRole("button", { name: "Show coordinates" }).click();
    await expect(readout).toHaveCount(0);
  });

  test("scale and coordinate choices stay on after a reload", async ({ page }) => {
    test.setTimeout(120_000);
    await openMap(page, "/demo-samoa/app");
    await openMapSettings(page);
    await page.getByRole("button", { name: "Show scale bar" }).click();
    await page.getByRole("button", { name: "Show coordinates" }).click();
    await expect(page.locator(".mapboxgl-ctrl-scale")).toBeVisible();
    await expect(page.getByTestId("map-coordinates")).toBeVisible();

    await reloadMap(page);
    await expect(page.locator(".mapboxgl-ctrl-scale")).toBeVisible();
    await expect(page.getByTestId("map-coordinates")).toBeVisible();
  });

  test("the scale bar follows the project default when nothing is saved", async ({
    page,
    request,
  }) => {
    test.setTimeout(150_000);
    const off = await createShellProject(request, {
      name: "Scale Off",
      slug: projectSlug("off"),
      patch: { showScalebarByDefault: false },
    });
    created.push(off.slug);
    await openMap(page, `/${off.slug}/app`);
    await expect(page.locator(".mapboxgl-ctrl-scale")).toHaveCount(0);

    const on = await createShellProject(request, {
      name: "Scale On",
      slug: projectSlug("on"),
      patch: { showScalebarByDefault: true },
    });
    created.push(on.slug);
    await openMap(page, `/${on.slug}/app`);
    await expect(page.locator(".mapboxgl-ctrl-scale")).toBeVisible();
  });

  test("Measure reports kilometers, miles, and then clears the line", async ({ page }) => {
    test.setTimeout(90_000);
    await openMap(page, "/demo-samoa/app");
    await openMapSettings(page);
    await page.getByRole("button", { name: "Measure" }).click();
    await expect(page.getByText("Click on the map to start measuring.")).toBeVisible();

    const canvas = page.locator(".mapboxgl-canvas");
    const box = await canvas.boundingBox();
    if (!box) {
      throw new Error("The map canvas has no box");
    }
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.35);
    await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.7);

    const length = page.getByTestId("measure-length");
    await expect.poll(async () => distance(await length.innerText())).toBeGreaterThan(1);
    const kilometers = distance(await length.innerText());
    await expect(length).toContainText("kilometers");

    await page.getByRole("combobox", { name: "Distance units" }).selectOption("mi");
    await expect(length).toContainText("miles");
    await expect.poll(async () => distance(await length.innerText())).toBeLessThan(kilometers * 0.8);

    await page.getByRole("button", { name: "close" }).click();
    await expect(length).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const map = (
            window as unknown as {
              mapContext?: {
                map?: {
                  querySourceFeatures: (
                    id: string
                  ) => { geometry: { type: string; coordinates?: number[][] } }[];
                };
              };
            }
          ).mapContext?.map;
          const features = map?.querySourceFeatures("__measure-lines") ?? [];
          return features.every((feature) => {
            const coordinates =
              feature.geometry.type === "LineString" ? feature.geometry.coordinates ?? [] : [];
            return coordinates.length < 2;
          });
        })
      )
      .toBe(true);
  });

  test("turning a layer on lists it in the legend, and the legend can be hidden", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openMap(page, "/demo-samoa/app");
    await turnOnEez(page);
    await expect(legend(page)).toHaveAttribute("data-legend-restored", "true");

    const item = legendItem(page, "Exclusive Economic Zone");
    if ((await legend(page).getAttribute("data-legend-collapsed")) === "true") {
      await toggleLegend(page);
    }
    await expect(item).toBeVisible();

    await toggleLegend(page);
    await expect(item).toBeHidden();
    await toggleLegend(page);
    await expect(item).toBeVisible();
  });

  test("the legend starts open or collapsed from the project default", async ({
    page,
    request,
  }) => {
    test.setTimeout(150_000);
    await openMap(page, "/demo-samoa/app");
    await turnOnEez(page);
    await expect(legend(page)).toHaveAttribute("data-legend-restored", "true");
    await expect(legend(page)).toHaveAttribute("data-legend-collapsed", "true");
    await expect(legendItem(page, "Exclusive Economic Zone")).toBeHidden();

    const project = await createShellProject(request, {
      name: "Legend On",
      slug: projectSlug("leg"),
      patch: { showLegendByDefault: true },
    });
    created.push(project.slug);
    await addLegendLayer(request, project.id, "Legend Fill");
    await openMap(page, `/${project.slug}/app`);
    await visibleButton(page, "Overlay Layers").click();
    const layer = page.getByRole("checkbox", { name: "Legend Fill" });
    await layer.click();
    await expect(layer).toBeChecked();
    await expect(legend(page)).toHaveAttribute("data-legend-restored", "true");
    await expect(legend(page)).toHaveAttribute("data-legend-collapsed", "false");
    await expect(legendItem(page, "Legend Fill")).toBeVisible();
  });

  test("a forum map bookmark restores the camera, basemap, and banner", async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);
    await signIn(page, request, personas.admin);
    await openMap(page, "/demo-samoa/app");
    const saved = { lng: -172.1, lat: -13.85, zoom: 7 };
    await jumpTo(page, saved);
    await visibleButton(page, "Maps").click();
    await page.getByRole("button", { name: "Satellite", exact: true }).click();
    await expect(basemapSwatch(page, "Satellite")).toHaveClass(/ring-blue-500/);

    await visibleButton(page, "Discussion Forums").click();
    await page.getByRole("heading", { name: "Public Forum", level: 3 }).click();
    await page.getByRole("link", { name: /Welcome to the project/ }).click();
    await page.locator(".ProseMirror").click();
    await visibleButton(page, /^Share( content)?$/).click();
    await page.getByRole("menuitem", { name: "Map Bookmark" }).click();
    const draft = page.getByRole("img", { name: "Bookmark preview thumbnail" });
    await expect(draft).toBeVisible({ timeout: 30_000 });
    const reply = `The harbor looks like this ${Date.now()}.`;
    await page.locator(".ProseMirror").click();
    await page.keyboard.type(reply);
    await page.getByRole("button", { name: "Post Reply" }).click();
    const posted = page.locator("[id^='post-']").filter({ hasText: reply });
    const thumb = posted.getByRole("img", { name: "Bookmark preview thumbnail" });
    await expect(thumb).toBeVisible();

    await visibleButton(page, "Maps").click();
    await page.getByRole("button", { name: "Light", exact: true }).click();
    await expect(basemapSwatch(page, "Light")).toHaveClass(/ring-blue-500/);
    await jumpTo(page, { lng: 0, lat: 0, zoom: 2 });

    // The toolbar opens the forum the visitor already has open, which is this topic.
    await visibleButton(page, "Discussion Forums").click();
    await posted.getByRole("img", { name: "Bookmark preview thumbnail" }).click({
      position: { x: 8, y: 8 },
    });

    await expect(page.getByText("Map bookmark shown")).toBeVisible();
    await expect
      .poll(
        async () => {
          const next = await camera(page);
          if (!next) {
            return 999;
          }
          return Math.hypot(next.lng - saved.lng, next.lat - saved.lat) + Math.abs(next.zoom - saved.zoom);
        },
        { timeout: 15_000 }
      )
      .toBeLessThan(0.5);
    await visibleButton(page, "Maps").click();
    await expect(basemapSwatch(page, "Satellite")).toHaveClass(/ring-blue-500/);
  });
});

function distance(text: string) {
  const match = text.match(/-?\d+(?:[.,]\d+)?/);
  if (!match) {
    return 0;
  }
  return Number(match[0].replace(",", "."));
}
