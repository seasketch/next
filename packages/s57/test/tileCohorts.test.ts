import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { releaseMinZoom } from "../src/tileCohorts.js";

describe("releaseMinZoom", () => {
  it("drops the field tippecanoe collapses and keeps the zoom", () => {
    const feature = { tippecanoe: { layer: "land", minzoom: 7, maxzoom: 12 } };
    assert.equal(releaseMinZoom(feature), 7);
    assert.deepEqual(feature.tippecanoe, { layer: "land", maxzoom: 12 });
  });

  it("treats a missing or overview zoom as 0", () => {
    assert.equal(releaseMinZoom({ tippecanoe: { maxzoom: 10 } }), 0);
    assert.equal(releaseMinZoom({}), 0);
    assert.equal(releaseMinZoom({ tippecanoe: { minzoom: 0 } }), 0);
  });
});

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(command, args, (error) => (error ? reject(error) : resolve()));
  });
}

describe("tippecanoe cohorts", () => {
  it("keeps every polygon in a tile when the zoom is on the command", async () => {
    let present = true;
    await new Promise<void>((resolve) => {
      execFile("tippecanoe", ["--version"], (error) => {
        present = !error;
        resolve();
      });
    });
    if (!present) return;

    const dir = await mkdtemp(path.join(tmpdir(), "s57-cohorts-"));
    try {
      const features = [34.02, 34.04, 34.06, 34.08, 34.1].map((lat, index) => ({
        type: "Feature",
        properties: { OBJNAM: `t${index}` },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-120.5, lat],
              [-120.48, lat],
              [-120.49, lat + 0.008],
              [-120.5, lat],
            ],
          ],
        },
        tippecanoe: { layer: "land", minzoom: 7, maxzoom: 12 },
      }));
      const input = path.join(dir, "land.geojsonl");
      const minzoom = releaseMinZoom(features[0]);
      for (const feature of features.slice(1)) releaseMinZoom(feature);
      await writeFile(input, features.map((feature) => JSON.stringify(feature)).join("\n") + "\n");
      const archive = path.join(dir, "land.pmtiles");
      await run("tippecanoe", [
        "-o",
        archive,
        "--force",
        "--quiet",
        "--projection=EPSG:4326",
        `--minimum-zoom=${minzoom}`,
        "--maximum-zoom=12",
        "--no-tiny-polygon-reduction",
        "--no-tile-size-limit",
        "--no-feature-limit",
        input,
      ]);
      const decoded = await new Promise<string>((resolve, reject) => {
        execFile("tippecanoe-decode", [archive, "9", "84", "204"], (error, stdout) => {
          if (error) reject(error);
          else resolve(stdout);
        });
      });
      const tile = JSON.parse(decoded) as {
        features: Array<{ features?: Array<{ properties?: { OBJNAM?: string } }> }>;
      };
      const names = tile.features.flatMap((layer) =>
        (layer.features || []).map((feature) => feature.properties?.OBJNAM)
      );
      assert.deepEqual(names.sort(), ["t0", "t1", "t2", "t3", "t4"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
