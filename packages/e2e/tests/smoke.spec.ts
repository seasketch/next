import { expect, test } from "@playwright/test";
import { personas } from "../src/config";
import { openMap, signIn, visibleNavLink } from "../src/project";

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
