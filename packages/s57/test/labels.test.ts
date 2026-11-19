import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { writeAreaLabels } from "../src/areaLabels.js";
import {
  codes,
  labelLightsFromStructures,
  lightDescription,
  markLabel,
  placeTopmarks,
  seabedLabel,
} from "../src/labels.js";
import { rewriteEncFeature } from "../src/layers.js";
import { lightSectorFeatures, sectorBearings, sectorColour, sectorRings } from "../src/sectors.js";

describe("chart text", () => {
  it("reads S-57 list attributes", () => {
    assert.deepEqual(codes("3,1"), [3, 1]);
    assert.deepEqual(codes(4), [4]);
    assert.deepEqual(codes(null), []);
    assert.deepEqual(codes(undefined), []);
    assert.deepEqual(codes(["1"]), []);
  });

  it("writes a light description in chart order", () => {
    assert.equal(
      lightDescription({ LITCHR: 2, SIGGRP: "(1)", COLOUR: "1", SIGPER: 4, HEIGHT: 7.6, VALNMR: 5 }),
      "Fl W 4s 8m 5M"
    );
    assert.equal(lightDescription({ LITCHR: 2, SIGGRP: "(2)", COLOUR: "1,3", SIGPER: 10 }), "Fl(2) WR 10s");
    assert.equal(lightDescription({ LITCHR: 12, SIGGRP: "(A)", COLOUR: "1", SIGPER: 8.0 }), "Mo(A) W 8s");
    assert.equal(lightDescription({}), null);
  });

  it("labels numbered marks briefly and lighthouses by name", () => {
    assert.equal(markLabel("BOYLAT", "Santa Barbara Harbor Lighted Bell Buoy SB"), '"SB"');
    assert.equal(markLabel("LIGHTS", "Channel Islands Harbor Light 4"), '"4"');
    assert.equal(markLabel("LIGHTS", "Santa Barbara Light"), "Santa Barbara Light");
    assert.equal(markLabel("LIGHTS", "Santa Barbara Harbor Lighted Bell Buoy"), null);
    assert.equal(markLabel("BOYSPP", "Data Buoy"), null);
    assert.equal(markLabel("BOYLAT", undefined), null);
  });

  it("abbreviates the seabed", () => {
    assert.equal(seabedLabel({ NATSUR: "4", NATQUA: "1" }), "fS");
    assert.equal(seabedLabel({ NATSUR: "4,1" }), "S.M");
    assert.equal(seabedLabel({ NATSUR: "9" }), "R");
    assert.equal(seabedLabel({}), null);
  });

  it("keeps GDAL list attributes on the tile feature", () => {
    const feature = rewriteEncFeature(
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-119.69, 34.39] },
        properties: { COLOUR: ["1"], LITCHR: 2, SIGPER: 4, NATSUR: ["4", "1"], OBJNAM: "Santa Barbara Light" },
      },
      { cell: "US5CA2HS", band: 5, layer: "aid", objectClass: "LIGHTS" }
    );
    assert.ok(feature);
    const properties = feature.properties as Record<string, unknown>;
    assert.equal(properties.COLOUR, "1");
    assert.equal(properties.colour, 1);
    assert.equal(properties.litdsn, "Fl W 4s");
    assert.equal(properties.label, "Santa Barbara Light");
  });
});

describe("light sectors", () => {
  it("turns seaward bearings into the sector seen from the light", () => {
    assert.deepEqual(sectorBearings({ SECTR1: 270, SECTR2: 90 }), [90, 270]);
    assert.deepEqual(sectorBearings({ SECTR1: 10, SECTR2: 20 }), [190, 200]);
    assert.equal(sectorBearings({ SECTR1: 0, SECTR2: 360 }), null);
    assert.equal(sectorBearings({}), null);
  });

  it("draws white sectors in yellow, as S-52 does", () => {
    assert.equal(sectorColour({ COLOUR: "1" }), "yellow");
    assert.equal(sectorColour({ COLOUR: "3" }), "red");
    assert.equal(sectorColour({}), "magenta");
  });

  it("writes one arc and two legs per zoom, the same size on screen", () => {
    const sectors = lightSectorFeatures({
      properties: { obj: "LIGHTS", cell: "US5CA2HS", band: 5, SECTR1: 270, SECTR2: 90, COLOUR: "3" },
      geometry: { type: "Point", coordinates: [-119.69, 34.39] },
      tippecanoe: { minzoom: 12, maxzoom: 14 },
    });
    assert.equal(sectors.length, 9);
    const arcs = sectors.filter((sector) => sector.properties.part === "arc");
    assert.deepEqual(
      arcs.map((arc) => arc.tippecanoe.minzoom),
      [12, 13, 14]
    );
    const reach = (arc: (typeof arcs)[number]) => {
      const coordinates = arc.geometry.coordinates as unknown as number[][];
      return Math.abs(coordinates[0][1] - 34.39) + Math.abs(coordinates[0][0] + 119.69);
    };
    assert.ok(Math.abs(reach(arcs[0]) / reach(arcs[1]) - 2) < 0.01);
    assert.equal(arcs[0].properties.colour, "red");
  });

  const light = (SECTR1: number, SECTR2: number, extra: Record<string, unknown> = {}) => ({
    properties: { obj: "LIGHTS", cell: "US5CA2HS", SECTR1, SECTR2, ...extra },
    geometry: { type: "Point", coordinates: [-119.69, 34.39] },
    tippecanoe: { minzoom: 12, maxzoom: 12 },
  });

  it("keeps abutting sectors of one light on one ring", () => {
    assert.deepEqual(sectorRings([light(0, 90), light(90, 180), light(180, 270)]), [0, 0, 0]);
  });

  it("moves an overlapping sector out to the next ring, longer range first", () => {
    assert.deepEqual(
      sectorRings([light(0, 90, { VALNMR: 4 }), light(45, 135, { VALNMR: 9 }), light(100, 120, { VALNMR: 2 })]),
      [1, 0, 1]
    );
  });

  it("does not stagger lights at different positions or in different cells", () => {
    const moved = light(0, 90);
    moved.geometry.coordinates = [-119.7, 34.39];
    const other = light(0, 90, { cell: "US4CA1HO" });
    assert.deepEqual(sectorRings([light(0, 90), moved, other]), [0, 0, 0]);
  });

  it("sees overlap across north", () => {
    assert.deepEqual(sectorRings([light(150, 210), light(180, 200)]), [0, 1]);
  });

  it("draws an outer ring's arc further out", () => {
    const [inner] = lightSectorFeatures(light(0, 90), 0);
    const [outer] = lightSectorFeatures(light(0, 90), 1);
    const reach = (arc: typeof inner) => {
      const [lng, lat] = (arc.geometry.coordinates as unknown as number[][])[0];
      return Math.hypot(lng + 119.69, lat - 34.39);
    };
    assert.ok(reach(outer) > reach(inner) * 1.2);
  });
});

describe("labels placed once", () => {
  it("names an unnamed light after the beacon it stands on", () => {
    const at = { type: "Point", coordinates: [-119.7226, 34.3963] };
    const beacon = { properties: { obj: "BCNSPP", OBJNAM: "Santa Barbara Light" }, geometry: at };
    const light = { properties: { obj: "LIGHTS" } as Record<string, unknown>, geometry: at };
    const elsewhere = {
      properties: { obj: "LIGHTS" } as Record<string, unknown>,
      geometry: { type: "Point", coordinates: [-119.7, 34.39] },
    };
    labelLightsFromStructures([beacon, light, elsewhere]);
    assert.equal(light.properties.label, "Santa Barbara Light");
    assert.equal(elsewhere.properties.label, undefined);
  });

  it("puts one label point inside each named area, even a C-shaped one", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "s57-labels-"));
    const areas = path.join(dir, "areas.geojsonl");
    const out = path.join(dir, "labels.geojsonl");
    // A C open to the east: its centroid lies in the gap.
    const town = [
      [
        [0, 0],
        [0.1, 0],
        [0.1, 0.02],
        [0.02, 0.02],
        [0.02, 0.08],
        [0.1, 0.08],
        [0.1, 0.1],
        [0, 0.1],
        [0, 0],
      ],
    ];
    const line = (properties: Record<string, unknown>) =>
      JSON.stringify({
        type: "Feature",
        properties,
        geometry: { type: "Polygon", coordinates: town },
        tippecanoe: { layer: "land", minzoom: 10, maxzoom: 13 },
      });
    await writeFile(
      areas,
      [line({ obj: "BUAARE", OBJNAM: "Oxnard" }), line({ obj: "BUAARE" }), line({ obj: "LNDARE" })].join("\n")
    );
    assert.equal(await writeAreaLabels(areas, out), 1);
    const [label] = (await readFile(out, "utf8")).trim().split("\n").map((text) => JSON.parse(text));
    const [x, y] = label.geometry.coordinates;
    assert.ok(x < 0.02 || y < 0.02 || y > 0.08, `${x},${y} is inside the C`);
    assert.equal(label.properties.labelpoint, true);
    assert.deepEqual(label.tippecanoe, { layer: "land", minzoom: 10, maxzoom: 13 });
  });
});

describe("topmarks", () => {
  const point = (obj: string, lng: number, extra: Record<string, unknown> = {}) => ({
    properties: { obj, ...extra } as Record<string, unknown>,
    geometry: { type: "Point", coordinates: [lng, 34] },
  });

  it("stands a topmark on the mark at its position", () => {
    const topmark = point("TOPMAR", -120);
    const kept = placeTopmarks([point("BOYSAW", -120, { mark: "safe" }), topmark]);
    assert.equal(kept.length, 2);
    assert.equal(topmark.properties.hosted, true);
  });

  it("drops a topmark the cardinal or isolated-danger symbol already draws", () => {
    const kept = placeTopmarks([
      point("BOYCAR", -120, { mark: "cardinal" }),
      point("TOPMAR", -120),
      point("BCNISD", -121, { mark: "isolated" }),
      point("TOPMAR", -121),
    ]);
    assert.deepEqual(
      kept.map((feature) => feature.properties.obj),
      ["BOYCAR", "BCNISD"]
    );
  });

  it("draws a topmark with no structure under it on its own position", () => {
    const topmark = point("TOPMAR", -122);
    assert.equal(placeTopmarks([point("BOYSAW", -120, { mark: "safe" }), topmark]).length, 2);
    assert.equal(topmark.properties.hosted, undefined);
  });
});
