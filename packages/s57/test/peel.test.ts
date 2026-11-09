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
  geometry: ReturnType<typeof square>,
  obj?: string
) {
  return {
    type: "Feature",
    properties: obj ? { cell, band, cls: layer, obj } : { cell, band, cls: layer },
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
      .map(
        (line) =>
          JSON.parse(line) as {
            properties: { cell: string; cls: string; retire?: number };
            tippecanoe: { maxzoom: number };
          }
      );
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
    assert.equal(coastal[0].properties.retire, 12);
    assert.equal(approach[0].tippecanoe.maxzoom, 16);
    assert.equal(approach[0].properties.retire, undefined);
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

  it("hands an anchorage over when the harbour anchorage appears, not its restricted areas", async () => {
    const out = await run(
      [
        feature("US4", 4, "regulated", 12, box, "ACHARE"),
        feature("US5", 5, "regulated", 12, box, "RESARE"),
        feature("US5", 5, "regulated", 14, box, "ACHARE"),
      ],
      [feature("US5", 5, "regulated", 12, box)]
    );
    const approach = out.filter((item) => item.properties.cell === "US4");
    assert.equal(approach.length, 1);
    assert.equal(approach[0].tippecanoe.maxzoom, 13);
    assert.equal(approach[0].properties.retire, 14);
  });

  it("hands a buoy over when the covering cell's copy of that buoy appears", async () => {
    const buoy = { type: "Point", coordinates: [-119.5, 34.5] } as unknown as ReturnType<typeof square>;
    const nearby = { type: "Point", coordinates: [-119.5005, 34.5004] } as unknown as ReturnType<typeof square>;
    const elsewhere = { type: "Point", coordinates: [-119.2, 34.8] } as unknown as ReturnType<typeof square>;
    const out = await run(
      [
        feature("US3", 3, "aid", 8, buoy, "BOYSPP"),
        feature("US4", 4, "aid", 10, elsewhere, "BOYSPP"),
        feature("US4", 4, "aid", 12, nearby, "BOYSPP"),
      ],
      [feature("US4", 4, "aid", 10, box)]
    );
    const coastal = out.filter((item) => item.properties.cell === "US3");
    assert.equal(coastal.length, 1);
    assert.equal(coastal[0].tippecanoe.maxzoom, 11);
    assert.equal(coastal[0].properties.retire, 12);
  });

  it("hands over to the closest copy, not a neighbouring rock that appears earlier", async () => {
    const rock = { type: "Point", coordinates: [-119.5, 34.5] } as unknown as ReturnType<typeof square>;
    const copy = { type: "Point", coordinates: [-119.5002, 34.5001] } as unknown as ReturnType<typeof square>;
    const neighbour = { type: "Point", coordinates: [-119.502, 34.5015] } as unknown as ReturnType<typeof square>;
    const out = await run(
      [
        feature("US3", 3, "hazard", 8, rock, "UWTROC"),
        feature("US4", 4, "hazard", 10, neighbour, "UWTROC"),
        feature("US4", 4, "hazard", 11, copy, "UWTROC"),
      ],
      [feature("US4", 4, "hazard", 10, box)]
    );
    const coastal = out.filter((item) => item.properties.cell === "US3");
    assert.equal(coastal[0].tippecanoe.maxzoom, 10);
    assert.equal(coastal[0].properties.retire, 11);
  });

  it("keeps an island the covering cell does not redraw", async () => {
    const island = square(-119.8, 34.0, -119.6, 34.1);
    const rock = square(-119.2, 34.4, -119.19, 34.41);
    const cell = square(-120, 33.9, -119, 34.5);
    const out = await run(
      [feature("US2", 2, "land", 6, island, "LNDARE"), feature("US3", 3, "land", 8, rock, "LNDARE")],
      [feature("US3", 3, "land", 8, cell)]
    );
    const general = out.filter((item) => item.properties.cell === "US2");
    assert.equal(general.length, 1);
    assert.equal(general[0].tippecanoe.maxzoom, 16);
    assert.equal(general[0].properties.retire, undefined);
  });

  it("retires an island when the larger chart redraws that island", async () => {
    const island = square(-119.8, 34.0, -119.6, 34.1);
    const redraw = square(-119.81, 33.99, -119.59, 34.11);
    const cell = square(-120, 33.9, -119, 34.5);
    const out = await run(
      [feature("US2", 2, "land", 6, island, "LNDARE"), feature("US3", 3, "land", 8, redraw, "LNDARE")],
      [feature("US3", 3, "land", 8, cell)]
    );
    const general = out.filter((item) => item.properties.cell === "US2");
    assert.equal(general.length, 1);
    assert.equal(general[0].tippecanoe.maxzoom, 7);
    assert.equal(general[0].properties.retire, 8);
  });

  it("does not cut a traffic lane where the covering cell redraws only a piece", async () => {
    const lane = square(-120.5, 34.2, -119.5, 34.35);
    const piece = square(-120.5, 34.2, -120.3, 34.35);
    const cell = square(-120.6, 34.0, -119.4, 34.5);
    const out = await run(
      [
        feature("US2", 2, "separation", 6, lane, "TSSLPT"),
        feature("US3", 3, "separation", 8, piece, "TSSLPT"),
      ],
      [feature("US3", 3, "separation", 8, cell)]
    );
    const general = out.filter((item) => item.properties.cell === "US2");
    assert.equal(general.length, 1);
    assert.equal(general[0].tippecanoe.maxzoom, 16);
    assert.equal(general[0].properties.retire, undefined);
  });

  it("keeps a buoy the covering cell does not carry", async () => {
    const buoy = { type: "Point", coordinates: [-119.5, 34.5] } as unknown as ReturnType<typeof square>;
    const elsewhere = { type: "Point", coordinates: [-119.2, 34.8] } as unknown as ReturnType<typeof square>;
    const out = await run(
      [feature("US3", 3, "aid", 8, buoy, "BOYSPP"), feature("US4", 4, "aid", 10, elsewhere, "BOYSPP")],
      [feature("US4", 4, "aid", 10, box)]
    );
    const coastal = out.filter((item) => item.properties.cell === "US3");
    assert.equal(coastal.length, 1);
    assert.equal(coastal[0].tippecanoe.maxzoom, 16);
  });
});
