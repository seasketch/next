import assert from "node:assert/strict";
import gdal from "gdal-async";
import { describe, it } from "node:test";
import { clipDepthCoveredByLand } from "../src/landCover.js";

function polygon(coordinates: number[][][]) {
  return { type: "Polygon", coordinates };
}

function feature(objectClass: string, coordinates: number[][][]) {
  return {
    type: "Feature",
    properties: { obj: objectClass, cell: "US4" },
    geometry: polygon(coordinates),
  };
}

function maxLatitude(geometry: { type?: string; coordinates?: unknown }): number {
  let max = -Infinity;
  const walk = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number") {
      max = Math.max(max, value[1] as number);
      return;
    }
    for (const child of value) walk(child);
  };
  walk(geometry.coordinates);
  return max;
}

describe("depth areas covered by land", () => {
  const land = [
    [0, 0],
    [2, 0],
    [2, 1],
    [0, 1],
    [0, 0],
  ];
  // A creek channel: open water below the shore, and a finger running inland.
  const creek = [
    [0.4, -0.5],
    [0.6, -0.5],
    [0.6, 0.8],
    [0.4, 0.8],
    [0.4, -0.5],
  ];

  it("cuts a creek finger off at the shoreline and keeps the water outside", () => {
    const [depth] = clipDepthCoveredByLand([
      feature("LNDARE", [land]),
      feature("DEPARE", [creek]),
    ]).filter((item) => item.properties.obj === "DEPARE");
    assert.ok(depth);
    assert.ok(maxLatitude(depth.geometry) < 0.001);
    assert.equal(depth.geometry.type === "Polygon" || depth.geometry.type === "MultiPolygon", true);
  });

  it("drops a depth area that is entirely inland", () => {
    const inland = [
      [0.2, 0.2],
      [0.8, 0.2],
      [0.8, 0.8],
      [0.2, 0.8],
      [0.2, 0.2],
    ];
    const kept = clipDepthCoveredByLand([
      feature("LNDARE", [land]),
      feature("DEPARE", [inland]),
    ]);
    assert.deepEqual(
      kept.map((item) => item.properties.obj),
      ["LNDARE"]
    );
  });

  it("closes a narrow creek notch so the channel is no longer water", () => {
    const notched = [
      [0, 0],
      [0.45, 0],
      [0.45, 0.02],
      [0.451, 0.02],
      [0.451, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ];
    const channel = [
      [0.4502, 0.0002],
      [0.4508, 0.0002],
      [0.4508, 0.019],
      [0.4502, 0.019],
      [0.4502, 0.0002],
    ];
    const kept = clipDepthCoveredByLand([
      feature("LNDARE", [notched]),
      feature("DEPARE", [channel]),
    ]);
    const land = kept.find((item) => item.properties.obj === "LNDARE");
    assert.ok(land);
    const landPoints: number[][] = [];
    const walk = (value: unknown) => {
      if (!Array.isArray(value)) return;
      if (typeof value[0] === "number") {
        landPoints.push(value as number[]);
        return;
      }
      for (const child of value) walk(child);
    };
    walk(land.geometry.coordinates);
    assert.equal(
      landPoints.some((point) => point[1] > 0.01 && point[0] > 0.4 && point[0] < 0.5),
      false
    );
    assert.equal(
      kept.some((item) => item.properties.obj === "DEPARE"),
      false
    );
  });

  it("keeps a narrow spit of land", () => {
    const spit = [
      [0, 0],
      [0.45, 0],
      [0.45, -0.02],
      [0.451, -0.02],
      [0.451, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ];
    const [land] = clipDepthCoveredByLand([feature("LNDARE", [spit])]);
    const landPoints: number[][] = [];
    const walk = (value: unknown) => {
      if (!Array.isArray(value)) return;
      if (typeof value[0] === "number") {
        landPoints.push(value as number[]);
        return;
      }
      for (const child of value) walk(child);
    };
    walk(land.geometry.coordinates);
    assert.equal(
      landPoints.some((point) => point[1] < -0.01),
      true
    );
  });

  it("leaves a bay wider than a creek mouth open", () => {
    const bay = [
      [0, 0],
      [0.4, 0],
      [0.4, 0.02],
      [0.42, 0.02],
      [0.42, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ];
    const water = [
      [0.405, 0.001],
      [0.415, 0.001],
      [0.415, 0.015],
      [0.405, 0.015],
      [0.405, 0.001],
    ];
    const kept = clipDepthCoveredByLand([
      feature("LNDARE", [bay]),
      feature("DEPARE", [water]),
    ]);
    const depth = kept.find((item) => item.properties.obj === "DEPARE");
    assert.ok(depth);
    assert.ok(maxLatitude(depth.geometry) > 0.01);
  });

  // A creek bed in a notch wider than a closable mouth: shore on three sides.
  const creekShore = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0.4025, 1],
    [0.4025, 0.991],
    [0.4, 0.991],
    [0.4, 1],
    [0, 1],
    [0, 0],
  ];
  const creekBed = [
    [0.4, 0.991],
    [0.4025, 0.991],
    [0.4025, 1],
    [0.4, 1],
    [0.4, 0.991],
  ];
  const depthArea = (band: number, DRVAL1: number, DRVAL2: number, ring: number[][]) => ({
    type: "Feature",
    properties: { obj: "DEPARE", cell: `US${band}`, DRVAL1, DRVAL2, band },
    geometry: polygon([ring]),
  });
  const landCovers = (kept: Array<{ properties: Record<string, unknown>; geometry: unknown }>, x: number, y: number) => {
    const point = gdal.Geometry.fromGeoJson({ type: "Point", coordinates: [x, y] });
    return kept.some(
      (item) =>
        item.properties.obj === "LNDARE" &&
        gdal.Geometry.fromGeoJson(item.geometry as Record<string, unknown>).contains(point)
    );
  };

  it("joins a very shallow creek finger onto the land", () => {
    const kept = clipDepthCoveredByLand([feature("LNDARE", [creekShore]), depthArea(4, 0, 1.8, creekBed)]);
    assert.equal(
      kept.some((item) => item.properties.obj === "DEPARE"),
      false
    );
    assert.ok(landCovers(kept, 0.401, 0.995));
  });

  it("keeps a shoal that only grazes the shore as water", () => {
    const shoal = [
      [0.4, 1],
      [0.402, 1],
      [0.402, 1.012],
      [0.4, 1.012],
      [0.4, 1],
    ];
    const kept = clipDepthCoveredByLand([feature("LNDARE", [land]), depthArea(4, 0, 1.8, shoal)]);
    const depth = kept.find((item) => item.properties.obj === "DEPARE");
    assert.ok(depth);
    assert.ok(maxLatitude(depth.geometry) > 1.005);
  });

  it("keeps a shelf band along the shore that reaches past two metres", () => {
    const band = [
      [0.3, 1],
      [0.328, 1],
      [0.328, 1.001],
      [0.3, 1.001],
      [0.3, 1],
    ];
    const kept = clipDepthCoveredByLand([feature("LNDARE", [land]), depthArea(4, 0, 5.4, band)]);
    const depth = kept.find((item) => item.properties.obj === "DEPARE");
    assert.ok(depth);
    assert.ok(maxLatitude(depth.geometry) > 1.0005);
    assert.equal(landCovers(kept, 0.31, 1.0005), false);
  });

  it("keeps a creek bed deeper than two metres", () => {
    const kept = clipDepthCoveredByLand([feature("LNDARE", [creekShore]), depthArea(4, 1.8, 5.4, creekBed)]);
    assert.ok(kept.some((item) => item.properties.obj === "DEPARE"));
    assert.equal(landCovers(kept, 0.401, 0.995), false);
  });

  it("leaves a narrow notch open on a harbour chart", () => {
    const notched = [
      [0, 0],
      [0.45, 0],
      [0.45, 0.02],
      [0.451, 0.02],
      [0.451, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ];
    const [land] = clipDepthCoveredByLand([
      {
        type: "Feature",
        properties: { obj: "LNDARE", cell: "US5", band: 5 },
        geometry: polygon([notched]),
      },
    ]);
    const landPoints: number[][] = [];
    const walk = (value: unknown) => {
      if (!Array.isArray(value)) return;
      if (typeof value[0] === "number") {
        landPoints.push(value as number[]);
        return;
      }
      for (const child of value) walk(child);
    };
    walk(land.geometry.coordinates);
    assert.equal(
      landPoints.some((point) => point[1] > 0.01 && point[0] > 0.4 && point[0] < 0.5),
      true
    );
  });

  it("keeps the same finger on a harbour chart", () => {
    const kept = clipDepthCoveredByLand([
      { ...feature("LNDARE", [creekShore]), properties: { obj: "LNDARE", cell: "US5", band: 5 } },
      depthArea(5, 0, 1.8, creekBed),
    ]);
    assert.ok(kept.some((item) => item.properties.obj === "DEPARE"));
    assert.equal(landCovers(kept, 0.401, 0.995), false);
  });

  it("keeps a lake that sits in a hole in the land", () => {
    const landWithHole = [
      land,
      [
        [0.2, 0.2],
        [0.2, 0.8],
        [0.8, 0.8],
        [0.8, 0.2],
        [0.2, 0.2],
      ],
    ];
    const lake = [
      [0.3, 0.3],
      [0.7, 0.3],
      [0.7, 0.7],
      [0.3, 0.7],
      [0.3, 0.3],
    ];
    const kept = clipDepthCoveredByLand([
      feature("LNDARE", landWithHole),
      feature("DEPARE", [lake]),
    ]);
    const depth = kept.find((item) => item.properties.obj === "DEPARE");
    assert.ok(depth);
    assert.ok(maxLatitude(depth.geometry) > 0.6);
  });
});

describe("closing a creek keeps the chart's topology", () => {
  const notched = [
    [0, 0],
    [0.45, 0],
    [0.45, 0.02],
    [0.451, 0.02],
    [0.451, 0],
    [1, 0],
    [1, 1],
    [0, 1],
    [0, 0],
  ];
  const line = (objectClass: string, coordinates: number[][]) => ({
    type: "Feature",
    properties: { obj: objectClass, cell: "US4" },
    geometry: { type: "LineString", coordinates },
  });
  const kept = clipDepthCoveredByLand([
    feature("LNDARE", [notched]),
    line("COALNE", notched),
    line("DEPCNT", [
      [0.4503, 0.001],
      [0.4503, 0.015],
    ]),
    {
      type: "Feature",
      properties: { obj: "SOUNDG", cell: "US4", DEPTH: 1 },
      geometry: { type: "Point", coordinates: [0.4505, 0.01] },
    },
    {
      type: "Feature",
      properties: { obj: "SOUNDG", cell: "US4", DEPTH: 9 },
      geometry: { type: "Point", coordinates: [0.6, -0.1] },
    },
  ]);
  const byClass = (objectClass: string) => kept.filter((item) => item.properties.obj === objectClass);

  it("fills the notch into the land without leaving a hole", () => {
    const land = byClass("LNDARE");
    assert.equal(land.length, 1);
    assert.equal(land[0].geometry.type, "Polygon");
    assert.equal((land[0].geometry.coordinates as unknown[]).length, 1);
  });

  it("drops contours and soundings inside the filled water", () => {
    assert.equal(byClass("DEPCNT").length, 0);
    assert.deepEqual(
      byClass("SOUNDG").map((item) => item.properties.DEPTH),
      [9]
    );
  });

  it("draws coastline across the mouth and drops it inside the creek", () => {
    const points: number[][] = [];
    const walk = (value: unknown) => {
      if (!Array.isArray(value)) return;
      if (typeof value[0] === "number") {
        points.push(value as number[]);
        return;
      }
      for (const child of value) walk(child);
    };
    for (const coast of byClass("COALNE")) walk(coast.geometry.coordinates);
    assert.equal(
      points.some((point) => point[1] > 0.001 && point[1] < 0.019 && point[0] > 0.449 && point[0] < 0.452),
      false
    );
    const mouth = gdal.Geometry.fromGeoJson({ type: "Point", coordinates: [0.4505, 0] });
    assert.ok(
      byClass("COALNE").some((coast) => gdal.Geometry.fromGeoJson(coast.geometry).distance(mouth) < 1e-7)
    );
  });
});
