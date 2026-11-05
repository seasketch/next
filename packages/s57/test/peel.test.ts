import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { describe, it } from "node:test";
import { peelFeatures } from "../src/peel.js";

function square(west: number, south: number, east: number, north: number) {
  return {
    type: "Polygon",
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    ],
  };
}

function feature(
  cell: string,
  band: number,
  layer: string,
  minzoom: number,
  geometry: ReturnType<typeof square>
) {
  return {
    type: "Feature",
    properties: { cell, band, cls: layer },
    geometry,
    tippecanoe: { layer, minzoom, maxzoom: 16 },
  };
}

async function run(
  features: Array<ReturnType<typeof feature>>,
  masks: Array<ReturnType<typeof feature>>
) {
  const work = await mkdtemp(path.join(tmpdir(), "s57-peel-"));
  try {
    const featuresPath = path.join(work, "features.geojsonl");
    const masksPath = path.join(work, "masks.geojson");
    const outPath = path.join(work, "out.geojsonl");
    const specPath = path.join(work, "spec.json");
    await writeFile(featuresPath, features.map((item) => JSON.stringify(item)).join("\n") + "\n");
    await writeFile(
      masksPath,
      JSON.stringify({
        type: "FeatureCollection",
        features: masks.map((item) => ({
          type: "Feature",
          properties: { cell: item.properties.cell, band: item.properties.band },
          geometry: item.geometry,
        })),
      })
    );
    await writeFile(specPath, JSON.stringify({ maxZoom: 16 }));
    await peelFeatures(featuresPath, masksPath, outPath, specPath);
    const text = await readFile(outPath, "utf8");
    return text
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as { properties: { cell: string; cls: string }; tippecanoe: { maxzoom: number } });
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

describe("coverage peel", () => {
  const box = square(-120, 34, -119, 35);

  it("keeps contours until the covering cell draws them", async () => {
    const out = await run(
      [feature("US3", 3, "depth_contour", 10, box), feature("US4", 4, "depth_contour", 12, box)],
      [feature("US4", 4, "depth_contour", 12, box)]
    );
    const coastal = out.filter((item) => item.properties.cell === "US3");
    const approach = out.filter((item) => item.properties.cell === "US4");
    assert.equal(coastal.length, 1);
    assert.equal(coastal[0].tippecanoe.maxzoom, 11);
    assert.equal(approach[0].tippecanoe.maxzoom, 16);
  });

  it("drops a feature once the covering cell already draws that layer", async () => {
    const out = await run(
      [feature("US3", 3, "depth_contour", 10, box), feature("US4", 4, "depth_contour", 10, box)],
      [feature("US4", 4, "depth_contour", 10, box)]
    );
    assert.deepEqual(
      out.map((item) => item.properties.cell),
      ["US4"]
    );
  });

  it("a cell without the layer does not erase it", async () => {
    const out = await run(
      [feature("US3", 3, "depth_contour", 10, box), feature("US4", 4, "sounding", 12, box)],
      [feature("US4", 4, "sounding", 12, box)]
    );
    const contours = out.filter((item) => item.properties.cls === "depth_contour");
    assert.equal(contours.length, 1);
    assert.equal(contours[0].tippecanoe.maxzoom, 16);
  });
});
