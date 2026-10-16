import { expect, test } from "@playwright/test";
import { isMapboxGlStyle, waitForMapboxStyle } from "../src/project";

test.describe("homepage", () => {
  test("an anonymous visitor can open Demo Samoa from the project list", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    await expect(
      page.getByRole("banner").getByText("SeaSketch", { exact: true })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
    await page.locator("#nav-projects").click();

    await expect(page).toHaveURL(/\/projects$/);
    const style = waitForMapboxStyle(page);
    await page.getByRole("link", { name: /Demo Samoa/ }).click();

    expect(isMapboxGlStyle(await style)).toBe(true);
    await expect(page).toHaveURL(/\/demo-samoa\/app/);
    await expect(page.locator(".mapboxgl-map[data-map-loaded='true']")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  });
});