import { expect, test, type APIRequestContext, type Page, type Response } from "@playwright/test";
import { installSession, issueToken } from "../src/auth";
import { personas } from "../src/config";

test.describe("smoke @smoke", () => {
  test("an anonymous visitor opens the public project and sees the map", async ({
    page,
  }) => {
    await openMap(page, "/demo-samoa");
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);

    await page.goto("/demo-samoa/admin");
    await expect(page).not.toHaveURL(/\/admin/);
    await expect(page.getByText("Users & Groups")).toHaveCount(0);
  });

  test("a signed-in member opens a private project their group can access", async ({
    page,
    request,
    browser,
  }) => {
    const anon = await browser.newPage();
    try {
      await anon.goto("/e2e-private");
      await expect(anon.getByRole("heading", { name: "Private Project" })).toBeVisible();
      await expect(anon.locator(".mapboxgl-map")).toHaveCount(0);
    } finally {
      await anon.close();
    }

    await signIn(page, request, personas.member);
    await page.goto("/e2e-private");
    await expect(
      page.getByRole("button", { name: "Project Admin Dashboard" })
    ).toHaveCount(0);

    await page
      .getByRole("button", { name: "Discussion Forums" })
      .filter({ visible: true })
      .first()
      .click();
    await expect(page.getByRole("heading", { name: "Members Forum" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Admins Forum" })).toHaveCount(0);

    await page.goto("/e2e-private/admin");
    await expect(page).not.toHaveURL(/\/admin/);
    await expect(page.getByText("Users & Groups")).toHaveCount(0);
  });

  test("a project admin opens their project and navigates to the admin page", async ({
    page,
    request,
  }) => {
    await signIn(page, request, personas.admin);
    await page.goto("/demo-samoa");
    await page.getByRole("button", { name: "Project Admin Dashboard" }).click();
    await expect(visibleNavLink(page, "Users & Groups")).toBeVisible();
    await expect(visibleNavLink(page, "Data Layers")).toBeVisible();
    await expect(page).toHaveURL(/\/demo-samoa\/admin/);
  });
});

async function signIn(
  page: Page,
  request: APIRequestContext,
  persona: (typeof personas)[keyof typeof personas]
) {
  const issued = await issueToken(request, persona);
  await installSession(page.context(), issued);
  return issued;
}

/** Desktop and the closed mobile drawer both render the same nav link. */
function visibleNavLink(page: Page, name: string) {
  return page.getByRole("link", { name }).filter({ visible: true }).first();
}

/**
 * A Mapbox GL style document: version 8, with sources and at least one layer.
 * This is the same check the client uses before it will install a basemap.
 */
function isMapboxGlStyle(value: unknown): boolean {
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
function waitForMapboxStyle(page: Page): Promise<unknown> {
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
async function openMap(page: Page, path: string) {
  const style = waitForMapboxStyle(page);
  await page.goto(path);
  expect(isMapboxGlStyle(await style)).toBe(true);
  await expect(page.locator(".mapboxgl-map[data-map-loaded='true']")).toBeVisible({
    timeout: 30_000,
  });
}
