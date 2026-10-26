import { expect, test, type Locator, type Page } from "@playwright/test";
import { Client } from "pg";
import { databaseURL } from "../src/config";

const respondent = "E2E Survey User";
const email = "e2e-survey@example.test";
const comments = "My general comments.";

async function withDb<T>(run: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: databaseURL });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

async function surveyPath(slug: string, name: string): Promise<string> {
  return withDb(async (client) => {
    const result = await client.query(
      `select s.id
       from surveys s
       join projects p on p.id = s.project_id
       where p.slug = $1 and s.name = $2`,
      [slug, name]
    );
    if (result.rowCount !== 1) {
      throw new Error(`${name} is missing from ${slug}`);
    }
    return `/${slug}/surveys/${result.rows[0].id}`;
  });
}

function nextChevron(page: Page): Locator {
  return page.getByTitle("Next Question");
}

async function clickButton(page: Page, name: string | RegExp) {
  await page.getByRole("button", { name }).filter({ visible: true }).first().click();
}

async function mapCenter(page: Page): Promise<{ lng: number; lat: number } | null> {
  return page.evaluate(() => {
    const map = (
      window as unknown as {
        mapContext?: { map?: { getCenter: () => { lng: number; lat: number } } };
      }
    ).mapContext?.map;
    if (!map) {
      return null;
    }
    const center = map.getCenter();
    return { lng: center.lng, lat: center.lat };
  });
}

/** Wait until fitBounds has finished, so vertices stay where they were clicked. */
async function waitForMapSettled(page: Page) {
  let previous = "";
  for (let attempt = 0; attempt < 15; attempt++) {
    const center = await mapCenter(page);
    const next = center ? `${center.lng.toFixed(3)},${center.lat.toFixed(3)}` : "";
    if (next && next === previous) {
      return;
    }
    previous = next;
    await page.waitForTimeout(200);
  }
}

/** Fractions of the canvas. The last point repeats the first and closes the ring. */
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

async function drawRing(page: Page, points: Array<[number, number]>) {
  await expect(page.getByRole("progressbar", { name: "Loading" })).toHaveCount(0, {
    timeout: 30_000,
  });
  await expect
    .poll(
      async () => {
        const box = await (await largestMap(page)).boundingBox();
        return box ? Math.min(box.width, box.height) : 0;
      },
      { timeout: 30_000 }
    )
    .toBeGreaterThan(400);
  await waitForMapSettled(page);
  const map = await largestMap(page);
  const box = await map.boundingBox();
  if (!box) {
    throw new Error("Survey map has no box");
  }
  for (const [xFraction, yFraction] of points) {
    await page.mouse.click(
      box.x + box.width * xFraction,
      box.y + box.height * yFraction
    );
    await page.waitForTimeout(150);
  }
  if (await page.getByText("Click to add more points").isVisible()) {
    throw new Error(
      `Polygon did not close on map ${Math.round(box.width)}x${Math.round(box.height)}`
    );
  }
}

const square: Array<[number, number]> = [
  [0.35, 0.4],
  [0.35, 0.62],
  [0.55, 0.62],
  [0.55, 0.4],
  [0.35, 0.4],
];

const bowtie: Array<[number, number]> = [
  [0.62, 0.35],
  [0.78, 0.55],
  [0.62, 0.55],
  [0.78, 0.35],
  [0.62, 0.35],
];

const secondSquare: Array<[number, number]> = [
  [0.42, 0.48],
  [0.42, 0.7],
  [0.6, 0.7],
  [0.6, 0.48],
  [0.42, 0.48],
];

test.describe("Maldives ocean use survey", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("an anonymous visitor can complete the ocean-use survey", async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto(await surveyPath("demo-maldives", "Maldives Ocean Use Survey"));
    await expect(page.getByRole("progressbar")).toHaveCount(0);
    await expect(page.getByText("Welcome Ocean Users!")).toBeVisible();

    await clickButton(page, "Settings");
    await expect(page.getByText("Facilitated Response")).toBeVisible();
    await expect(page.getByText("Practice Mode")).toBeVisible();
    const switches = page.getByRole("switch");
    await expect(switches).toHaveCount(2);
    for (const sw of await switches.all()) {
      await expect(sw).toHaveAttribute("aria-checked", "false");
      await sw.click();
      await expect(sw).toHaveAttribute("aria-checked", "true");
      await sw.click();
      await expect(sw).toHaveAttribute("aria-checked", "false");
    }
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.locator('[name="Begin Survey"]').click();
    await expect(page.getByText("What is your name?")).toBeVisible();
    await expect(nextChevron(page)).toHaveClass(/pointer-events-none/);
    await page.locator("input").fill(respondent);
    await clickButton(page, /^Next$/);

    await expect(page.getByText("What is your email address?")).toBeVisible();
    await page.locator("input").fill(email);
    await clickButton(page, /^Next$/);

    await expect(page.getByText("Which Atoll do you reside on?")).toBeVisible();
    await expect(nextChevron(page)).toHaveClass(/pointer-events-none/);
    await page.getByTitle("N", { exact: true }).click();

    await expect(page.getByText("Which island of N atoll do you reside on?")).toBeVisible();
    await expect(page.getByText("Which Atoll do you reside on?")).toHaveCount(0);
    await expect(page.getByText("Lhohi")).toBeVisible();
    await expect(nextChevron(page)).toHaveClass(/pointer-events-none/);
    await page.getByTitle("Kudafari", { exact: true }).click();

    await expect(page.getByText("What sectors do you represent?")).toBeVisible();
    await expect(page.getByText("Click on the map to start a polygon")).toHaveCount(0);
    const sectorNext = page.getByRole("button", { name: /^Next$/ });
    await expect(sectorNext).toBeDisabled();
    await page.getByTitle("Fisheries - Commercial, Tuna", { exact: true }).click();
    await page.getByTitle("Fisheries - Commercial, Non-Tuna Species", { exact: true }).click();
    await expect(sectorNext).toBeEnabled();
    await sectorNext.click();

    await expect(page.getByRole("heading", { name: "Fisheries - Commercial, Tuna" })).toBeVisible();
    await expect(page.locator(".mapboxgl-map[data-map-loaded='true']")).toBeVisible({
      timeout: 30_000,
    });
    await drawRing(page, square);

    await page.locator('img[alt$="map preview"]').click();
    for (const label of [
      "Reset view",
      "Focus on location",
      "Show scale bar",
      "Basemap",
      "Light",
      "Satellite",
    ]) {
      await expect(page.getByText(label, { exact: true }).last()).toBeVisible();
    }
    await expect(page.locator('img[alt="Light basemap"]')).toBeVisible();
    await expect(page.locator('img[alt="Satellite basemap"]')).toBeVisible();

    const scaleRow = page.getByRole("button", { name: "Show scale bar", exact: true });
    const scaleSwitch = scaleRow.locator("[role=switch]");
    await expect(scaleSwitch).toHaveAttribute("aria-checked", "false");
    await scaleRow.click();
    await expect(scaleSwitch).toHaveAttribute("aria-checked", "true");
    await expect(page.locator(".mapboxgl-ctrl-scale")).toBeVisible();

    const basemapChoice = (name: string) =>
      page.locator("button").filter({
        has: page.locator("h4", { hasText: new RegExp(`^${name}$`) }),
      });
    const lightBasemap = basemapChoice("Light");
    const satelliteBasemap = basemapChoice("Satellite");
    await expect(lightBasemap).toHaveClass(/font-semibold/);
    await satelliteBasemap.click();
    await expect(satelliteBasemap).toHaveClass(/font-semibold/);
    await expect(lightBasemap).not.toHaveClass(/font-semibold/);

    const beforeFocus = await mapCenter(page);
    expect(beforeFocus).not.toBeNull();
    await page.getByText("Focus on location", { exact: true }).click();
    await expect
      .poll(async () => mapCenter(page), { timeout: 10_000 })
      .not.toEqual(beforeFocus);
    const mapMenu = page.locator("div.absolute.top-0.left-0.z-50.w-screen");
    await mapMenu.click({ position: { x: 8, y: 80 } });
    await expect(mapMenu).toHaveCount(0);

    await expect(page.getByRole("heading", { name: "Area Name" })).toBeVisible();
    await page.locator('[name="FeatureName"]').fill("Yellowfin tuna fishing area.");
    await expect(page.getByText("What type of gear do you use here?")).toBeVisible();
    await expect(page.getByText("What species do you fish here")).toBeVisible();
    await page.getByTitle("Pole and Line", { exact: true }).click();
    await page.getByTitle("Yellowfin", { exact: true }).click();
    await page.locator("textarea").last().fill("Heavy use in spring and summer.");

    const importance = page.getByRole("heading", { name: "How important is this area?" });
    await importance.scrollIntoViewIfNeeded();
    await page.locator("input[type=range]").fill("15");
    await expect(page.locator("input[type=range]")).toHaveValue("15");
    await clickButton(page, /^Save$/);
    await expect(page.getByRole("button", { name: /^Save$/ })).toHaveCount(0);
    await expect(page.locator(".SAPRangeMini")).toHaveValue("15");

    await expect(page.getByRole("button", { name: "Finish Sector", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Finish", exact: true })).toHaveCount(0);
    await clickButton(page, "Finish Sector");
    await expect(page.getByRole("heading", { name: "Your sectors" })).toBeVisible();
    await clickButton(page, "Next sector");

    await expect(page.getByRole("heading", { name: "Fisheries - Commercial, Non-Tuna Species" })).toBeVisible();
    await expect(page.locator(".MapPicker")).toBeVisible();
    await drawRing(page, square);
    await expect(page.getByRole("heading", { name: "Area Name" })).toBeVisible();
    await page.locator('[name="FeatureName"]').fill("Sea cucumber fishing area.");
    await expect(page.getByTitle("Pole and Line", { exact: true })).toHaveCount(0);
    await expect(page.getByTitle("Yellowfin", { exact: true })).toHaveCount(0);
    await page.getByTitle("Sea cucumber", { exact: true }).click();
    await page.getByTitle("Jigging", { exact: true }).click();
    await page.locator("textarea").last().fill("Sea cucumber love this spot!");
    await clickButton(page, /^Save$/);

    await clickButton(page, "New Shape");
    await expect(page.getByRole("progressbar")).toHaveCount(0);
    await drawRing(page, bowtie);
    await clickButton(page, "Invalid Shape");
    const invalidDialog = page.getByRole("dialog");
    await expect(invalidDialog.getByText("Invalid Shape")).toBeVisible();
    await expect(invalidDialog.locator("video")).toBeVisible();
    await clickButton(page, "Okay");
    await clickButton(page, /Done/);
    await clickButton(page, /^OK$/);

    await page.locator(".flex-shrink-0").getByRole("button").first().click();
    await clickButton(page, /^OK$/);

    await clickButton(page, "New Shape");
    await drawRing(page, secondSquare);
    await expect(page.getByRole("heading", { name: "Area Name" })).toBeVisible();
    await page.locator('[name="FeatureName"]').fill("Reef fishing area.");
    await page.getByRole("button", { name: "Handline", exact: true }).click();
    await page.getByRole("button", { name: "Reef fish", exact: true }).click();
    await page.locator("textarea").last().fill("Bountiful reef fishing.");
    await clickButton(page, /^Save$/);

    await expect(page.getByText("Sea cucumber fishing area.")).toBeVisible();
    await expect(page.getByText("Reef fishing area.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Finish Sector", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Finish", exact: true })).toHaveCount(0);
    await clickButton(page, "Finish Sector");
    await expect(page.getByRole("heading", { name: "Your sectors" })).toBeVisible();
    await page.getByTitle("Next Question").click();

    await expect(
      page.getByText("Please indicate how many people are reflected in this response")
    ).toBeVisible();
    const people = page.locator('input[type="number"]');
    await expect(people).toHaveValue("0");
    await people.pressSequentially("4");
    await expect(people).toHaveValue("04");
    await page.getByTitle("Subtract").click();
    await page.getByTitle("Subtract").click();
    await expect(people).toHaveValue("2");
    await page.getByTitle("Add").click();
    await expect(people).toHaveValue("3");
    await clickButton(page, /^Next$/);

    await expect(page.getByText(/vessel/)).toBeVisible();
    const vessel = page.locator("input").last();
    await expect(vessel).toHaveValue("");
    await clickButton(page, "Skip Question");
    await expect(page.getByText(/willing/)).toBeVisible();
    await page.getByTitle("Previous Question").click();
    await expect(page.getByText(/vessel/)).toBeVisible();
    await vessel.fill("Queen Ann's Revenge");
    await clickButton(page, /^Next$/);

    await expect(page.getByText(/additional/)).toBeVisible();
    await page.getByTitle("Yes", { exact: true }).click();

    await expect(page.getByText("Your age")).toBeVisible();
    await expect(page.getByText(/willing/)).toHaveCount(0);
    await page.locator("input").fill("30");
    await clickButton(page, /^Next$/);

    await expect(page.getByText("Gender")).toBeVisible();
    await page.getByTitle("Female", { exact: true }).click();

    await page.locator("textarea").fill(comments);
    await clickButton(page, "Complete Submission");
    await expect(page.getByRole("heading", { name: "Thank You" })).toBeVisible();

    await expect
      .poll(
        () =>
          withDb(async (client) => {
            const result = await client.query(
              `select sr.data
               from survey_responses sr
               join surveys s on s.id = sr.survey_id
               join projects p on p.id = s.project_id
               where p.slug = 'demo-maldives'
                 and s.name = 'Maldives Ocean Use Survey'
               order by sr.id desc
               limit 1`
            );
            return result.rows[0]?.data ?? null;
          }),
        { timeout: 20_000 }
      )
      .toBeTruthy();

    const data = await withDb(async (client) => {
      const result = await client.query(
        `select sr.data
         from survey_responses sr
         join surveys s on s.id = sr.survey_id
         join projects p on p.id = s.project_id
         where p.slug = 'demo-maldives'
           and s.name = 'Maldives Ocean Use Survey'
         order by sr.id desc
         limit 1`
      );
      return result.rows[0].data as Record<string, unknown>;
    });
    const values = Object.values(data);
    const spatial = values.find(
      (value) =>
        !!value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Array.isArray((value as { sectors?: unknown }).sectors)
    ) as { sectors: string[]; collection: number[] };
    expect(values).toContainEqual(expect.objectContaining({ name: respondent }));
    expect(values).toContain(email);
    expect(values).toContainEqual(["N"]);
    expect(values).toContainEqual(["Kudafari"]);
    expect(spatial.sectors).toEqual([
      "Fisheries - Commercial, Tuna",
      "Fisheries - Commercial, Non-Tuna Species",
    ]);
    expect(spatial.collection).toHaveLength(3);
    const sketchPoints = await withDb(async (client) => {
      const result = await client.query(
        `select id, ST_NPoints(user_geom) as points from sketches where id = any($1::int[])`,
        [spatial.collection]
      );
      return result.rows as Array<{ id: number; points: number }>;
    });
    expect(sketchPoints).toHaveLength(3);
    for (const sketch of sketchPoints) {
      expect(sketch.points).toBeGreaterThan(3);
    }
    expect(values).toContain(3);
    expect(values).toContain("Queen Ann's Revenge");
    expect(values).toContain(true);
    expect(values).toContain(30);
    expect(values).toContainEqual(["Female"]);
    expect(values).toContain(comments);

    await clickButton(page, "Submit Another Response");
    await expect(page.getByText("Welcome Ocean Users!")).toBeVisible();
  });
});

test.describe("Palawan coral survey", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("a single sector starts on the map and comes back to the sector list", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.goto(await surveyPath("demo-palawan", "Coral Restoration Survey"));
    await expect(page.getByRole("progressbar")).toHaveCount(0);
    await expect(
      page.getByRole("heading", {
        name: "Single-sector survey example",
      })
    ).toBeVisible();

    await page.locator('[name="Begin Survey"]').click();
    await expect(
      page.getByRole("heading", { name: "Where should coral recovery activities occur?" })
    ).toBeVisible();
    await expect(page.getByText("Select Areas to Identify")).toHaveCount(0);
    await expect(page.locator(".mapboxgl-map[data-map-loaded='true']")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("Click on the map to start a polygon")).toBeVisible();

    await drawRing(page, square);
    await expect(page.getByRole("heading", { name: "Area Name" })).toBeVisible();
    await page.locator('[name="FeatureName"]').fill("Tubbataha recovery area.");
    await page.getByTitle("Climate and/or anthropogenic refugia", { exact: true }).click();
    await page.getByTitle("Research", { exact: true }).click();
    const importance = page.getByRole("heading", { name: "How important is this area?" });
    await importance.scrollIntoViewIfNeeded();
    await page.locator("input[type=range]").fill("40");
    await clickButton(page, /^Save$/);

    await expect(page.getByText("Tubbataha recovery area.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Finish", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Finish Sector", exact: true })).toHaveCount(0);
    await clickButton(page, "Finish");

    await expect(page.getByRole("heading", { name: "Your sectors" })).toBeVisible();
    await expect(page.getByText("Coral Recovery Priority Areas")).toBeVisible();
    await expect(page.getByText(/1 area/)).toBeVisible();
    await expect(page.getByText("Click on the map to start a polygon")).toHaveCount(0);

    await page.goBack();
    await expect(
      page.getByRole("heading", {
        name: "Single-sector survey example",
      })
    ).toBeVisible();
    await page.goForward();

    await expect(page.getByRole("heading", { name: "Your sectors" })).toBeVisible();
    await expect(page.getByText(/1 area/)).toBeVisible();
    await expect(page.getByText("Select Areas to Identify")).toHaveCount(0);
    await expect(page.getByText("Click on the map to start a polygon")).toHaveCount(0);
  });
});
