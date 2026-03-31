/**
 * Live calls to the gateway in `generateColumnIntelligence` (no mocks).
 * Loads `.env` from this package via `vitest.config.ts` (Vite `loadEnv`).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generateColumnIntelligence } from "../lib/client";
import { columnIntelligenceValidator } from "../lib/schemas";

type GeostatsFixture = {
  filename: string;
  geostats: unknown;
};

function isGreenLikeColor(color: string): boolean {
  const c = color.trim().toLowerCase();

  // Named colors that clearly indicate green hues.
  if (
    /green|lime|olive|chartreuse|forest|mint|teal|emerald|seafoam|seagreen/.test(
      c,
    )
  ) {
    return true;
  }

  // #rgb or #rrggbb
  const hex = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const raw = hex[1];
    const full =
      raw.length === 3
        ? raw
            .split("")
            .map((s) => s + s)
            .join("")
        : raw;
    const r = Number.parseInt(full.slice(0, 2), 16);
    const g = Number.parseInt(full.slice(2, 4), 16);
    const b = Number.parseInt(full.slice(4, 6), 16);
    return g >= r && g >= b;
  }

  // rgb()/rgba()
  const rgb = c.match(
    /^rgba?\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)(?:\s*,\s*[\d.]+)?\s*\)$/,
  );
  if (rgb) {
    const r = Number(rgb[1]);
    const g = Number(rgb[2]);
    const b = Number(rgb[3]);
    return g >= r && g >= b;
  }

  // hsl()/hsla() with hue in green range.
  const hsl = c.match(/^hsla?\(\s*([0-9.]+)\s*,/);
  if (hsl) {
    const hue = Number(hsl[1]) % 360;
    return hue >= 70 && hue <= 170;
  }

  return false;
}

const deepwaterBioregionsFixture = JSON.parse(
  readFileSync(
    join(process.cwd(), "__tests__", "geostats", "deepwater-bioregions.json"),
    "utf8",
  ),
) as GeostatsFixture;

const shoretypesFixture = JSON.parse(
  readFileSync(
    join(process.cwd(), "__tests__", "geostats", "shoretypes.json"),
    "utf8",
  ),
) as GeostatsFixture;

const gfw2024Fixture = JSON.parse(
  readFileSync(
    join(process.cwd(), "__tests__", "geostats", "gfw2024.json"),
    "utf8",
  ),
) as GeostatsFixture;

const seamountsFixture = JSON.parse(
  readFileSync(
    join(process.cwd(), "__tests__", "geostats", "seamounts.json"),
    "utf8",
  ),
) as GeostatsFixture;

const fishingEffortFixture = JSON.parse(
  readFileSync(
    join(process.cwd(), "__tests__", "geostats", "fishing-effort.json"),
    "utf8",
  ),
) as GeostatsFixture;

const pristineSeasFixture = JSON.parse(
  readFileSync(
    join(process.cwd(), "__tests__", "geostats", "pristine-seas.json"),
    "utf8",
  ),
) as GeostatsFixture;

const globalMangrovesFixture = JSON.parse(
  readFileSync(
    join(process.cwd(), "__tests__", "geostats", "global-mangroves.json"),
    "utf8",
  ),
) as GeostatsFixture;

const benthicKiribatiFixture = JSON.parse(
  readFileSync(
    join(process.cwd(), "__tests__", "geostats", "benthic-kiribati.json"),
    "utf8",
  ),
) as GeostatsFixture;

const mangrovePlantingFixture = JSON.parse(
  readFileSync(
    join(process.cwd(), "__tests__", "geostats", "mangrove-planting.json"),
    "utf8",
  ),
) as GeostatsFixture;

describe.concurrent("generateColumnIntelligence", () => {
  it("deepwater-bioregions", async () => {
    const response = await generateColumnIntelligence(
      deepwaterBioregionsFixture.filename,
      deepwaterBioregionsFixture.geostats,
    );

    if ("error" in response) {
      throw new Error(response.error);
    }

    expect(columnIntelligenceValidator(response.result)).toBe(true);
    // console.log(JSON.stringify(response.result, null, 2));
    expect(typeof response.result.notes).toBe("string");
    expect(response.result.notes.trim().length).toBeGreaterThan(0);
    expect(Array.isArray(response.result.junk_columns)).toBe(true);
    expect(["ALL_PROPERTIES_POPUP", "BANNER"]).toContain(
      response.result.interactivity_type,
    );
    expect(response.result.chosen_presentation_type).toBe(
      "CATEGORICAL_POLYGON",
    );
    expect(response.result.chosen_presentation_column).toBe("Draft_name");
    expect(response.result.best_category_column).toBe(
      response.result.chosen_presentation_column,
    );
    expect(response.result.best_group_by_column).toBe(
      response.result.chosen_presentation_column,
    );
  }, 35000);

  it("shoretypes", async () => {
    const response = await generateColumnIntelligence(
      shoretypesFixture.filename,
      shoretypesFixture.geostats,
    );

    if ("error" in response) {
      throw new Error(response.error);
    }

    expect(columnIntelligenceValidator(response.result)).toBe(true);
    // console.log(JSON.stringify(response.result, null, 2));
    expect(typeof response.result.notes).toBe("string");
    expect(response.result.notes.trim().length).toBeGreaterThan(0);
    expect(Array.isArray(response.result.junk_columns)).toBe(true);
  }, 35000);

  it("gfw2024", async () => {
    const response = await generateColumnIntelligence(
      gfw2024Fixture.filename,
      gfw2024Fixture.geostats,
    );

    if ("error" in response) {
      throw new Error(response.error);
    }

    // console.log(JSON.stringify(response.result, null, 2));
    expect(columnIntelligenceValidator(response.result)).toBe(true);
    expect(typeof response.result.notes).toBe("string");
    expect(response.result.notes.trim().length).toBeGreaterThan(0);
    expect(Array.isArray(response.result.junk_columns)).toBe(true);
    expect(response.result.chosen_presentation_type).toBe("CONTINUOUS_RASTER");
    expect(response.result.chosen_presentation_column).toBeNull();
    expect(response.result.show_labels).toBe(false);
    expect(response.result.labels_min_zoom).toBeNull();
    expect(response.result.interactivity_type).toBe("NONE");
    expect(response.result.best_label_column).toBeNull();
    expect(response.result.best_category_column).toBeNull();
    expect(response.result.best_numeric_column).toBeNull();
    expect(response.result.best_date_column).toBeNull();
    expect(response.result.best_popup_description_column).toBeNull();
    expect(response.result.best_id_column).toBeNull();
    expect(response.result.value_steps).toBe("NATURAL_BREAKS");
    expect(response.result.value_steps_n).toBe(8);
  }, 35000);

  it("seamounts", async () => {
    const response = await generateColumnIntelligence(
      seamountsFixture.filename,
      seamountsFixture.geostats,
    );

    if ("error" in response) {
      throw new Error(response.error);
    }

    expect(columnIntelligenceValidator(response.result)).toBe(true);
    // console.log(JSON.stringify(response.result, null, 2));
    expect(typeof response.result.notes).toBe("string");
    expect(response.result.notes.trim().length).toBeGreaterThan(0);
    expect(Array.isArray(response.result.junk_columns)).toBe(true);
    expect(response.result.chosen_presentation_type).toBe("CONTINUOUS_POINT");
    expect(response.result.chosen_presentation_column).toBe("height");
    expect(response.result.best_numeric_column).toBe("height");
    expect(response.result.best_id_column).toBe("peakid");
    expect(response.result.interactivity_type).toBe("ALL_PROPERTIES_POPUP");
    expect(response.result.value_steps).toBe("NATURAL_BREAKS");
    expect(response.result.value_steps_n).toBe(8);
  }, 35000);

  it("fishing-effort", async () => {
    const response = await generateColumnIntelligence(
      fishingEffortFixture.filename,
      fishingEffortFixture.geostats,
    );

    if ("error" in response) {
      throw new Error(response.error);
    }

    expect(columnIntelligenceValidator(response.result)).toBe(true);
    expect(typeof response.result.notes).toBe("string");
    expect(response.result.notes.trim().length).toBeGreaterThan(0);
    expect(Array.isArray(response.result.junk_columns)).toBe(true);
    expect(response.result.chosen_presentation_type).toBe("CONTINUOUS_RASTER");
    expect(response.result.value_steps).toBe("NATURAL_BREAKS");
    expect(response.result.value_steps_n).toBe(8);
    expect(response.result.best_group_by_column).toBeNull();
  }, 35000);

  it("pristine-seas", async () => {
    const response = await generateColumnIntelligence(
      pristineSeasFixture.filename,
      pristineSeasFixture.geostats,
    );

    if ("error" in response) {
      throw new Error(response.error);
    }

    expect(columnIntelligenceValidator(response.result)).toBe(true);
    // console.log(JSON.stringify(response.result, null, 2));
    expect(typeof response.result.notes).toBe("string");
    expect(response.result.notes.trim().length).toBeGreaterThan(0);
    expect(Array.isArray(response.result.junk_columns)).toBe(true);
    expect(response.result.chosen_presentation_type).toBe("CONTINUOUS_RASTER");
    expect(response.result.value_steps).toBe("CONTINUOUS");
  }, 35000);

  it("global-mangroves", async () => {
    const response = await generateColumnIntelligence(
      globalMangrovesFixture.filename,
      globalMangrovesFixture.geostats,
    );

    if ("error" in response) {
      throw new Error(response.error);
    }
    // console.log(JSON.stringify(response.result, null, 2));

    expect(columnIntelligenceValidator(response.result)).toBe(true);
    expect(typeof response.result.notes).toBe("string");
    expect(response.result.notes.trim().length).toBeGreaterThan(0);
    expect(Array.isArray(response.result.junk_columns)).toBe(true);
    expect(response.result.chosen_presentation_type).toBe("CATEGORICAL_RASTER");
    expect(
      response.result.custom_palette !== null &&
        typeof response.result.custom_palette === "object" &&
        !Array.isArray(response.result.custom_palette),
    ).toBe(true);
    const mangroveColors = Object.values(response.result.custom_palette ?? {});
    expect(mangroveColors.length).toBe(1);
    expect(isGreenLikeColor(mangroveColors[0] ?? "")).toBe(true);
  }, 35000);

  it("benthic-kiribati", async () => {
    const response = await generateColumnIntelligence(
      benthicKiribatiFixture.filename,
      benthicKiribatiFixture.geostats,
    );

    if ("error" in response) {
      throw new Error(response.error);
    }
    // console.log(JSON.stringify(response.result, null, 2));
    expect(columnIntelligenceValidator(response.result)).toBe(true);
    expect(typeof response.result.notes).toBe("string");
    expect(response.result.notes.trim().length).toBeGreaterThan(0);
    expect(Array.isArray(response.result.junk_columns)).toBe(true);
    expect(response.result.chosen_presentation_type).toBe(
      "CATEGORICAL_POLYGON",
    );
    expect(response.result.chosen_presentation_column).toBe("class");
    expect(response.result.best_group_by_column).toBe(
      response.result.chosen_presentation_column,
    );
    expect(
      response.result.custom_palette !== null &&
        typeof response.result.custom_palette === "object" &&
        !Array.isArray(response.result.custom_palette),
    ).toBe(true);
    expect(response.result.palette).toBeNull();
    const benthicPalette = response.result.custom_palette ?? {};
    expect(Object.keys(benthicPalette).length).toBe(6);
    const seagrassColor = benthicPalette["Seagrass"];
    const microalgalMatsColor = benthicPalette["Microalgal Mats"];
    expect(typeof seagrassColor).toBe("string");
    expect(typeof microalgalMatsColor).toBe("string");
    expect(isGreenLikeColor(seagrassColor)).toBe(true);
    expect(isGreenLikeColor(microalgalMatsColor)).toBe(true);
    expect(seagrassColor).not.toEqual(microalgalMatsColor);
  }, 35000);

  it("mangrove-planting", async () => {
    const response = await generateColumnIntelligence(
      mangrovePlantingFixture.filename,
      mangrovePlantingFixture.geostats,
    );

    if ("error" in response) {
      throw new Error(response.error);
    }

    // console.log(JSON.stringify(response.result, null, 2));
    expect(columnIntelligenceValidator(response.result)).toBe(true);
    expect(typeof response.result.notes).toBe("string");
    expect(response.result.notes.trim().length).toBeGreaterThan(0);
    expect(Array.isArray(response.result.junk_columns)).toBe(true);
    expect(response.result.chosen_presentation_type).toBe("SIMPLE_POLYGON");
    expect(response.result.palette).toBeNull();
    expect(
      response.result.custom_palette !== null &&
        typeof response.result.custom_palette === "object" &&
        !Array.isArray(response.result.custom_palette),
    ).toBe(true);
    const paletteValues = Object.values(response.result.custom_palette ?? {});
    expect(paletteValues.length).toBe(1);
    expect(isGreenLikeColor(paletteValues[0] ?? "")).toBe(true);
  }, 35000);
});
