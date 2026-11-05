import assert from "node:assert/strict";
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

  it("joins a very shallow creek finger onto the land", () => {
    const shore = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ];
    const finger = {
      type: "Feature",
      properties: { obj: "DEPARE", cell: "US4", DRVAL1: 0, DRVAL2: 1.8, band: 4 },
      geometry: polygon([
        [
          [0.4, 1],
          [0.402, 1],
          [0.402, 1.012],
          [0.4, 1.012],
          [0.4, 1],
        ],
      ]),
    };
    const kept = clipDepthCoveredByLand([feature("LNDARE", [shore]), finger]);
    assert.equal(
      kept.some((item) => item.properties.obj === "DEPARE"),
      false
    );
    const land = kept.find((item) => item.properties.obj === "LNDARE");
    assert.ok(land);
    assert.ok(maxLatitude(land.geometry) > 1.005);
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
    const shore = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ];
    const finger = {
      type: "Feature",
      properties: { obj: "DEPARE", cell: "US5", DRVAL1: 0, DRVAL2: 1.8, band: 5 },
      geometry: polygon([
        [
          [0.4, 1],
          [0.402, 1],
          [0.402, 1.012],
          [0.4, 1.012],
          [0.4, 1],
        ],
      ]),
    };
    const kept = clipDepthCoveredByLand([feature("LNDARE", [shore]), finger]);
    const depth = kept.find((item) => item.properties.obj === "DEPARE");
    assert.ok(depth);
    assert.ok(maxLatitude(depth.geometry) > 1.005);
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
