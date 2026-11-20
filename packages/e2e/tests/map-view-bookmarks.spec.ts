import { Client } from "pg";
import { expect, test, type Page } from "@playwright/test";
import { databaseURL, personas } from "../src/config";
import { graphql } from "../src/graphql";
import { openMap, signIn, visibleButton } from "../src/project";

async function nameAdmin(fullname: string) {
  const client = new Client({ connectionString: databaseURL });
  await client.connect();
  try {
    await client.query(
      `update user_profiles set fullname = $1 where user_id = (select id from users where sub = 'e2e|admin')`,
      [fullname]
    );
  } finally {
    await client.end();
  }
}

// The first style document after the dev server boots can take longer than
// the shared 30s wait. A second navigation uses the warm connection.
async function openProjectMap(page: Page) {
  try {
    await openMap(page, "/demo-samoa/app");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("Mapbox GL style")) {
      throw error;
    }
    await openMap(page, "/demo-samoa/app");
  }
}

test.describe("map view bookmarks @enduser @map", () => {
  test("Create Map Bookmark saves the view and offers a copyable link", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    await nameAdmin("Test Admin");
    const issued = await signIn(page, request, personas.admin);
    await openProjectMap(page);

    await visibleButton(page, "Overlay Layers").click();
    const folder = page.getByRole("treeitem", { name: "Geography layers" });
    await expect(folder).toBeVisible();
    await folder.getByRole("button", { name: "Expand" }).click();
    const eez = page.getByRole("checkbox", { name: "Exclusive Economic Zone" });
    await eez.click();
    await expect(eez).toBeChecked();

    await page.getByRole("button", { name: "Map settings" }).click();
    await page.getByRole("button", { name: "Create Map Bookmark" }).click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: /Test Admin created this map bookmark on/ })
    ).toBeVisible();
    await expect(dialog.getByText("Sharing this link")).toBeVisible();
    await expect(
      dialog.getByText("private to your account")
    ).toHaveCount(0);

    const link = dialog.getByRole("textbox", { name: "Link" });
    await expect(link).toBeVisible({ timeout: 30_000 });
    await expect(link).toHaveValue(/\/demo-samoa\/bookmarks\/[0-9a-f-]{36}$/);
    await dialog.getByRole("button", { name: /^Layers \(/ }).click();
    await dialog.getByRole("button", { name: "Details" }).click();
    await expect(dialog.getByText("Exclusive Economic Zone")).toBeVisible();
    await expect(dialog.getByText("Basemap")).toBeVisible();
    const url = await link.inputValue();
    const bookmarkId = url.split("/").pop();

    await dialog.getByRole("button", { name: "Copy" }).click();
    await expect(dialog.getByText("Copied")).toBeVisible();

    const saved = await graphql<{
      bookmarkById: {
        kind: string;
        isPublic: boolean;
        postId: number | null;
        visibleSketches: number[] | null;
        visibleDataLayers: string[];
      };
    }>(
      request,
      issued.accessToken,
      `query($id: UUID!) {
        bookmarkById(id: $id) {
          kind
          isPublic
          postId
          visibleSketches
          visibleDataLayers
        }
      }`,
      { id: bookmarkId }
    );
    expect(saved.bookmarkById.kind).toBe("MAP_VIEW");
    expect(saved.bookmarkById.isPublic).toBe(true);
    expect(saved.bookmarkById.postId).toBeNull();
    expect(saved.bookmarkById.visibleSketches ?? []).toEqual([]);
    expect(saved.bookmarkById.visibleDataLayers.length).toBeGreaterThan(0);

    await page.goto(url);
    const viewing = page.getByRole("dialog");
    await expect(
      viewing.getByRole("heading", { name: /Test Admin created this map bookmark on/ })
    ).toBeVisible();
    await expect(viewing.getByText("Sharing this link")).toHaveCount(0);
    await viewing.getByRole("button", { name: /^Layers \(/ }).click();
    await expect(viewing.getByText("Exclusive Economic Zone")).toBeVisible();
    await expect(viewing.getByText("missing")).toHaveCount(0);
    await expect(viewing.getByText("no longer in the project")).toHaveCount(0);
  });

  test("sketches on the map are called out and left out of the saved style", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    const issued = await signIn(page, request, personas.admin);
    await openProjectMap(page);

    await page.evaluate(() => {
      const manager = (
        window as unknown as {
          mapContext?: {
            setVisibleSketches: (
              sketches: { id: number; sketchClassId: number }[]
            ) => void;
          };
        }
      ).mapContext;
      manager?.setVisibleSketches([{ id: 999001, sketchClassId: 1 }]);
    });

    await page.getByRole("button", { name: "Map settings" }).click();
    await page.getByRole("button", { name: "Create Map Bookmark" }).click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByText(
        "Sketches currently on screen are private to your account, and so are not included in the bookmark."
      )
    ).toBeVisible();

    const link = dialog.getByRole("textbox", { name: "Link" });
    await expect(link).toBeVisible({ timeout: 30_000 });
    const bookmarkId = (await link.inputValue()).split("/").pop();
    const saved = await graphql<{
      bookmarkById: { style: unknown; visibleSketches: number[] | null };
    }>(
      request,
      issued.accessToken,
      `query($id: UUID!) {
        bookmarkById(id: $id) {
          style
          visibleSketches
        }
      }`,
      { id: bookmarkId }
    );
    expect(saved.bookmarkById.visibleSketches ?? []).toEqual([]);
    expect(JSON.stringify(saved.bookmarkById.style)).not.toContain(
      "sketch-999001"
    );
  });
});
