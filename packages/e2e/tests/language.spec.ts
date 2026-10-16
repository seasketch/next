import { expect, test } from "@playwright/test";
import { visibleButton } from "../src/project";

const samoanForums = "Fa'atalanoaga Lautele";

test.describe("demo-samoa language", () => {
  test("an anonymous visitor can switch the project between English and Samoan", async ({
    page,
  }) => {
    await page.goto("/demo-samoa/app");
    await expect(visibleButton(page, "Discussion Forums")).toBeVisible();

    await visibleButton(page, "English").click();
    const dialog = page.getByRole("dialog", { name: "Select a language" });
    await expect(dialog.getByRole("button", { name: /English/ })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Samoan/ })).toBeVisible();
    await dialog.getByRole("button", { name: /Samoan/ }).click();

    await expect(visibleButton(page, samoanForums)).toBeVisible();

    await visibleButton(page, "Samoan").click();
    await page.getByRole("dialog").getByRole("button", { name: /English/ }).click();
    await expect(visibleButton(page, "Discussion Forums")).toBeVisible();
  });
});
