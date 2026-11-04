import { expect, test } from "@playwright/test";
import { personas } from "../src/config";
import { clearProjectChangeLogs, seedProjectChangeLogs } from "../src/db";
import { signIn } from "../src/project";

test.describe("demo-samoa layer list changelog", () => {
  test.afterAll(async () => {
    await clearProjectChangeLogs("demo-samoa");
  });

  test("an admin pages through the full history, newest first, without net-zero entries", async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    await seedProjectChangeLogs("demo-samoa", { count: 130, netZeroCount: 3 });
    await signIn(page, request, personas.admin);
    await page.goto("/demo-samoa/admin/data");
    await page.getByText("Overlay Layers", { exact: true }).click();
    await page.getByRole("menuitem", { name: "View" }).click();
    await page.getByRole("menuitemradio", { name: "Changelog" }).click();
    await expect(page).toHaveURL(/\/demo-samoa\/admin\/data\/changelog/);

    const list = page.locator("[data-changelog-list]");
    await expect(
      page.getByText("published 3 layers to project users")
    ).toBeVisible();

    // The list is windowed, so older pages are not all in the DOM. The count
    // attribute is the number of loaded entries, excluding net-zero rows.
    await expect(async () => {
      const count = await list.getAttribute("data-changelog-count");
      if (count !== "130") {
        await list.evaluate((element) => {
          element.scrollTop = element.scrollHeight;
        });
        await page.getByRole("button", { name: "Load older changes" }).click();
      }
      await expect(list).toHaveAttribute("data-changelog-count", "130");
    }).toPass({ timeout: 60_000 });

    await expect(async () => {
      await list.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      await expect(
        page.getByRole("button", { name: "Load older changes" })
      ).toHaveCount(0);
      await expect(
        page.getByText("The changelog feature was introduced on")
      ).toBeVisible();
    }).toPass();

    await page.getByRole("button", { name: "Back to layer list" }).click();
    await expect(page).toHaveURL(/\/demo-samoa\/admin\/data$/);
  });
});
