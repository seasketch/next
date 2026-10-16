import { expect, test } from "@playwright/test";
import { personas } from "../src/config";
import { signIn, visibleButton } from "../src/project";

test.describe("new forum topic title", () => {
  test("the composer explains the title limit before posting", async ({ page, request }) => {
    test.setTimeout(120_000);
    await signIn(page, request, personas.admin);
    await page.goto("/demo-samoa/app");
    await visibleButton(page, "Discussion Forums").click();
    await page.getByRole("heading", { name: "Public Forum", level: 3 }).click();
    await visibleButton(page, "Post a topic").click();

    const title = page.getByRole("textbox", { name: "Topic title" });
    await expect(title).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByText(/\/80/)).toHaveCount(0);

    await title.fill("Coastal update");
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(visibleButton(page, "Post New Topic")).toBeEnabled();

    const emojiLimit = "👍".repeat(80);
    await title.fill(emojiLimit);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(visibleButton(page, "Post New Topic")).toBeEnabled();

    await title.fill(`${emojiLimit}👍`);
    await expect(page.getByRole("alert")).toHaveText(
      "Titles must be 80 characters or fewer. This title is 81 characters."
    );
    await expect(page.getByText(/\/80/)).toHaveCount(0);
    await expect(visibleButton(page, "Post New Topic")).toBeDisabled();

    await title.fill("");
    await visibleButton(page, "Post New Topic").click();
    await expect(page.getByRole("alert").filter({ hasText: "Enter a title." })).toBeVisible();

    const postedTitle = "Coastal update";
    await title.fill(postedTitle);
    await visibleButton(page, "Post New Topic").click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Write a message before posting." })
    ).toBeVisible();

    await page.locator(".ProseMirror").click();
    await page.keyboard.type("A short note about the new coastal data.");
    await visibleButton(page, "Post New Topic").click();

    await expect(page).toHaveURL(/\/demo-samoa\/app\/forums\/\d+\/\d+/);
    await expect(page.getByRole("heading", { name: postedTitle })).toBeVisible();
    await expect(page.getByText("A short note about the new coastal data.")).toBeVisible();
  });
});
