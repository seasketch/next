import { expect, test, type Page } from "@playwright/test";
import { personas } from "../src/config";
import { hardDeleteProject } from "../src/db";
import { createShellProject } from "../src/shellProject";
import { openMap, reloadMap, signIn, visibleButton } from "../src/project";

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

async function expandToolbar(page: Page) {
  const expand = page.getByRole("button", { name: "Expand Navigation" });
  if (await expand.isVisible()) {
    await expand.click();
  }
  await expect(page.getByRole("button", { name: "Collapse Navigation" })).toBeVisible();
}

/**
 * Auth0 would send the browser to the tenant and then to `returnTo`. The
 * suite follows that return address itself, so the assertion is where
 * sign-out lands and not whether the tenant answers.
 */
async function followLogoutReturn(page: Page) {
  await page.route(/\/v2\/logout/, async (route) => {
    const returnTo = new URL(route.request().url()).searchParams.get("returnTo") ?? "/";
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: `<!doctype html><script>location.replace(${JSON.stringify(returnTo)})</script>`,
    });
  });
}

test.describe("sign in and sign out @enduser @session", () => {
  test("an anonymous visitor sees Sign In, and signing out returns them to the same project", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    await openMap(page, "/demo-samoa/app");
    await expect(visibleButton(page, "Sign In")).toBeVisible();

    await signIn(page, request, personas.member);
    await reloadMap(page);
    await expandToolbar(page);
    await expect(page.getByText(personas.member.email)).toBeVisible();

    // Known product bug: sign-out sends every visitor to the homepage.
    await followLogoutReturn(page);
    await page.getByRole("button", { name: "Sign Out" }).click();
    await expect(page).toHaveURL(/\/demo-samoa/);
    await expect(visibleButton(page, "Sign In")).toBeVisible();
  });

  test("signing out leaves a private unlisted project", async ({ page, request }) => {
    test.setTimeout(120_000);
    const project = await createShellProject(request, {
      name: "Private Shell",
      slug: projectSlug("priv"),
      accessControl: "ADMINS_ONLY",
      isListed: false,
    });
    created.push(project.slug);

    await signIn(page, request, personas.admin);
    await openMap(page, `/${project.slug}/app`);
    await expandToolbar(page);
    await followLogoutReturn(page);
    await page.getByRole("button", { name: "Sign Out" }).click();
    await expect(page).not.toHaveURL(new RegExp(`/${project.slug}`));
  });
});
