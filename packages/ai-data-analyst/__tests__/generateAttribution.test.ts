/**
 * Live calls to the gateway in `generateAttribution` (no mocks).
 * Loads `.env` from this package via `vitest.config.ts` (Vite `loadEnv`).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generateAttribution } from "../lib/client";

const reefMetadataXml = readFileSync(
  join(
    process.cwd(),
    "__tests__",
    "metadata/Revised_reef-associated_bioregions_FJ.shp.xml",
  ),
  "utf8",
);

const eezMetadataXml = readFileSync(
  join(process.cwd(), "__tests__", "metadata/eez.xml"),
  "utf8",
);

const marineRegionsMetadata = readFileSync(
  join(process.cwd(), "__tests__", "metadata/LICENSE_EEZ_LAND_v4.txt"),
  "utf8",
);

describe.concurrent("generateAttribution", () => {
  it("returns schema-valid attribution for reef bioregions FGDC XML", async () => {
    const result = await generateAttribution([reefMetadataXml]);

    if ("error" in result) {
      throw new Error(result.error);
    }

    expect(
      result.attribution === null ||
        (typeof result.attribution === "string" &&
          result.attribution.length <= 48),
    ).toBe(true);

    expect(result.attribution).toEqual(
      expect.stringMatching(/^IUCN [-\s]*Oceania$/),
    );
  }, 6000);

  it("returns schema-valid attribution for EEZ XML", async () => {
    const result = await generateAttribution([eezMetadataXml]);

    if ("error" in result) {
      throw new Error(result.error);
    }

    expect(result.attribution).toEqual(expect.stringMatching(/^MFMRD$/));
  }, 6000);

  it("returns schema-valid attribution for Marine Regions", async () => {
    const result = await generateAttribution([marineRegionsMetadata]);

    if ("error" in result) {
      throw new Error(result.error);
    }

    expect(result.attribution).toEqual(
      expect.stringMatching(/^Flanders Marine Institute/),
    );
  }, 6000);
});
