import { expect, test } from "@playwright/test";
import { openMap, visibleButton } from "../src/project";

test.describe("demo-samoa overlay layers", () => {
  test("an anonymous visitor can browse, toggle, and read geography layers", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openMap(page, "/demo-samoa/app");
    await visibleButton(page, "Overlay Layers").click();

    const folder = page.getByRole("treeitem", { name: "Geography layers" });
    await expect(folder).toBeVisible();
    await folder.getByRole("button", { name: "Expand" }).click();
    await expect(page.getByRole("treeitem", { name: "Exclusive Economic Zone" })).toBeVisible();
    await expect(page.getByRole("treeitem", { name: "Land" })).toBeVisible();
    await expect(page.getByRole("treeitem", { name: "Territorial Seas" })).toBeVisible();

    const eez = page.getByRole("checkbox", { name: "Exclusive Economic Zone" });
    await eez.click();
    await expect(eez).toBeChecked();

    await page.getByRole("button", { name: "Legend" }).click();
    const legendItem = page
      .locator('li[id^="legend-item-"]')
      .filter({ hasText: "Exclusive Economic Zone" });
    await expect(legendItem).toBeVisible();

    await eez.click();
    await expect(eez).not.toBeChecked();
    await expect(legendItem).toHaveCount(0);

    await page
      .getByRole("treeitem", { name: "Exclusive Economic Zone" })
      .click({ button: "right" });
    await page.getByRole("menuitem", { name: "View metadata" }).click();
    await expect(
      page.getByText("Exclusive economic zones joined to land, from Marine Regions.")
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByPlaceholder("search layers").fill("Territorial");
    await expect(page.locator("label", { hasText: "Territorial Seas" })).toBeVisible();
    await expect(page.locator("label", { hasText: /^Land$/ })).toHaveCount(0);
  });
});
