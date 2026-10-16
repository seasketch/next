import { expect, test } from "@playwright/test";
import { personas } from "../src/config";
import { signIn, visibleNavLink } from "../src/project";

test.describe("demo-samoa project admin", () => {
  test("an admin can open the seeded data, geography, sketch class, and report", async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    await signIn(page, request, personas.admin);
    await page.goto("/demo-samoa");
    await page.getByRole("button", { name: "Project Admin Dashboard" }).click();
    await expect(page).toHaveURL(/\/demo-samoa\/admin/);

    await visibleNavLink(page, "Data Layers").click();
    await expect(page).toHaveURL(/\/demo-samoa\/admin\/data/);
    await page.getByText("Overlay Layers", { exact: true }).click();
    const folder = page.getByRole("treeitem", { name: "Geography layers" });
    await expect(folder).toBeVisible();
    await folder.getByRole("button", { name: "Expand" }).click();
    await expect(page.getByRole("treeitem", { name: "Exclusive Economic Zone" })).toBeVisible();
    await expect(page.getByRole("treeitem", { name: "Land" })).toBeVisible();
    await expect(page.getByRole("treeitem", { name: "Territorial Seas" })).toBeVisible();

    await visibleNavLink(page, "Geography").click();
    await expect(page).toHaveURL(/\/demo-samoa\/admin\/geography/);
    await expect(page.getByText("Exclusive Economic Zone").first()).toBeVisible();
    await expect(page.getByText("Territorial Seas").first()).toBeVisible();
    await expect(page.getByText("Offshore").first()).toBeVisible();

    await visibleNavLink(page, "Sketch Classes").click();
    await expect(page).toHaveURL(/\/demo-samoa\/admin\/sketching/);
    await expect(visibleNavLink(page, "Marine Protected Area")).toBeVisible();

    await visibleNavLink(page, "Reports").click();
    await expect(page).toHaveURL(/\/demo-samoa\/admin\/reports/);
    await expect(visibleNavLink(page, "Default report")).toBeVisible();
  });
});
