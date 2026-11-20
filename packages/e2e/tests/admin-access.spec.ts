import { expect, test, type Page } from "@playwright/test";
import { createAccessProject } from "../src/accessProject";
import { personas } from "../src/config";
import { hardDeleteProject } from "../src/db";
import { signIn, visibleNavLink } from "../src/project";

const created: string[] = [];

const layerLink =
  "/demo-samoa/admin/data?layerLink=a08be40c-ee04-45c8-9288-8c7e3a55a7e3";

/**
 * Every admin entrance. A visitor who is not an administrator stays on the
 * address they opened and sees the project access gate, not the homepage.
 */
const publicAdminPaths = [
  "/demo-samoa/admin",
  "/demo-samoa/admin/activity",
  "/demo-samoa/admin/users",
  "/demo-samoa/admin/data",
  "/demo-samoa/admin/data?tocItemId=42",
  layerLink,
  "/demo-samoa/admin/geography",
  "/demo-samoa/admin/sketching",
  "/demo-samoa/admin/reports",
  "/demo-samoa/admin/forums",
  "/demo-samoa/admin/surveys",
  "/demo-samoa/survey-editor/1/basic",
  "/demo-samoa/edit-basemap/1?camera=e30&returnToUrl=%2Fdemo-samoa%2Fadmin%2Fdata",
];

test.afterEach(async () => {
  for (const slug of created.splice(0)) {
    await hardDeleteProject(slug);
  }
});

function slug(label: string) {
  return `e2e-${label}-${Date.now().toString(36)}`.slice(0, 24);
}

function gate(page: Page) {
  return page.getByRole("dialog");
}

async function expectStays(page: Page, path: string) {
  await page.goto(path);
  await expect(page).toHaveURL(path);
  await expect(page.getByText("Users & Groups")).toHaveCount(0);
  await expect(page.locator(".mapboxgl-map")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "dismiss" })).toHaveCount(0);
}

async function expectSignIn(page: Page, visible: boolean) {
  const button = gate(page).getByRole("button", { name: "Sign in", exact: true });
  if (visible) {
    await expect(button).toBeVisible();
  } else {
    await expect(button).toHaveCount(0);
  }
}

test.describe("admin area doors @enduser @access", () => {
  test("an anonymous visitor is stopped on every public admin url", async ({ page }) => {
    test.setTimeout(180_000);
    for (const path of publicAdminPaths) {
      await test.step(path, async () => {
        await expectStays(page, path);
        await expect(gate(page).getByRole("heading", { name: "Admins Only" })).toBeVisible();
        await expect(
          gate(page).getByText("limited to project administrators")
        ).toBeVisible();
        await expectSignIn(page, true);
        await expect(
          gate(page).getByRole("button", { name: "Create an account" })
        ).toHaveCount(0);
        await expect(gate(page).locator('a[href^="mailto:"]')).toBeVisible();
      });
    }
  });

  test("a signed-in non-admin is stopped without being asked to sign in", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    await signIn(page, request, personas.member);
    const paths = [
      "/demo-samoa/admin",
      "/demo-samoa/admin/users",
      "/demo-samoa/admin/surveys",
      "/demo-samoa/admin/forums",
      layerLink,
      "/demo-samoa/survey-editor/1",
      "/demo-samoa/edit-basemap/1",
    ];
    for (const path of paths) {
      await test.step(path, async () => {
        await expectStays(page, path);
        await expect(gate(page).getByRole("heading", { name: "Admins Only" })).toBeVisible();
        await expectSignIn(page, false);
        await expect(
          gate(page).getByRole("button", { name: "Create an account" })
        ).toHaveCount(0);
        await expect(
          gate(page).getByRole("button", { name: "Share Profile and Request Access" })
        ).toHaveCount(0);
        await expect(gate(page).locator('a[href^="mailto:"]')).toBeVisible();
      });
    }
  });

  test("a private project uses its own gate and keeps the admin url", async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    const anonPath = "/e2e-private/admin/geography?layerLink=a08be40c-ee04-45c8-9288-8c7e3a55a7e3";
    await expectStays(page, anonPath);
    await expect(gate(page).getByRole("heading", { name: "Private Project" })).toBeVisible();
    await expect(gate(page).getByText("invitation")).toBeVisible();
    await expectSignIn(page, true);
    await expect(
      gate(page).getByRole("button", { name: "Create an account" })
    ).toBeVisible();

    await signIn(page, request, personas.member);
    const memberPath = "/e2e-private/admin/users";
    await expectStays(page, memberPath);
    await expect(gate(page).getByRole("heading", { name: "Admins Only" })).toBeVisible();
    await expectSignIn(page, false);
    await expect(gate(page).locator('a[href^="mailto:"]')).toBeVisible();
  });

  test("an invite-only project asks a signed-in stranger to request access", async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    const project = await createAccessProject(request, {
      name: "Admin Door Invite",
      slug: slug("door"),
      accessControl: "INVITE_ONLY",
      isListed: false,
    });
    created.push(project.slug);

    await signIn(page, request, personas.member);
    const path = `/${project.slug}/admin/reports?from=bookmark`;
    await expectStays(page, path);
    await expect(gate(page).getByRole("heading", { name: "Private Project" })).toBeVisible();
    await expect(
      gate(page).getByRole("button", { name: "Share Profile and Request Access" })
    ).toBeVisible();
    await expectSignIn(page, false);
    await expect(page).toHaveURL(path);
  });

  test("an unknown project admin url says the project was not found", async ({ page }) => {
    await expectStays(page, "/e2e-no-such-project/admin/data");
    await expect(
      gate(page).getByRole("heading", { name: 'Project "e2e-no-such-project" not found.' })
    ).toBeVisible();
    await expect(gate(page).getByRole("link", { name: "list of projects" })).toHaveAttribute(
      "href",
      "/projects"
    );
    await expectSignIn(page, false);
  });

  test("sign in from an admin layer link returns to that same url", async ({ page }) => {
    await page.goto(layerLink);
    await expect(gate(page).getByRole("heading", { name: "Admins Only" })).toBeVisible();
    const returnTo = await captureSignInReturn(page);
    expect(returnTo).toBe(layerLink);
  });

  test("reloading a stable admin url after the session is cleared asks them to sign in", async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    await signIn(page, request, personas.admin);
    await page.goto("/demo-samoa/admin/users");
    await expect(visibleNavLink(page, "Users & Groups")).toBeVisible();
    await expect(gate(page)).toHaveCount(0);
    await dropSession(page);
    await page.reload();
    await expect(page).toHaveURL(/\/demo-samoa\/admin\/users$/);
    await expect(gate(page).getByRole("heading", { name: "Admins Only" })).toBeVisible();
    await expectSignIn(page, true);
    await expect(page.getByText("Users & Groups")).toHaveCount(0);
  });

  test("reloading a rewritten report url after the session is cleared stays there", async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    await signIn(page, request, personas.admin);
    await page.goto("/demo-samoa/admin/reports");
    await expect(page).toHaveURL(/\/demo-samoa\/admin\/reports\/\d+$/);
    const settled = new URL(page.url()).pathname;
    await dropSession(page);
    await page.reload();
    await expect(page).toHaveURL(settled);
    await expect(gate(page).getByRole("heading", { name: "Admins Only" })).toBeVisible();
    await expectSignIn(page, true);
    await expect(page.getByText("Users & Groups")).toHaveCount(0);
  });
});

async function dropSession(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.setItem("e2e-signed-out", "1");
  });
  await page.context().clearCookies();
}

/**
 * Auth0 saves the return path, then navigates to the tenant. Copy that
 * write out of the page as it happens, and do not follow the redirect.
 */
async function captureSignInReturn(page: Page): Promise<string> {
  let stored = "";
  await page.exposeBinding("e2eCaptureAuth", (_source, value: string) => {
    stored = value;
  });
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (String(key).includes("a0.spajs.txs")) {
        void (window as unknown as { e2eCaptureAuth: (value: string) => void }).e2eCaptureAuth(
          String(value)
        );
      }
      return original.call(this, key, value);
    };
  });
  await page.route(/\/authorize/, (route) => route.abort());
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .click({ noWaitAfter: true });
  await expect.poll(() => stored, { timeout: 10_000 }).toContain("returnTo");
  await page.unrouteAll({ behavior: "ignoreErrors" });
  const match = stored.match(/"returnTo":"([^"]+)"/);
  return match ? match[1] : stored;
}
