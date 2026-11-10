import { expect, Page, test } from "@playwright/test";
import { hardDeleteProject } from "../src/db";
import {
  addFolder,
  addGeojsonLayer,
  createOverlayProject,
  publishAllOverlays,
} from "../src/overlayProject";
import { personas } from "../src/config";
import { openMap, signIn } from "../src/project";

const created: string[] = [];

test.afterEach(async () => {
  for (const slug of created.splice(0)) {
    await hardDeleteProject(slug);
  }
});

function slug(label: string) {
  return `e2e-${label}-${Date.now().toString(36)}`.slice(0, 24);
}

async function openOverlayAdmin(page: Page, projectSlug: string) {
  await page.goto(`/${projectSlug}/admin/data`);
  await page.getByText("Overlay Layers", { exact: true }).click();
}

async function renameLayer(page: Page, from: string, to: string) {
  // The treeitem row stretches across the panel. Click the title, which is the
  // context-menu trigger, rather than the middle of that row.
  await page
    .getByRole("treeitem", { name: from, exact: true })
    .locator("label")
    .click({ button: "right" });
  await page
    .locator(".ToCMenuContent")
    .getByRole("menuitem", { name: "Edit", exact: true })
    .click();
  // The title label is not wired to the input's accessible name.
  await page.locator('input[name="title"]').fill(to);
  await expect(page.getByRole("treeitem", { name: to, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close layer editor" }).click();
}

async function openSelectivePublish(page: Page) {
  await page.getByRole("button", { name: "More publish options" }).click();
  await page.getByRole("menuitem", { name: /Selective publish/ }).click();
  return page.getByRole("dialog", { name: "Selective publish" });
}

test.describe("selective overlay publish", () => {
  test("an admin publishes one renamed layer and leaves the other for a later publish", async ({
    page,
    request,
    browser,
  }) => {
    test.setTimeout(120_000);
    const projectSlug = slug("one");
    created.push(projectSlug);
    const project = await createOverlayProject(request, "Selective publish", projectSlug);
    await addGeojsonLayer(request, project.token, project.id, "Coral");
    await addGeojsonLayer(request, project.token, project.id, "Reef");
    await publishAllOverlays(request, project.token, project.id);

    await signIn(page, request, personas.admin);
    await openOverlayAdmin(page, projectSlug);
    await renameLayer(page, "Coral", "Coral Reefs");
    await renameLayer(page, "Reef", "Deep Reef");

    const selective = await openSelectivePublish(page);
    await expect(selective.getByRole("checkbox", { name: "Coral Reefs", exact: true })).toBeChecked();
    await expect(selective.getByRole("checkbox", { name: "Deep Reef", exact: true })).toBeChecked();
    await selective.getByRole("checkbox", { name: "Deep Reef", exact: true }).uncheck();
    await selective.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(selective).toBeHidden();

    const visitor = await browser.newPage();
    try {
      await openMap(visitor, `/${projectSlug}/app`);
      await visitor.getByRole("button", { name: "Overlay Layers" }).click();
      await expect(visitor.getByRole("treeitem", { name: "Coral Reefs", exact: true })).toBeVisible();
      await expect(visitor.getByRole("treeitem", { name: "Reef", exact: true })).toBeVisible();
      await expect(visitor.getByRole("treeitem", { name: "Deep Reef", exact: true })).toHaveCount(0);
    } finally {
      await visitor.close();
    }

    await page.locator("#publish-button").click();
    const full = page.getByRole("dialog", { name: "Publish Overlays" });
    // The summarized tab stays on its spinner until ChangeLogsSinceLastPublish
    // returns. Under a full smoke run that query can take longer than the
    // default 5s expect, while the dialog itself is already open.
    await expect(full.getByText("Deep Reef", { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(full.getByText("Coral Reefs", { exact: true })).toHaveCount(0);
    // A click during the dialog's enter transition can be dropped.
    await expect(async () => {
      await full.getByRole("tab", { name: "All Changes" }).click();
      await expect(full.getByText("changed title from")).toBeVisible({
        timeout: 2000,
      });
    }).toPass();
    // The new title is both the row heading and the "to" chip.
    await expect(full.getByText("Deep Reef", { exact: true }).first()).toBeVisible();
    await expect(full.getByText("Coral Reefs", { exact: true })).toHaveCount(0);
    await full.getByRole("button", { name: "Cancel" }).click();
  });

  test("checking a new layer includes the new folder it was created in", async ({
    page,
    request,
    browser,
  }) => {
    test.setTimeout(120_000);
    const projectSlug = slug("nest");
    created.push(projectSlug);
    const project = await createOverlayProject(request, "Nested publish", projectSlug);
    const habitats = await addFolder(request, project.token, project.id, "Habitats");
    await addGeojsonLayer(request, project.token, project.id, "Coral", habitats);

    await signIn(page, request, personas.admin);
    await openOverlayAdmin(page, projectSlug);
    const selective = await openSelectivePublish(page);
    await expect(selective.getByRole("checkbox", { name: "Habitats", exact: true })).toBeChecked();
    await expect(selective.getByRole("checkbox", { name: "Coral", exact: true })).toBeChecked();

    await selective.getByRole("checkbox", { name: "Habitats", exact: true }).uncheck();
    await expect(selective.getByRole("checkbox", { name: "Coral", exact: true })).not.toBeChecked();

    await selective.getByRole("checkbox", { name: "Coral", exact: true }).check();
    await expect(selective.getByRole("checkbox", { name: "Habitats", exact: true })).toHaveCount(0);
    await expect(selective.getByText("Habitats", { exact: true })).toHaveCount(1);
    const together = selective.getByRole("button", {
      name: /Must be published with (Habitats, Coral|Coral, Habitats)/,
    });
    await expect(together).toHaveCount(2);
    await together.first().hover();
    const tooltip = page.getByRole("tooltip");
    await expect(tooltip).toContainText("Must be published together");
    await expect(tooltip).toContainText("Habitats");
    await expect(tooltip).toContainText("Coral");
    await selective.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(selective).toBeHidden();

    const visitor = await browser.newPage();
    try {
      await openMap(visitor, `/${projectSlug}/app`);
      await visitor.getByRole("button", { name: "Overlay Layers" }).click();
      const folder = visitor.getByRole("treeitem", { name: "Habitats", exact: true });
      await expect(folder).toBeVisible();
      await folder.getByRole("button", { name: "Expand" }).click();
      await expect(visitor.getByRole("treeitem", { name: "Coral", exact: true })).toBeVisible();
    } finally {
      await visitor.close();
    }
  });
});
