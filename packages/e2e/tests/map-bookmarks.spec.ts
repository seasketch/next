import { expect, test } from "@playwright/test";
import { personas } from "../src/config";
import { openMap, signIn, visibleButton } from "../src/project";

test.describe("demo-samoa map bookmarks @enduser @forums", () => {
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
    // Scope it to the composer so older replies on the topic are not included.
    const composer = page.locator("div.p-4.mb-20").filter({
      has: page.getByRole("button", { name: "Post Reply" }),
    });
    const draft = composer.getByRole("img", { name: "Bookmark preview thumbnail" });
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

    await posted.locator("button[aria-label='Map bookmark']").click();

    const card = page.getByRole("dialog");
    await expect(
      card.getByRole("heading", { name: /posted this map bookmark to/ })
    ).toBeVisible();
    await expect(
      card.getByRole("link", { name: "Welcome to the project" })
    ).toBeVisible();
    await expect(
      card.getByRole("button", { name: "Display on the map" })
    ).toBeVisible();
    // The card shows the client thumbnail immediately, as a data URL, while
    // the screenshot job is still running. The finished capture is the image
    // served from bookmark storage.
    const full = page.locator("#overlay-body img[src*='bookmark-images/']");
    await expect(full).toBeVisible({ timeout: 90_000 });
    await expect(full).toHaveAttribute(
      "src",
      /\/e2e\/bookmark-images\/[^/]+\/public$/
    );
    await expect
      .poll(
        async () =>
          full.evaluate(
            (img: HTMLImageElement) => img.complete && img.naturalWidth > 0
          ),
        { timeout: 30_000 }
      )
      .toBe(true);
    await expect(page.getByText("The preview could not be created.")).toHaveCount(0);
    await expect(page.getByText("Rendering map image…")).toHaveCount(0);
  });
});
