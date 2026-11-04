import fs from "fs";
import os from "os";
import path from "path";
import { APIRequestContext, Page, expect, test } from "@playwright/test";
import { personas } from "../src/config";
import { resetAiCartographerChoice } from "../src/db";
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
 *
 * An account's first upload asks about the AI Cartographer. Every journey
 * starts from that state and answers; most decline. The two AI journeys
 * check the handler against the e2e profile's mock of the AI gateway and
 * the PII classifier (packages/e2e/bin/ai-cartographer-mock.mjs): enabled,
 * the upload is titled and styled from the mock's answers; declined, the
 * mock is never asked.
 */
const smallFixture = path.resolve(__dirname, "../fixtures/samoa-test-areas.geojson");
/**
 * A real dataset: five deep-water bioregion MultiPolygons around Samoa,
 * exported from a GIS with a `name` and `crs` member, long text attributes,
 * and an apostrophe in a name. The generated fixtures do not have any of
 * that.
 */
const bioregionsFixture = path.resolve(__dirname, "../fixtures/deepwater-bioregions.geojson");
/**
 * Another real export: 32 Special, Unique Marine Area MultiPolygons around
 * Samoa (26 inshore, 6 offshore), detailed enough that the normalized
 * FlatGeobuf crosses the tiling threshold.
 */
const sumaFixture = path.resolve(__dirname, "../fixtures/eco-suma.geojson");
const tilesOrigin = process.env.E2E_TILES_URL || "http://localhost:18787";
const uploadsOrigin = process.env.E2E_UPLOADS_URL || "http://localhost:18788";
const aiMockOrigin = process.env.E2E_AI_CARTOGRAPHER_MOCK_URL || "http://localhost:18790";

type Output = { type: string; url: string; remote: string; isOriginal: boolean };
type AiNote = {
  bestLayerTitle: string | null;
  attribution: string | null;
  bestLabelColumn: string | null;
  chosenPresentationType: string | null;
  interactivityType: string;
  showLabels: boolean;
  customPalette: unknown;
  notes: string;
  errors: string | null;
};
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
      bounds: (number | string)[] | null;
      geostats: unknown;
      outputs: Output[];
      aiDataAnalystNote: AiNote | null;
    } | null;
    layers: { mapboxGlStyles: unknown; tableOfContentsItem: { title: string } | null }[] | null;
  } | null;
};
type JobsQuery = { projectBySlug: { id: number; projectBackgroundJobs: Job[] } };

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
            bounds
            geostats
            outputs { type url remote isOriginal }
            aiDataAnalystNote {
              bestLayerTitle
              attribution
              bestLabelColumn
              chosenPresentationType
              interactivityType
              showLabels
              customPalette
              notes
              errors
            }
          }
          layers {
            mapboxGlStyles
            tableOfContentsItem { title }
          }
        }
      }
    }
  }
`;

/** One request the AI Cartographer mock answered. */
type MockRequest = {
  at: string;
  kind: "chat" | "pii";
  prompt: "title" | "attribution" | "column_intelligence" | null;
  model: string | null;
  filename: string | null;
  input: string;
};

async function mockRequests(request: APIRequestContext): Promise<MockRequest[]> {
  const response = await request.get(`${aiMockOrigin}/requests`);
  expect(response.status(), `the AI Cartographer mock at ${aiMockOrigin}`).toBe(200);
  return (await response.json()) as MockRequest[];
}

/**
 * The prompts the mock answered about this upload, by the filename each
 * carried. PII classification runs whatever the account chose and its
 * payload has no filename, so it is not in here.
 */
function promptsAbout(requests: MockRequest[], filename: string) {
  return requests.filter(
    (entry) =>
      entry.kind === "chat" && (entry.filename === filename || entry.input.includes(filename))
  );
}

/**
 * Uploads get a unique filename, which becomes the layer title. A database
 * reused across runs then holds no other layer with that title and the tree
 * item is unambiguous.
 */
function uniqueName(base: string) {
  return `${base}-${Date.now().toString(36)}`;
}

function stageFixture(dir: string, name: string, fixture = smallFixture) {
  const file = path.join(dir, `${name}.geojson`);
  fs.copyFileSync(fixture, file);
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
 *
 * The account has been reset to never having been asked about the AI
 * Cartographer, so the first-upload prompt appears and `aiCartographer`
 * answers it. Declining keeps the handler off the mock.
 */
async function uploadAndWait(
  page: Page,
  request: APIRequestContext,
  file: string,
  aiCartographer: "enable" | "decline" = "decline"
): Promise<{ job: Job; seen: Seen[] }> {
  const seen: Seen[] = [];
  page.on("response", (response) => {
    const url = response.url();
    if (url.startsWith(`${tilesOrigin}/`) || url.startsWith(`${uploadsOrigin}/`)) {
      seen.push({ url, status: response.status() });
    }
  });
  const issued = await signIn(page, request, personas.admin);

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

  // The prompt holds the upload until it is answered; processing starts with
  // the answer.
  const prompt = page.getByRole("dialog").filter({ hasText: "AI Cartographer" });
  await expect(prompt.getByRole("button", { name: "Enable for my account" })).toBeVisible({
    timeout: 60_000,
  });
  await prompt
    .getByRole("button", {
      name: aiCartographer === "enable" ? "Enable for my account" : "Disable for now",
    })
    .click();

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
  test.beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "seasketch-e2e-upload-"));
    await resetAiCartographerChoice(personas.admin.sub);
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

  test("the deep-water bioregions GeoJSON is analyzed, stored locally, and drawn", async ({
    page,
    request,
  }) => {
    test.setTimeout(300_000);
    const name = uniqueName("deepwater-bioregions");
    const { job, seen } = await uploadAndWait(
      page,
      request,
      stageFixture(dir, name, bioregionsFixture)
    );
    const source = job.dataUploadTask!.dataSource!;
    const outputs = source.outputs;

    // Its FlatGeobuf is about 45 KB, under the tiling threshold, so the map
    // reads it as GeoJSON from the uploads host.
    expect(outputs.map((output) => output.type)).toEqual(
      expect.arrayContaining(["FLAT_GEOBUF", "GEO_JSON"])
    );
    expect(outputs.map((output) => output.type)).not.toContain("PMTILES");
    expectLocalUrls(job);
    expect(source.url!.startsWith(`${uploadsOrigin}/`), source.url!).toBe(true);

    // The handler read the file's geometry and attributes. Bounds cover the
    // bioregions (roughly 174.5°W to 170.5°W, 15.9°S to 11°S) and the
    // geostats name the columns the GIS export carried.
    const [west, south, east, north] = source.bounds!.map(Number);
    expect(west).toBeCloseTo(-174.51, 1);
    expect(south).toBeCloseTo(-15.88, 1);
    expect(east).toBeCloseTo(-170.54, 1);
    expect(north).toBeCloseTo(-10.96, 1);
    const layer = findGeostatsLayer(source.geostats);
    expect(layer, `geostats ${JSON.stringify(source.geostats)}`).toBeDefined();
    expect(layer!.count).toBe(5);
    expect(layer!.geometry).toBe("MultiPolygon");
    expect(layer!.attributes.map((attribute) => attribute.attribute)).toEqual(
      expect.arrayContaining(["Draft_name", "depthRange", "eez", "Descrptn"])
    );

    // What the uploads host serves back is the same five features with their
    // attributes intact, including the apostrophe in "I'a manu".
    const served = await fetchServedGeoJson(request, source);
    expect(served.features).toHaveLength(5);
    expect(served.features.map((feature) => feature.properties.Draft_name).sort()).toEqual(
      ["Fafa-o-Mauga", "I'a manu", "La'i", "Loto-i-Toga", "Vasa-i-Saute"]
    );
    expect(served.features.every((feature) => feature.geometry.type === "MultiPolygon")).toBe(
      true
    );
    const original = outputs.find((output) => output.isOriginal)!;
    expect((await request.get(original.url)).status()).toBe(200);

    await expectMapDrawsLayer(page, seen, name, (url) => url.startsWith(source.url!));
  });

  test("the Eco-SUMA GeoJSON is tiled and the map draws it from the tiles host", async ({
    page,
    request,
  }) => {
    test.setTimeout(300_000);
    const name = uniqueName("eco-suma");
    const { job, seen } = await uploadAndWait(page, request, stageFixture(dir, name, sumaFixture));
    const source = job.dataUploadTask!.dataSource!;
    const outputs = source.outputs;

    expect(outputs.map((output) => output.type)).toEqual(
      expect.arrayContaining(["FLAT_GEOBUF", "PMTILES"])
    );
    expectLocalUrls(job);
    const pmtiles = outputs.find((output) => output.type === "PMTILES")!;
    expect(source.url).toBe(pmtiles.url.replace(/\.pmtiles$/, ""));
    expect(source.url!.startsWith(`${tilesOrigin}/`), source.url!).toBe(true);

    // A tiled source leaves `bounds` to the TileJSON; the row stores null.
    expect(source.bounds).toBeNull();
    const layer = findGeostatsLayer(source.geostats);
    expect(layer, `geostats ${JSON.stringify(source.geostats)}`).toBeDefined();
    expect(layer!.count).toBe(32);
    expect(layer!.geometry).toBe("MultiPolygon");
    expect(layer!.attributes.map((attribute) => attribute.attribute)).toEqual(
      expect.arrayContaining(["Name", "Code", "Insh_Offsh", "layer"])
    );

    // The tiles host describes the archive from its header, bounds included,
    // and serves tiles from it. Tile 6/1/34 covers 174.4°W to 168.75°W,
    // 16.6°S to 11.2°S, nearly the whole dataset, so it has to come back
    // with content.
    const tileJsonResponse = await request.get(`${source.url}.json`);
    expect(tileJsonResponse.status(), await tileJsonResponse.text()).toBe(200);
    const tileJson = (await tileJsonResponse.json()) as {
      tiles: string[];
      bounds?: number[];
    };
    expect(tileJson.tiles[0].startsWith(`${tilesOrigin}/`), tileJson.tiles[0]).toBe(true);
    expect(tileJson.bounds, JSON.stringify(tileJson)).toHaveLength(4);
    const [west, south, east, north] = tileJson.bounds!;
    expect(west).toBeCloseTo(-174.46, 1);
    expect(south).toBeCloseTo(-15.86, 1);
    expect(east).toBeCloseTo(-170.96, 1);
    expect(north).toBeCloseTo(-10.99, 1);
    const tileUrl = tileJson.tiles[0].replace("{z}", "6").replace("{x}", "1").replace("{y}", "34");
    const tile = await request.get(tileUrl);
    expect(tile.status(), `tile ${tileUrl}`).toBe(200);
    expect((await tile.body()).length).toBeGreaterThan(0);

    await expectMapDrawsLayer(
      page,
      seen,
      name,
      (url) => url.startsWith(`${source.url}/`) && /\.(pbf|mvt)(\?|$)/.test(url)
    );
  });

  test("with the AI Cartographer enabled, the upload is titled and styled from the mocked AI service", async ({
    page,
    request,
  }) => {
    test.setTimeout(300_000);
    const name = uniqueName("samoa-ai-on");
    const filename = `${name}.geojson`;
    const { job, seen } = await uploadAndWait(
      page,
      request,
      stageFixture(dir, name),
      "enable"
    );
    const task = job.dataUploadTask!;
    const source = task.dataSource!;
    expectLocalUrls(job);

    // The handler asked the mock for a title and, after the mocked PII
    // classification, for column intelligence, each about this file. No
    // sidecar or embedded metadata, so no attribution prompt.
    const requests = await mockRequests(request);
    expect(promptsAbout(requests, filename).map((entry) => entry.prompt).sort()).toEqual([
      "column_intelligence",
      "title",
    ]);
    expect(requests.filter((entry) => entry.kind === "pii").length).toBeGreaterThan(0);

    // The answers were stored as the source's notes...
    const note = source.aiDataAnalystNote;
    expect(note, "ai_data_analyst_notes row").not.toBeNull();
    expect(note!.errors).toBeNull();
    expect(note!.bestLayerTitle).toBe(`${name} (titled by the AI Cartographer mock)`);
    expect(note!.chosenPresentationType).toBe("SIMPLE_POLYGON");
    expect(note!.bestLabelColumn).toBe("name");
    expect(note!.showLabels).toBe(true);
    expect(note!.interactivityType).toBe("ALL_PROPERTIES_POPUP");
    expect(note!.customPalette).toEqual({ default: "#1d4ed8" });
    expect(note!.notes).toContain("AI Cartographer mock");
    expect(note!.attribution).toBeNull();

    // ...and applied: the layer takes the suggested title and a style built
    // from the suggestion, with the mock's fill colour.
    const [layer] = task.layers!;
    expect(layer.tableOfContentsItem?.title).toBe(note!.bestLayerTitle);
    const styles = layer.mapboxGlStyles as { type: string; paint?: Record<string, unknown> }[];
    expect(styles.map((style) => style.type)).toEqual(
      expect.arrayContaining(["fill", "line", "symbol"])
    );
    expect(styles.find((style) => style.type === "fill")!.paint!["fill-color"]).toBe("#1d4ed8");

    // The geostats carry the classifier's verdict.
    expect((source.geostats as { layers: { piiRiskWasAssessed?: boolean }[] }).layers[0]
      .piiRiskWasAssessed).toBe(true);

    await expectMapDrawsLayer(page, seen, note!.bestLayerTitle!, (url) =>
      url.startsWith(source.url!)
    );
  });

  test("with the AI Cartographer declined, the upload never reaches the AI service", async ({
    page,
    request,
  }) => {
    test.setTimeout(300_000);
    const name = uniqueName("samoa-ai-off");
    const filename = `${name}.geojson`;
    const { job, seen } = await uploadAndWait(page, request, stageFixture(dir, name), "decline");
    const task = job.dataUploadTask!;
    const source = task.dataSource!;
    expectLocalUrls(job);

    // No prompt about this file went to the mock, there are no notes, and
    // the layer keeps the filename as its title with the default style.
    expect(promptsAbout(await mockRequests(request), filename)).toEqual([]);
    expect(source.aiDataAnalystNote).toBeNull();
    const [layer] = task.layers!;
    expect(layer.tableOfContentsItem?.title).toBe(name);
    const styles = layer.mapboxGlStyles as { type: string; paint?: Record<string, unknown> }[];
    expect(styles.find((style) => style.type === "fill")!.paint!["fill-color"]).not.toBe("#1d4ed8");

    await expectMapDrawsLayer(page, seen, name, (url) => url.startsWith(source.url!));
  });
});

type GeostatsLayer = {
  count: number;
  geometry: string;
  attributes: { attribute: string }[];
};

/**
 * `geostats` is untrusted JSON. The handler stores `{ layers: [...] }` for a
 * vector source; accept a bare layer as well.
 */
function findGeostatsLayer(value: unknown): GeostatsLayer | undefined {
  if (value === null || typeof value !== "object") {
    return undefined;
  }
  const candidates: unknown[] =
    "layers" in value && Array.isArray((value as { layers: unknown }).layers)
      ? (value as { layers: unknown[] }).layers
      : [value];
  for (const candidate of candidates) {
    if (
      candidate !== null &&
      typeof candidate === "object" &&
      "attributes" in candidate &&
      Array.isArray((candidate as { attributes: unknown }).attributes) &&
      "count" in candidate &&
      "geometry" in candidate
    ) {
      return candidate as GeostatsLayer;
    }
  }
  return undefined;
}

type ServedFeature = {
  geometry: { type: string };
  properties: Record<string, unknown>;
};

async function fetchServedGeoJson(
  request: APIRequestContext,
  source: { url: string | null }
): Promise<{ features: ServedFeature[] }> {
  const response = await request.get(source.url!);
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()) as { features: ServedFeature[] };
}
