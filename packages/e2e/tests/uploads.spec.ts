import fs from "fs";
import os from "os";
import path from "path";
import { APIRequestContext, Page, expect, test } from "@playwright/test";
import { personas } from "../src/config";
import { graphql } from "../src/graphql";
import { signIn } from "../src/project";

/**
 * The hosted-data path, end to end, on the local data services: the browser
 * PUTs the file to local R2 through a presigned URL, the API invokes the
 * spatial-uploads container, the container writes its outputs back to local
 * R2, and the pmtiles-server sessions serve them. Every URL the database ends
 * up with points at this stack, never at production.
 *
 * Small datasets are served as GeoJSON from the uploads host; anything whose
 * normalized FlatGeobuf is over 100 KB is also tiled and served from the
 * tiles host. One upload covers each path.
 */
const smallFixture = path.resolve(__dirname, "../fixtures/samoa-test-areas.geojson");
const tilesOrigin = process.env.E2E_TILES_URL || "http://localhost:18787";
const uploadsOrigin = process.env.E2E_UPLOADS_URL || "http://localhost:18788";

type Output = { type: string; url: string; remote: string; isOriginal: boolean };
type Job = {
  id: string;
  state: "QUEUED" | "RUNNING" | "COMPLETE" | "FAILED";
  title: string;
  errorMessage: string | null;
  progressMessage: string;
  dataUploadTask: {
    filename: string;
    dataSource: {
      id: number;
      type: string;
      url: string | null;
      outputs: Output[];
    } | null;
  } | null;
};
type JobsQuery = { projectBySlug: { id: number; projectBackgroundJobs: Job[] } };

type ProfileQuery = {
  me: { profile: { wasPromptedToEnableAiDataAnalystAt: string | null } };
};

const profileQuery = `
  query UploadJourneyProfile {
    me {
      profile {
        wasPromptedToEnableAiDataAnalystAt
      }
    }
  }
`;

const jobsQuery = `
  query UploadJobs($slug: String!) {
    projectBySlug(slug: $slug) {
      id
      projectBackgroundJobs {
        id
        state
        title
        errorMessage
        progressMessage
        dataUploadTask {
          filename
          dataSource {
            id
            type
            url
            outputs { type url remote isOriginal }
          }
        }
      }
    }
  }
`;

/**
 * Uploads get a unique filename, which becomes the layer title. A database
 * reused across runs then holds no other layer with that title and the tree
 * item is unambiguous.
 */
function uniqueName(base: string) {
  return `${base}-${Date.now().toString(36)}`;
}

function stageFixture(dir: string, name: string) {
  const file = path.join(dir, `${name}.geojson`);
  fs.copyFileSync(smallFixture, file);
  return file;
}

/**
 * A FeatureCollection of polygons around Samoa large enough to be tiled.
 * Written to a temporary directory so the repository does not carry a
 * multi-hundred-kilobyte fixture. Deterministic: no randomness.
 */
function writeLargeFixture(dir: string, name: string): string {
  const features = [];
  const vertices = 120;
  let id = 0;
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 12; col++) {
      const cx = -172.9 + col * 0.11;
      const cy = -14.3 + row * 0.09;
      const ring = [];
      for (let i = 0; i < vertices; i++) {
        const angle = (i / vertices) * Math.PI * 2;
        const wobble = 1 + 0.15 * Math.sin(angle * 5 + id);
        ring.push([
          Number((cx + Math.cos(angle) * 0.045 * wobble).toFixed(6)),
          Number((cy + Math.sin(angle) * 0.035 * wobble).toFixed(6)),
        ]);
      }
      ring.push(ring[0]);
      features.push({
        type: "Feature",
        properties: {
          name: `Cell ${row}-${col}`,
          kind: ["reef", "channel", "lagoon"][id % 3],
          score: (id * 7) % 100,
        },
        geometry: { type: "Polygon", coordinates: [ring] },
      });
      id++;
    }
  }
  const file = path.join(dir, `${name}.geojson`);
  fs.writeFileSync(file, JSON.stringify({ type: "FeatureCollection", features }));
  return file;
}

type Seen = { url: string; status: number };

/**
 * Upload `file` from the admin Data Layers page and return the completed
 * job as the API reports it, plus every response the page received from the
 * local data hosts. The client turns a finished upload on in the map by
 * itself, so the map's first fetch of the layer can happen before the test
 * gets to look at the job.
 */
async function uploadAndWait(
  page: Page,
  request: APIRequestContext,
  file: string
): Promise<{ job: Job; seen: Seen[] }> {
  const seen: Seen[] = [];
  page.on("response", (response) => {
    const url = response.url();
    if (url.startsWith(`${tilesOrigin}/`) || url.startsWith(`${uploadsOrigin}/`)) {
      seen.push({ url, status: response.status() });
    }
  });
  const issued = await signIn(page, request, personas.admin);
  const { me } = await graphql<ProfileQuery>(request, issued.accessToken, profileQuery);
  const prompted = me.profile.wasPromptedToEnableAiDataAnalystAt != null;

  await page.goto("/demo-samoa/admin/data");
  // The upload drop zone, and its hidden file input, belong to the Overlay
  // Layers tab.
  await page.getByText("Overlay Layers", { exact: true }).click();
  await expect(page.getByRole("treeitem", { name: "Geography layers" })).toBeVisible();
  const fileInput = page.locator('input[type="file"]').first();
  await expect(fileInput).toBeAttached({ timeout: 30_000 });

  const listJobs = async (): Promise<Job[]> => {
    const data = await graphql<JobsQuery>(request, issued.accessToken, jobsQuery, {
      slug: "demo-samoa",
    });
    return data.projectBySlug.projectBackgroundJobs;
  };
  // Jobs from earlier runs against the same database must not be mistaken
  // for this upload's job.
  const earlierJobIds = new Set((await listJobs()).map((job) => job.id));
  const filename = path.basename(file);
  const findJob = async (): Promise<Job | undefined> =>
    (await listJobs()).find(
      (candidate) =>
        !earlierJobIds.has(candidate.id) && candidate.dataUploadTask?.filename === filename
    );

  await fileInput.setInputFiles(file);

  // An account's first upload asks about the AI Cartographer before
  // processing starts. Either answer continues; declining keeps the test
  // offline. An account that has already answered is not asked again.
  if (!prompted) {
    await page.getByRole("button", { name: "Disable for now" }).click({ timeout: 60_000 });
  }

  let job: Job | undefined;
  await expect
    .poll(
      async () => {
        job = await findJob();
        if (job?.state === "FAILED") {
          throw new Error(`Upload failed: ${job.errorMessage} (${job.progressMessage})`);
        }
        return job?.state;
      },
      { timeout: 240_000, intervals: [2_000] }
    )
    .toBe("COMPLETE");
  return { job: job!, seen };
}

/** Every URL points at this stack, and `remote` names the local bucket. */
function expectLocalUrls(job: Job) {
  const source = job.dataUploadTask!.dataSource!;
  expect(
    source.url?.startsWith(`${tilesOrigin}/`) || source.url?.startsWith(`${uploadsOrigin}/`),
    `data source url ${source.url}`
  ).toBe(true);
  for (const output of source.outputs) {
    expect(output.remote).toMatch(/^r2:\/\/ssn-tiles-local\//);
    if (output.type === "PMTILES") {
      expect(output.url.startsWith(`${tilesOrigin}/`), output.url).toBe(true);
    } else {
      expect(output.url.startsWith(`${uploadsOrigin}/`), output.url).toBe(true);
    }
  }
}

/**
 * The new draft layer is in the admin table of contents and the map has
 * fetched its data from the local host. The client turns a finished upload
 * on by itself; if that has not happened yet, turn it on.
 */
async function expectMapDrawsLayer(
  page: Page,
  seen: Seen[],
  name: string,
  isLayerData: (url: string) => boolean
) {
  const layer = page.getByRole("treeitem", { name, exact: true });
  await expect(layer).toBeVisible({ timeout: 30_000 });
  const checkbox = layer.getByRole("checkbox").first();
  if (!(await checkbox.isChecked())) {
    await checkbox.click();
  }
  await expect
    .poll(
      () => seen.filter((response) => isLayerData(response.url)).map((r) => r.status),
      { timeout: 60_000, message: `the map did not fetch ${name} from the local host` }
    )
    .toContain(200);
}

test.describe("hosted data upload on the local data services", () => {
  let dir: string;
  test.beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "seasketch-e2e-upload-"));
  });
  test.afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test("a small GeoJSON is served from the uploads host and drawn on the map", async ({
    page,
    request,
  }) => {
    // Covers the first cold start of the handler container.
    test.setTimeout(300_000);
    const name = uniqueName("samoa-test-areas");
    const { job, seen } = await uploadAndWait(page, request, stageFixture(dir, name));
    const source = job.dataUploadTask!.dataSource!;
    const outputs = source.outputs;

    expect(outputs.map((output) => output.type)).toEqual(
      expect.arrayContaining(["FLAT_GEOBUF", "GEO_JSON"])
    );
    expect(outputs.map((output) => output.type)).not.toContain("PMTILES");
    expectLocalUrls(job);
    expect(source.url!.startsWith(`${uploadsOrigin}/`), source.url!).toBe(true);

    // The uploads host serves the GeoJSON the map will fetch, and the
    // original file for download.
    const geojson = await request.get(source.url!);
    expect(geojson.status(), await geojson.text()).toBe(200);
    expect(((await geojson.json()) as { features: unknown[] }).features).toHaveLength(3);
    const original = outputs.find((output) => output.isOriginal)!;
    expect((await request.get(original.url)).status()).toBe(200);

    await expectMapDrawsLayer(page, seen, name, (url) => url.startsWith(source.url!));
  });

  test("a larger GeoJSON is tiled and the map draws it from the tiles host", async ({
    page,
    request,
  }) => {
    test.setTimeout(300_000);
    const name = uniqueName("samoa-test-grid");
    const { job, seen } = await uploadAndWait(page, request, writeLargeFixture(dir, name));
    const source = job.dataUploadTask!.dataSource!;
    const outputs = source.outputs;

    expect(outputs.map((output) => output.type)).toEqual(
      expect.arrayContaining(["FLAT_GEOBUF", "PMTILES"])
    );
    expectLocalUrls(job);
    const pmtiles = outputs.find((output) => output.type === "PMTILES")!;
    expect(source.url).toBe(pmtiles.url.replace(/\.pmtiles$/, ""));

    // The tiles host builds TileJSON from the archive and points the tile
    // template back at itself.
    const tileJsonResponse = await request.get(`${source.url}.json`);
    expect(tileJsonResponse.status(), await tileJsonResponse.text()).toBe(200);
    const tileJson = (await tileJsonResponse.json()) as { tiles: string[] };
    expect(tileJson.tiles[0].startsWith(`${tilesOrigin}/`), tileJson.tiles[0]).toBe(true);

    await expectMapDrawsLayer(
      page,
      seen,
      name,
      (url) => url.startsWith(`${source.url}/`) && /\.(pbf|mvt)(\?|$)/.test(url)
    );
  });
});
