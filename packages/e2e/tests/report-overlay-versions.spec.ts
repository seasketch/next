import fs from "fs";
import os from "os";
import path from "path";
import { APIRequestContext, Locator, Page, expect, test } from "@playwright/test";
import { issueToken } from "../src/auth";
import { personas } from "../src/config";
import { resetAiCartographerChoice } from "../src/db";
import { graphql } from "../src/graphql";
import {
  asAdmin,
  overlapCard,
  uploadOverlay,
  uploadOverlayVersion,
  waitForQueuedReportingOutput,
  waitForReportingOutput,
  withDb,
} from "../src/overlays";
import { openMap, signIn } from "../src/project";

/**
 * A published report measures overlap with an EBSA layer. The admin uploads a
 * corrected EBSA as a new version of that layer. Draft reports switch to the
 * new version once it has been preprocessed, while the published report keeps
 * the published layer list's version until that list is published. Publishing
 * the report alone is refused until then.
 *
 * Uploads, preprocessing, clipping, fragments, and overlay metrics all run on
 * the e2e profile's local workers and storage.
 */
const ebsaFixture = path.resolve(__dirname, "../fixtures/samoa-ebsas.geojson");

/** Open ocean north of Savai'i, inside the EEZ and inside the original EBSA. */
const sketchBounds = { west: -173.0, south: -13.2, east: -172.6, north: -12.9 };

/** The corrected EBSA keeps only the area west of -172.8. */
const correctedEbsaEast = -172.8;

function rectangle(b: { west: number; south: number; east: number; north: number }) {
  return {
    type: "Polygon",
    coordinates: [
      [
        [b.west, b.south],
        [b.east, b.south],
        [b.east, b.north],
        [b.west, b.north],
        [b.west, b.south],
      ],
    ],
  };
}

type Metric = {
  id: string;
  state: "QUEUED" | "PROCESSING" | "COMPLETE" | "ERROR" | "DEPENDENCY_NOT_READY";
  value: Record<string, unknown> | null;
  sourceUrl: string | null;
  sourceProcessingJobDependency: string | null;
  errorMessage: string | null;
};

type Dependencies = {
  metrics: Metric[];
  cardDependencyLists: { cardId: number; metrics: string[]; overlaySources: string[] }[];
  dependencyResolutionErrors: { stableId: string | null; message: string }[];
};

const dependenciesQuery = `
  query ReportDependencies($reportId: Int!, $sketchId: Int!) {
    report(id: $reportId) {
      dependencies(sketchId: $sketchId) {
        metrics {
          id
          state
          value
          sourceUrl
          sourceProcessingJobDependency
          errorMessage
        }
        cardDependencyLists {
          cardId
          metrics
          overlaySources
        }
        dependencyResolutionErrors {
          stableId
          message
        }
      }
    }
  }
`;

type Overlap = {
  complete: boolean;
  km2: number;
  metricIds: string[];
  sourceUrls: string[];
  jobKeys: string[];
};

/**
 * The EBSA overlap a report shows for a sketch: the sum of the class totals
 * over the sketch's fragments, from the cards that reference `stableId`.
 */
async function ebsaOverlap(
  request: APIRequestContext,
  token: string,
  reportId: number,
  sketchId: number,
  stableId: string
): Promise<Overlap> {
  const data = await graphql<{ report: { dependencies: Dependencies } }>(
    request,
    token,
    dependenciesQuery,
    { reportId, sketchId }
  );
  const deps = data.report.dependencies;
  const resolutionError = deps.dependencyResolutionErrors.find(
    (error) => error.stableId === stableId
  );
  if (resolutionError) {
    throw new Error(`Report ${reportId} could not resolve the EBSA: ${resolutionError.message}`);
  }
  const ids = new Set(
    deps.cardDependencyLists
      .filter((card) => card.overlaySources.includes(stableId))
      .flatMap((card) => card.metrics.map(String))
  );
  const metrics = deps.metrics.filter((metric) => ids.has(String(metric.id)));
  expect(metrics.length, `EBSA metrics on report ${reportId}`).toBeGreaterThan(0);
  const failed = metrics.find((metric) => metric.state === "ERROR");
  if (failed) {
    throw new Error(`EBSA metric ${failed.id} failed: ${failed.errorMessage}`);
  }
  let km2 = 0;
  for (const metric of metrics) {
    for (const [key, value] of Object.entries(metric.value || {})) {
      if (!key.startsWith("__") && typeof value === "number") {
        km2 += value;
      }
    }
  }
  return {
    complete: metrics.every((metric) => metric.state === "COMPLETE"),
    km2,
    metricIds: metrics.map((metric) => String(metric.id)).sort(),
    sourceUrls: Array.from(new Set(metrics.map((metric) => metric.sourceUrl || ""))),
    jobKeys: Array.from(
      new Set(metrics.map((metric) => metric.sourceProcessingJobDependency || ""))
    ),
  };
}

async function completedEbsaOverlap(
  request: APIRequestContext,
  token: string,
  reportId: number,
  sketchId: number,
  stableId: string
): Promise<Overlap> {
  let overlap: Overlap | undefined;
  await expect
    .poll(
      async () => {
        overlap = await ebsaOverlap(request, token, reportId, sketchId, stableId);
        return overlap.complete;
      },
      { timeout: 300_000, intervals: [3_000] }
    )
    .toBe(true);
  return overlap!;
}

/** The reporting output URL the draft or published layer currently resolves to. */
async function reportingOutputUrl(stableId: string, isDraft: boolean): Promise<string | null> {
  return withDb(async (client) => {
    const { rows } = await client.query(
      `select out.url
       from table_of_contents_items items
       left join lateral table_of_contents_items_reporting_output(items.*) out on true
       where items.stable_id = $1 and items.is_draft = $2`,
      [stableId, isDraft]
    );
    expect(rows.length, `${isDraft ? "draft" : "published"} item ${stableId}`).toBe(1);
    return (rows[0].url as string | null) ?? null;
  });
}

async function latestPublishedReportId(draftReportId: number): Promise<number> {
  return withDb(async (client) => {
    const { rows } = await client.query(
      `select id from reports where draft_id = $1 order by version desc limit 1`,
      [draftReportId]
    );
    expect(rows.length, "published report").toBe(1);
    return rows[0].id as number;
  });
}

function expectLocal(url: string) {
  expect(["localhost", "127.0.0.1"]).toContain(new URL(url).hostname);
}

type PublishedEbsaReport = {
  ebsa: { dataSourceId: number; stableId: string };
  projectId: number;
  sketchClassId: number;
  draftReportId: number;
  draftItemId: number;
  publishedReportId: number;
  originalUrl: string;
};

/**
 * Uploads the original EBSA, waits for preprocessing, adds an overlap card to
 * the Marine Protected Area report, and publishes the layer list and report.
 */
async function publishEbsaReport(
  page: Page,
  request: APIRequestContext,
  originalFile: string,
  cardTitle: string
): Promise<PublishedEbsaReport> {
  const ebsa = await uploadOverlay(page, request, originalFile, 60_000);
  await waitForReportingOutput(ebsa.dataSourceId);

  const setup = await asAdmin(async (client) => {
    const project = await client.query(`select id from projects where slug = 'demo-samoa'`);
    const projectId = project.rows[0].id as number;
    await client.query(`select publish_table_of_contents($1)`, [projectId]);
    const draft = await client.query(
      `select sc.id as sketch_class_id, draft.id as report_id, tab.id as tab_id
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
    const row = draft.rows[0] as {
      sketch_class_id: number;
      report_id: number;
      tab_id: number;
    };
    await client.query(`select add_report_card($1, '{}'::jsonb, 'textBlock', $2::jsonb)`, [
      row.tab_id,
      JSON.stringify(overlapCard(cardTitle, ebsa.stableId, "of the EBSA layer.")),
    ]);
    await client.query(`select publish_report_snapshot($1)`, [row.report_id]);
    const item = await client.query(
      `select id from table_of_contents_items where stable_id = $1 and is_draft`,
      [ebsa.stableId]
    );
    return {
      projectId,
      sketchClassId: row.sketch_class_id,
      draftReportId: row.report_id,
      draftItemId: item.rows[0].id as number,
    };
  });

  const originalUrl = await reportingOutputUrl(ebsa.stableId, true);
  expect(originalUrl, "original reporting output").toBeTruthy();
  expectLocal(originalUrl!);
  expect(await reportingOutputUrl(ebsa.stableId, false)).toBe(originalUrl);
  await asAdmin(async (client) => {
    await client.query(
      `update projects set draft_table_of_contents_has_changes = false where id = $1`,
      [setup.projectId]
    );
  });
  return {
    ebsa,
    ...setup,
    publishedReportId: await latestPublishedReportId(setup.draftReportId),
    originalUrl: originalUrl!,
  };
}

/** A sketch entirely inside the original EBSA. */
async function createEbsaSketch(
  request: APIRequestContext,
  token: string,
  sketchClassId: number,
  name: string
): Promise<number> {
  const created = await graphql<{ createSketch: { id: number } }>(
    request,
    token,
    `mutation CreateSketch($name: String!, $sketchClassId: Int!, $userGeom: GeoJSON!) {
      createSketch(
        name: $name
        sketchClassId: $sketchClassId
        userGeom: $userGeom
        properties: {}
      ) {
        id
      }
    }`,
    {
      name,
      sketchClassId,
      userGeom: { type: "Feature", properties: {}, geometry: rectangle(sketchBounds) },
    }
  );
  return created.createSketch.id;
}

/** The original EBSA, and a corrected version that covers about half the sketch. */
function writeEbsaFiles(dir: string, suffix: string) {
  const originalFile = path.join(dir, `ebsas-${suffix}.geojson`);
  const correctedFile = path.join(dir, `ebsas-corrected-${suffix}.geojson`);
  fs.copyFileSync(ebsaFixture, originalFile);
  const original = JSON.parse(fs.readFileSync(ebsaFixture, "utf8"));
  fs.writeFileSync(
    correctedFile,
    JSON.stringify({
      ...original,
      features: [
        {
          type: "Feature",
          properties: { name: "Samoa Basin" },
          geometry: rectangle({
            west: -173.5,
            south: -14.6,
            east: correctedEbsaEast,
            north: -12.4,
          }),
        },
      ],
    })
  );
  return { originalFile, correctedFile };
}

/**
 * Holds preprocessSource jobs in graphile-worker's queue, so a test can act
 * while a source is still waiting to be preprocessed.
 */
async function holdPreprocessing() {
  await withDb(async (client) => {
    await client.query(`
      create or replace function public.e2e_hold_preprocess_source() returns trigger
      language plpgsql as $$
      begin
        if new.task_identifier = 'preprocessSource' then
          new.run_at := now() + interval '1 day';
        end if;
        return new;
      end;
      $$;
      drop trigger if exists e2e_hold_preprocess_source on graphile_worker.jobs;
      create trigger e2e_hold_preprocess_source
        before insert on graphile_worker.jobs
        for each row execute function public.e2e_hold_preprocess_source();
    `);
  });
}

async function releasePreprocessing() {
  await withDb(async (client) => {
    await client.query(`
      drop trigger if exists e2e_hold_preprocess_source on graphile_worker.jobs;
      drop function if exists public.e2e_hold_preprocess_source();
      update graphile_worker.jobs set run_at = now()
      where task_identifier = 'preprocessSource' and run_at > now();
    `);
  });
}

/** Opens the end user's sketch report from the Sketches panel. */
async function openSketchReport(page: Page, sketchName: string): Promise<Locator> {
  await openMap(page, "/demo-samoa/app");
  await page.getByRole("button", { name: "Sketches" }).click();
  const sketchLabel = page.locator("label", { hasText: sketchName });
  await expect(sketchLabel).toBeVisible();
  const viewAttributes = page.getByRole("button", { name: "View Attributes", exact: true });
  if (!(await viewAttributes.isEnabled())) {
    await sketchLabel.click();
  }
  await expect(viewAttributes).toBeEnabled({ timeout: 15_000 });
  await viewAttributes.click();
  return page.locator("div.w-128").filter({ hasText: sketchName });
}

function reportCard(report: Locator, title: string): Locator {
  return report
    .locator("div.ReportCard")
    .filter({ has: report.page().locator("[data-report-title]", { hasText: title }) })
    .first();
}

/** The card actions menu opens the calculation details modal. */
async function openCalculationDetails(page: Page, card: Locator): Promise<Locator> {
  await card.hover();
  await card.getByRole("button", { name: "Card actions" }).click();
  await page.getByRole("menuitem", { name: "Calculation details" }).click();
  // Headless UI's dialog wrapper has no box of its own; its heading does.
  const dialog = page.getByRole("dialog", { name: /Data Sources and Calculations/ });
  await expect(dialog.getByRole("heading", { name: /Data Sources and Calculations/ })).toBeVisible();
  return dialog;
}

const publishTableOfContentsMutation = `
  mutation PublishTableOfContents($projectId: Int!) {
    publishTableOfContents(input: { projectId: $projectId }) { clientMutationId }
  }
`;

const publishReportMutation = `
  mutation PublishReport($reportId: Int!) {
    publishReport(input: { reportId: $reportId }) { clientMutationId }
  }
`;

test.describe("report overlay versions @admin @layers", () => {
  test.beforeEach(async () => {
    await resetAiCartographerChoice(personas.admin.sub);
  });

  test("a new EBSA version reaches draft reports, and end users only after publishing", async ({
    page,
    request,
  }) => {
    test.setTimeout(1_500_000);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "seasketch-e2e-versions-"));
    const suffix = Date.now().toString(36);
    const { originalFile, correctedFile } = writeEbsaFiles(dir, suffix);

    try {
      const setup = await publishEbsaReport(page, request, originalFile, `EBSAs ${suffix}`);
      const { ebsa, publishedReportId, originalUrl } = setup;

      const { accessToken: token } = await issueToken(request, personas.admin);
      const sketchId = await createEbsaSketch(
        request,
        token,
        setup.sketchClassId,
        `EBSA versions ${suffix}`
      );

      const publishedBefore = await completedEbsaOverlap(
        request,
        token,
        publishedReportId,
        sketchId,
        ebsa.stableId
      );
      expect(publishedBefore.sourceUrls).toEqual([originalUrl]);
      expect(publishedBefore.km2).toBeGreaterThan(0);
      const draftBefore = await completedEbsaOverlap(
        request,
        token,
        setup.draftReportId,
        sketchId,
        ebsa.stableId
      );
      expect(draftBefore.sourceUrls).toEqual([originalUrl]);
      expect(draftBefore.km2).toBeCloseTo(publishedBefore.km2, 3);

      // The admin uploads the corrected EBSA as a new version of the layer.
      const corrected = await uploadOverlayVersion(
        page,
        request,
        setup.draftItemId,
        correctedFile,
        15_000
      );
      expect(corrected.dataSourceId).not.toBe(ebsa.dataSourceId);
      await withDb(async (client) => {
        const layer = await client.query(
          `select layers.data_source_id
           from table_of_contents_items items
           join data_layers layers on layers.id = items.data_layer_id
           where items.id = $1`,
          [setup.draftItemId]
        );
        expect(layer.rows[0].data_source_id, "draft layer source").toBe(corrected.dataSourceId);
        const flag = await client.query(
          `select draft_table_of_contents_has_changes as changed from projects where id = $1`,
          [setup.projectId]
        );
        expect(flag.rows[0].changed, "layer list shows unpublished changes").toBe(true);
        // The layer is used by a report, so the upload queues preprocessing
        // for the new source itself.
        const jobs = await client.query(
          `select job_key from source_processing_jobs where data_source_id = $1`,
          [corrected.dataSourceId]
        );
        expect(jobs.rowCount, "preprocessing queued for the new version").toBe(1);
      });

      // Draft reports never fall back to the original version's results.
      const draftRightAway = await ebsaOverlap(
        request,
        token,
        setup.draftReportId,
        sketchId,
        ebsa.stableId
      );
      expect(draftRightAway.sourceUrls).not.toContain(originalUrl);
      expect(draftRightAway.metricIds).not.toEqual(draftBefore.metricIds);

      await waitForQueuedReportingOutput(corrected.dataSourceId);
      const correctedUrl = await reportingOutputUrl(ebsa.stableId, true);
      expect(correctedUrl, "corrected reporting output").toBeTruthy();
      expect(correctedUrl).not.toBe(originalUrl);
      expectLocal(correctedUrl!);

      // Draft reports recalculate against the corrected EBSA, which covers
      // about half of the sketch.
      const draftAfter = await completedEbsaOverlap(
        request,
        token,
        setup.draftReportId,
        sketchId,
        ebsa.stableId
      );
      expect(draftAfter.sourceUrls).toEqual([correctedUrl]);
      expect(draftAfter.km2).toBeLessThan(publishedBefore.km2 * 0.75);
      expect(draftAfter.km2).toBeGreaterThan(publishedBefore.km2 * 0.25);

      // End users still see the published version.
      expect(await reportingOutputUrl(ebsa.stableId, false)).toBe(originalUrl);
      const publishedUnchanged = await completedEbsaOverlap(
        request,
        token,
        publishedReportId,
        sketchId,
        ebsa.stableId
      );
      expect(publishedUnchanged.sourceUrls).toEqual([originalUrl]);
      expect(publishedUnchanged.metricIds).toEqual(publishedBefore.metricIds);
      expect(publishedUnchanged.km2).toBeCloseTo(publishedBefore.km2, 3);

      // Publishing the report alone is refused while it depends on an
      // unpublished version. The admin UI answers this error by publishing
      // the layer list and then the report.
      const publishReport = () =>
        graphql(request, token, publishReportMutation, { reportId: setup.draftReportId });
      await expect(publishReport()).rejects.toThrow(
        /references updated versions of data sources which have not yet been published/
      );
      expect(await latestPublishedReportId(setup.draftReportId)).toBe(publishedReportId);
      expect(
        (await completedEbsaOverlap(request, token, publishedReportId, sketchId, ebsa.stableId))
          .sourceUrls
      ).toEqual([originalUrl]);

      // Publishing the layer list moves end users to the corrected version,
      // even on the report published before the upload.
      await graphql(request, token, publishTableOfContentsMutation, {
        projectId: setup.projectId,
      });
      expect(await reportingOutputUrl(ebsa.stableId, false)).toBe(correctedUrl);
      const publishedAfterLayers = await completedEbsaOverlap(
        request,
        token,
        publishedReportId,
        sketchId,
        ebsa.stableId
      );
      expect(publishedAfterLayers.sourceUrls).toEqual([correctedUrl]);
      expect(publishedAfterLayers.km2).toBeCloseTo(draftAfter.km2, 3);

      // Now the report publishes, and its new snapshot uses the corrected version.
      await publishReport();
      const republishedReportId = await latestPublishedReportId(setup.draftReportId);
      expect(republishedReportId).not.toBe(publishedReportId);
      const republished = await completedEbsaOverlap(
        request,
        token,
        republishedReportId,
        sketchId,
        ebsa.stableId
      );
      expect(republished.sourceUrls).toEqual([correctedUrl]);
      expect(republished.km2).toBeCloseTo(draftAfter.km2, 3);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("publishing while a new EBSA version is still preprocessing keeps end-user reports working", async ({
    page,
    request,
    browser,
  }, testInfo) => {
    test.setTimeout(1_500_000);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "seasketch-e2e-preprocessing-"));
    const suffix = Date.now().toString(36);
    const { originalFile, correctedFile } = writeEbsaFiles(dir, suffix);
    const memberContext = await browser.newContext();

    try {
      const cardTitle = `EBSAs ${suffix}`;
      const setup = await publishEbsaReport(page, request, originalFile, cardTitle);
      const { ebsa, originalUrl } = setup;
      const { accessToken: adminToken } = await issueToken(request, personas.admin);

      // An end user's sketch, measured against the published version.
      const memberPage = await memberContext.newPage();
      const { accessToken: memberToken } = await signIn(memberPage, request, personas.member);
      const sketchName = `EBSA preprocessing ${suffix}`;
      const sketchId = await createEbsaSketch(
        request,
        memberToken,
        setup.sketchClassId,
        sketchName
      );
      const publishedBefore = await completedEbsaOverlap(
        request,
        memberToken,
        setup.publishedReportId,
        sketchId,
        ebsa.stableId
      );
      expect(publishedBefore.sourceUrls).toEqual([originalUrl]);

      // The corrected version is uploaded, and its preprocessing is held so
      // the admin publishes before it finishes.
      await holdPreprocessing();
      const corrected = await uploadOverlayVersion(
        page,
        request,
        setup.draftItemId,
        correctedFile,
        15_000
      );
      const jobKey = await withDb(async (client) => {
        const { rows } = await client.query(
          `select job_key, state from source_processing_jobs where data_source_id = $1`,
          [corrected.dataSourceId]
        );
        expect(rows.length, "preprocessing queued for the new version").toBe(1);
        expect(rows[0].state).toBe("queued");
        return rows[0].job_key as string;
      });

      // The layer list and the report both publish while it's preprocessing.
      await graphql(request, adminToken, publishTableOfContentsMutation, {
        projectId: setup.projectId,
      });
      expect(
        await reportingOutputUrl(ebsa.stableId, false),
        "published copy has no reporting output yet"
      ).toBeNull();
      await graphql(request, adminToken, publishReportMutation, {
        reportId: setup.draftReportId,
      });
      const republishedReportId = await latestPublishedReportId(setup.draftReportId);
      expect(republishedReportId).not.toBe(setup.publishedReportId);

      // End users' reports, old and new, wait on the preprocessing job
      // instead of failing to resolve the layer.
      for (const reportId of [setup.publishedReportId, republishedReportId]) {
        const waiting = await ebsaOverlap(request, memberToken, reportId, sketchId, ebsa.stableId);
        expect(waiting.complete).toBe(false);
        expect(waiting.sourceUrls).toEqual([""]);
        expect(waiting.jobKeys).toEqual([jobKey]);
        expect(waiting.metricIds).not.toEqual(publishedBefore.metricIds);
      }
      const sources = await graphql<{
        report: {
          overlaySources: {
            stableId: string;
            sourceProcessingJob: { jobKey: string; state: string } | null;
          }[];
        };
      }>(
        request,
        memberToken,
        `query OverlaySources($reportId: Int!) {
          report(id: $reportId) {
            overlaySources {
              stableId
              sourceProcessingJob { jobKey state }
            }
          }
        }`,
        { reportId: republishedReportId }
      );
      expect(
        sources.report.overlaySources.find((source) => source.stableId === ebsa.stableId)
          ?.sourceProcessingJob
      ).toEqual({ jobKey, state: "QUEUED" });

      // The member's report shows the layer being preprocessed.
      await memberPage.setViewportSize({ width: 1440, height: 900 });
      memberPage.setDefaultTimeout(20_000);
      const report = await openSketchReport(memberPage, sketchName);
      const card = reportCard(report, cardTitle);
      await expect(card).toBeVisible({ timeout: 60_000 });
      await expect(report.getByText("Calculation error")).toHaveCount(0);
      await memberPage.screenshot({
        path: testInfo.outputPath("preprocessing-report.png"),
      });
      const details = await openCalculationDetails(memberPage, card);
      const layerRow = details
        .locator("li")
        .filter({ hasText: path.basename(originalFile, ".geojson") });
      await expect(details.getByText("Optimized Overlay Layers")).toBeVisible();
      await expect(layerRow).toBeVisible();
      await expect(details.getByText("Unknown source")).toHaveCount(0);
      // The modal fades in from script, which screenshot's animation option can't skip.
      await memberPage.waitForTimeout(1_000);
      await memberPage.screenshot({
        path: testInfo.outputPath("preprocessing-calculation-details.png"),
      });
      await memberPage.keyboard.press("Escape");

      // Preprocessing finishes. The published copy picks up the output, and
      // end users' reports calculate against the corrected version.
      await releasePreprocessing();
      await waitForQueuedReportingOutput(corrected.dataSourceId);
      const correctedUrl = await reportingOutputUrl(ebsa.stableId, true);
      expect(correctedUrl, "corrected reporting output").toBeTruthy();
      expectLocal(correctedUrl!);
      await expect
        .poll(() => reportingOutputUrl(ebsa.stableId, false), { timeout: 30_000 })
        .toBe(correctedUrl);

      const draftAfter = await completedEbsaOverlap(
        request,
        adminToken,
        setup.draftReportId,
        sketchId,
        ebsa.stableId
      );
      for (const reportId of [setup.publishedReportId, republishedReportId]) {
        const after = await completedEbsaOverlap(
          request,
          memberToken,
          reportId,
          sketchId,
          ebsa.stableId
        );
        expect(after.sourceUrls).toEqual([correctedUrl]);
        expect(after.km2).toBeCloseTo(draftAfter.km2, 3);
        expect(after.km2).toBeLessThan(publishedBefore.km2 * 0.75);
        expect(after.km2).toBeGreaterThan(publishedBefore.km2 * 0.25);
      }

      await expect(
        card.getByText(/km² of the EBSA layer/).filter({ visible: true })
      ).toBeVisible({ timeout: 180_000 });
      await expect(report.getByText("Calculation error")).toHaveCount(0);
      await memberPage.screenshot({
        path: testInfo.outputPath("preprocessing-complete-report.png"),
      });
    } finally {
      await releasePreprocessing();
      await memberContext.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
