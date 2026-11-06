import fs from "fs";
import os from "os";
import path from "path";
import { Locator, Page, expect, test } from "@playwright/test";
import { personas } from "../src/config";
import { resetAiCartographerChoice } from "../src/db";
import {
  asAdmin,
  overlapCard,
  uploadOverlay,
  waitForReportingOutputs,
  withDb,
} from "../src/overlays";
import { openMap, signIn } from "../src/project";

/**
 * Local clipping, fragment creation, and overlay metrics, plus a basic
 * data-table import. The layers are uploaded through the admin UI. The
 * report cards are inserted with SQL: this journey is the public view of a
 * sketch, not the report authoring UI. Numeric accuracy is covered by the
 * overlay-engine unit tests.
 */
const seamountsFixture = path.resolve(__dirname, "../fixtures/samoa-seamounts.geojson");
const ebsaFixture = path.resolve(__dirname, "../fixtures/samoa-ebsas.geojson");
const observationsFixture = path.resolve(__dirname, "../fixtures/eez-observations.csv");

async function publishOverlayReport(seamountsStableId: string, ebsaStableId: string) {
  await asAdmin(async (client) => {
    const project = await client.query(`select id from projects where slug = 'demo-samoa'`);
    const projectId = project.rows[0].id as number;
    await client.query(`select publish_table_of_contents($1)`, [projectId]);
    const draft = await client.query(
      `select draft.id as report_id, tab.id as tab_id
       from sketch_classes sc
       join sketch_class_reports scr
         on scr.sketch_class_id = sc.id and scr.is_primary
       join reports draft on draft.id = scr.draft_report_id
       join report_tabs tab on tab.report_id = draft.id
       where sc.project_id = $1
         and sc.name = 'Marine Protected Area'
         and sc.is_template = false
         and draft.version = 0
       order by tab.position
       limit 1`,
      [projectId]
    );
    expect(draft.rowCount, "draft report tab").toBe(1);
    const { report_id: reportId, tab_id: tabId } = draft.rows[0] as {
      report_id: number;
      tab_id: number;
    };
    for (const body of [
      overlapCard("Seamounts", seamountsStableId, "of the seamounts layer."),
      overlapCard("EBSAs", ebsaStableId, "of the EBSA layer."),
    ]) {
      await client.query(`select add_report_card($1, '{}'::jsonb, 'textBlock', $2::jsonb)`, [
        tabId,
        JSON.stringify(body),
      ]);
    }
    await client.query(`select publish_report_snapshot($1)`, [reportId]);
  });
}

async function largestMap(page: Page): Promise<Locator> {
  const maps = page.locator(".mapboxgl-map");
  const count = await maps.count();
  let best = 0;
  let bestArea = 0;
  for (let index = 0; index < count; index++) {
    const box = await maps.nth(index).boundingBox();
    const area = box ? box.width * box.height : 0;
    if (area > bestArea) {
      bestArea = area;
      best = index;
    }
  }
  return maps.nth(best);
}

const sketchSquare: Array<[number, number]> = [
  [0.62, 0.4],
  [0.62, 0.58],
  [0.78, 0.58],
  [0.78, 0.4],
  [0.62, 0.4],
];

test.describe("local reports and data tables", () => {
  test.beforeEach(async () => {
    await resetAiCartographerChoice(personas.admin.sub);
  });

  test("a drawn sketch shows seamount and EBSA overlap from local workers", async ({
    page,
    request,
  }) => {
    test.setTimeout(900_000);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "seasketch-e2e-report-"));
    try {
      const seamountsFile = path.join(dir, `seamounts-${Date.now().toString(36)}.geojson`);
      const ebsaFile = path.join(dir, `ebsas-${Date.now().toString(36)}.geojson`);
      fs.copyFileSync(seamountsFixture, seamountsFile);
      fs.copyFileSync(ebsaFixture, ebsaFile);
      const seamounts = await uploadOverlay(page, request, seamountsFile, 60_000);
      const ebsas = await uploadOverlay(page, request, ebsaFile, 15_000);
      await waitForReportingOutputs([seamounts.dataSourceId, ebsas.dataSourceId]);
      await publishOverlayReport(seamounts.stableId, ebsas.stableId);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    page.setDefaultTimeout(20_000);
    await openMap(page, "/demo-samoa/app");
    await page.getByRole("button", { name: "Sketches" }).click();
    // The sketching toolbar uses the short labels below 1536px. The class
    // name is a menu item, not a button.
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await page.getByRole("menuitem", { name: "Marine Protected Area" }).click();
    await expect(page.getByText("Click on the map to start a polygon")).toBeVisible();

    const map = await largestMap(page);
    const box = await map.boundingBox();
    if (!box) {
      throw new Error("Project map has no box");
    }
    for (const [xFraction, yFraction] of sketchSquare) {
      await page.mouse.click(box.x + box.width * xFraction, box.y + box.height * yFraction);
      await page.waitForTimeout(150);
    }
    await expect(page.getByText("Click to add more points")).toHaveCount(0);
    // Clipping runs when the ring closes. Submit during that step is ignored.
    await expect(page.getByText("Click your sketch to edit geometry")).toBeVisible({
      timeout: 60_000,
    });

    const sketchName = `Local report ${Date.now().toString(36)}`;
    await page.locator(".form-element-short-text input").fill(sketchName);
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByRole("heading", { name: /New Marine Protected Area/ })).toHaveCount(0, {
      timeout: 120_000,
    });

    // Creating a sketch selects it. Clicking the name toggles that selection
    // off, which disables View Attributes.
    const sketchLabel = page.locator("label", { hasText: sketchName });
    await expect(sketchLabel).toBeVisible();
    const viewAttributes = page.getByRole("button", { name: "View Attributes", exact: true });
    const alreadySelected = await viewAttributes.isEnabled();
    if (!alreadySelected) {
      await sketchLabel.click();
    }
    await expect(viewAttributes).toBeEnabled({ timeout: 15_000 });
    await viewAttributes.click();
    // The editor keeps a hidden prose-mirror copy of each card, and layer
    // names also appear in toggles. The visible sentences are the result.
    const report = page.locator("div.w-128").filter({ hasText: sketchName });
    await expect(
      report.getByText(/km² of the seamounts layer/).filter({ visible: true })
    ).toBeVisible({ timeout: 180_000 });
    await expect(
      report.getByText(/km² of the EBSA layer/).filter({ visible: true })
    ).toBeVisible();
    await expect(
      report.getByText(/of the planning region/).filter({ visible: true })
    ).toBeVisible();
  });

  test("a CSV data table is hosted on local storage", async ({ page, request }) => {
    test.setTimeout(240_000);
    const tocId = await withDb(async (client) => {
      await client.query(
        `update projects
         set feature_flags = coalesce(feature_flags, '{}'::jsonb) || '{"dataTables": true}'::jsonb
         where slug = 'demo-samoa'`
      );
      const found = await client.query(
        `select id
         from table_of_contents_items
         where project_id = (select id from projects where slug = 'demo-samoa')
           and is_draft
           and is_folder = false
           and title = 'Exclusive Economic Zone'
         limit 1`
      );
      expect(found.rowCount, "draft EEZ layer").toBe(1);
      return found.rows[0].id as number;
    });

    await signIn(page, request, personas.admin);
    await page.goto(`/demo-samoa/admin/data?tocItemId=${tocId}`);
    await page.getByRole("button", { name: "Tables", exact: true }).click();
    await page.getByRole("switch").click();
    const joinDialog = page.getByRole("dialog").filter({ hasText: "Choose a join column" });
    await joinDialog.getByText("UNION", { exact: true }).click();
    await joinDialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("UNION", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Upload Table" }).click();
    const uploadDialog = page.getByRole("dialog").filter({ hasText: "Upload Data Table" });
    await uploadDialog.locator('input[type="file"]').first().setInputFiles(observationsFixture);
    const uploadButton = uploadDialog.getByRole("button", { name: "Upload", exact: true });
    await expect(uploadButton).toBeEnabled({ timeout: 60_000 });
    await uploadButton.click();

    await expect(page.getByTitle("eez-observations").first()).toBeVisible({
      timeout: 120_000,
    });
    await expect
      .poll(
        () =>
          withDb(async (client) => {
            const stored = await client.query(
              `select parquet_remote
               from overlay_data_tables
               where table_of_contents_item_id = $1
                 and deleted_at is null
               order by id desc
               limit 1`,
              [tocId]
            );
            return (stored.rows[0]?.parquet_remote as string | undefined) ?? "";
          }),
        { timeout: 120_000, intervals: [2_000] }
      )
      .toMatch(/^r2:\/\/ssn-tiles-local\//);
  });
});
