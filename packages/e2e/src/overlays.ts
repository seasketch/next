import { Client } from "pg";
import path from "path";
import { APIRequestContext, Page, expect } from "@playwright/test";
import { databaseURL, personas } from "./config";
import { graphql } from "./graphql";
import { signIn } from "./project";

export type UploadJob = {
  id: string;
  state: "QUEUED" | "RUNNING" | "COMPLETE" | "FAILED";
  errorMessage: string | null;
  progressMessage: string;
  dataUploadTask: {
    filename: string;
    dataSource: { id: number; outputs: { remote: string }[] } | null;
    layers: { tableOfContentsItem: { stableId: string } | null }[] | null;
  } | null;
};

const jobsQuery = `
  query UploadJobs($slug: String!) {
    projectBySlug(slug: $slug) {
      projectBackgroundJobs {
        id
        state
        errorMessage
        progressMessage
        dataUploadTask {
          filename
          dataSource { id outputs { remote } }
          layers { tableOfContentsItem { stableId } }
        }
      }
    }
  }
`;

export async function withDb<T>(run: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: databaseURL });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

/** Runs `run` in a transaction as `e2e|admin`, for SECURITY DEFINER admin functions. */
export async function asAdmin<T>(run: (client: Client) => Promise<T>): Promise<T> {
  return withDb(async (client) => {
    await client.query("begin");
    try {
      await client.query(
        `select set_config('session.user_id', (select id::text from users where sub = $1), true)`,
        [personas.admin.sub]
      );
      const result = await run(client);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

export function overlapCard(title: string, stableId: string, phrase: string) {
  return {
    type: "doc",
    content: [
      { type: "reportTitle", content: [{ text: title, type: "text" }] },
      {
        type: "paragraph",
        content: [
          { text: "This sketch overlaps ", type: "text" },
          {
            type: "metric",
            attrs: {
              type: "InlineMetric",
              metrics: [
                { type: "overlay_area", subjectType: "fragments", stableId },
              ],
              componentSettings: { presentation: "overlay_area" },
            },
          },
          { text: ` ${phrase}`, type: "text" },
        ],
      },
    ],
  };
}

/**
 * Picks `file` in the browser and waits for its upload job. `chooseFile`
 * performs the UI step that hands the file to the page; the job is the first
 * one for that filename that did not exist before.
 */
async function runUpload(
  page: Page,
  request: APIRequestContext,
  file: string,
  promptTimeoutMs: number,
  chooseFile: () => Promise<void>
): Promise<UploadJob> {
  const issued = await signIn(page, request, personas.admin);
  const listJobs = async (): Promise<UploadJob[]> => {
    const data = await graphql<{ projectBySlug: { projectBackgroundJobs: UploadJob[] } }>(
      request,
      issued.accessToken,
      jobsQuery,
      { slug: "demo-samoa" }
    );
    return data.projectBySlug.projectBackgroundJobs;
  };
  const earlierJobIds = new Set((await listJobs()).map((job) => job.id));
  const filename = path.basename(file);
  await chooseFile();

  const prompt = page.getByRole("dialog").filter({ hasText: "AI Cartographer" });
  const prompted = await prompt
    .getByRole("button", { name: "Disable for now" })
    .waitFor({ state: "visible", timeout: promptTimeoutMs })
    .then(() => true)
    .catch(() => false);
  if (prompted) {
    await prompt.getByRole("button", { name: "Disable for now" }).click();
  }

  let job: UploadJob | undefined;
  await expect
    .poll(
      async () => {
        job = (await listJobs()).find(
          (candidate) =>
            !earlierJobIds.has(candidate.id) &&
            candidate.dataUploadTask?.filename === filename
        );
        if (job?.state === "FAILED") {
          throw new Error(`Upload failed: ${job.errorMessage} (${job.progressMessage})`);
        }
        return job?.state;
      },
      { timeout: 240_000, intervals: [2_000] }
    )
    .toBe("COMPLETE");

  const source = job!.dataUploadTask!.dataSource!;
  expect(source.outputs.length).toBeGreaterThan(0);
  for (const output of source.outputs) {
    expect(output.remote).toMatch(/^r2:\/\/ssn-tiles-local\//);
  }
  return job!;
}

/** Drops `file` on the Overlay Layers list as a new layer. */
export async function uploadOverlay(
  page: Page,
  request: APIRequestContext,
  file: string,
  promptTimeoutMs: number
): Promise<{ stableId: string; dataSourceId: number }> {
  const job = await runUpload(page, request, file, promptTimeoutMs, async () => {
    await page.goto("/demo-samoa/admin/data");
    await page.getByText("Overlay Layers", { exact: true }).click();
    const fileInput = page.locator('input[type="file"]').first();
    await expect(fileInput).toBeAttached({ timeout: 30_000 });
    await fileInput.setInputFiles(file);
  });
  const stableId = job.dataUploadTask!.layers?.[0]?.tableOfContentsItem?.stableId;
  expect(stableId, `${path.basename(file)} stable id`).toBeTruthy();
  return { stableId: stableId!, dataSourceId: job.dataUploadTask!.dataSource!.id };
}

/**
 * Uploads `file` as a new version of an existing draft layer, from the
 * layer's Source tab, the way an admin replaces a layer's data.
 */
export async function uploadOverlayVersion(
  page: Page,
  request: APIRequestContext,
  tableOfContentsItemId: number,
  file: string,
  promptTimeoutMs: number
): Promise<{ dataSourceId: number }> {
  const job = await runUpload(page, request, file, promptTimeoutMs, async () => {
    await page.goto(`/demo-samoa/admin/data?tocItemId=${tableOfContentsItemId}`);
    await page.getByRole("button", { name: "Source", exact: true }).click();
    const browse = page.getByRole("button", { name: "browse for files on your computer" });
    await expect(browse).toBeVisible({ timeout: 30_000 });
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), browse.click()]);
    await chooser.setFiles(file);
  });
  return { dataSourceId: job.dataUploadTask!.dataSource!.id };
}

async function reportingOutputCount(dataSourceId: number): Promise<number> {
  return withDb(async (client) => {
    const jobs = await client.query(
      `select state::text as state, error_message
       from source_processing_jobs
       where data_source_id = $1`,
      [dataSourceId]
    );
    const failed = jobs.rows.find((row) => row.state === "error");
    if (failed) {
      throw new Error(`Reporting preprocess failed: ${failed.error_message || failed.state}`);
    }
    const outputs = await client.query(
      `select count(*)::int as ready
       from data_upload_outputs
       where data_source_id = $1
         and type = 'ReportingFlatgeobufV1'`,
      [dataSourceId]
    );
    return outputs.rows[0].ready as number;
  });
}

/**
 * Waits for the ReportingFlatgeobufV1 output the subdivision worker writes.
 * Nothing is queued here, so this only passes if something else started
 * preprocessing.
 */
export async function waitForQueuedReportingOutput(dataSourceId: number) {
  await expect
    .poll(() => reportingOutputCount(dataSourceId), {
      timeout: 180_000,
      intervals: [2_000],
    })
    .toBeGreaterThan(0);
}

/**
 * Overlay metrics read ReportingFlatgeobufV1, which the subdivision worker
 * writes after preprocess_source. The upload job can be complete before that
 * output exists.
 */
export async function waitForReportingOutput(dataSourceId: number) {
  await asAdmin(async (client) => {
    await client.query(`select preprocess_source('demo-samoa', $1)`, [dataSourceId]);
  });
  await waitForQueuedReportingOutput(dataSourceId);
}

/**
 * The local Lambda emulator accepts one invoke at a time, so each layer is
 * preprocessed only after the previous reporting output has landed.
 */
export async function waitForReportingOutputs(dataSourceIds: number[]) {
  for (const dataSourceId of dataSourceIds) {
    await waitForReportingOutput(dataSourceId);
  }
}
