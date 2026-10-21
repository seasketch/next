import { expect, test } from "@playwright/test";
import { personas } from "../src/config";
import { openMap, signIn, visibleButton } from "../src/project";

test.describe("demo-samoa map bookmarks", () => {
  test("a participant posts a map bookmark and can view both images", async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);
    await signIn(page, request, personas.admin);
    await openMap(page, "/demo-samoa/app");
    await visibleButton(page, "Discussion Forums").click();
    await page.getByRole("heading", { name: "Public Forum", level: 3 }).click();
    await page.getByRole("link", { name: /Welcome to the project/ }).click();

    await page.locator(".ProseMirror").click();
    await visibleButton(page, /^Share( content)?$/).click();
    await page.getByRole("menuitem", { name: "Map Bookmark" }).click();

    // The thumbnail is drawn under the reply text, outside the ProseMirror node.
    const draft = page.getByRole("img", { name: "Bookmark preview thumbnail" });
    await expect(draft).toBeVisible({ timeout: 30_000 });
    await expect(draft).toHaveAttribute("src", /^data:image\//);

    const reply = "The map looks like this.";
    await page.locator(".ProseMirror").click();
    await page.keyboard.type(reply);
    await page.getByRole("button", { name: "Post Reply" }).click();

    const posted = page.locator("[id^='post-']").filter({ hasText: reply });
    const postedThumb = posted.getByRole("img", {
      name: "Bookmark preview thumbnail",
    });
    await expect(postedThumb).toBeVisible();
    await expect(postedThumb).toHaveAttribute("src", /^data:image\//);

    await postedThumb.locator("xpath=ancestor::button[1]").locator("button").click();

    await expect(
      page.getByRole("heading", { name: "Map Bookmark Details" })
    ).toBeVisible();
    const full = page.locator("#overlay-body img");
    await expect(full).toBeVisible({ timeout: 90_000 });
    await expect(full).toHaveAttribute(
      "src",
      /\/e2e\/bookmark-images\/[^/]+\/public$/
    );
    await expect
      .poll(async () =>
        full.evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0
        )
      )
      .toBe(true);
    await expect(
      page.getByText(
        "An unknown error prevented this map from being captured when the bookmark was created."
      )
    ).toHaveCount(0);
  });
});
