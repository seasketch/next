import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { getNamedLayers, parseCapabilities } from "../capabilities";

const liveDir = join(__dirname, "..", "__fixtures__", "live");

const liveFixtures = [
  "emodnet-bathymetry-capabilities.xml",
  "marine-regions-capabilities.xml",
  "gebco-capabilities.xml",
  "usgs-imagery-capabilities.xml",
];

describe("live captured fixtures", () => {
  for (const file of liveFixtures) {
    it(`parses ${file}`, () => {
      const path = join(liveDir, file);
      if (!existsSync(path)) {
        return;
      }
      const xml = readFileSync(path, "utf8");
      const meta = parseCapabilities(xml);
      expect(meta.getMap.url).toBeTruthy();
      expect(getNamedLayers(meta.layers).length).toBeGreaterThan(0);
    });
  }
});
