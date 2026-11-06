import assert from "node:assert/strict";
import gdal from "gdal-async";
import { describe, it } from "node:test";
import { trackArrows, trafficArrows } from "../src/traffic.js";

function lane(
  ring: number[][],
  properties: Record<string, unknown> = {},
  zooms = { minzoom: 8, maxzoom: 14 }
) {
  return {
    type: "Feature",
    properties: { obj: "TSSLPT", cls: "separation", ORIENT: 90, ...properties },
    geometry: { type: "Polygon", coordinates: [ring] },
    tippecanoe: zooms,
  };
}

/** A lane running east, 0.5° long and about 2 km wide. */
const eastbound = [
  [0, 0],
  [0.5, 0],
  [0.5, 0.02],
  [0, 0.02],
  [0, 0],
];

function arrowsAt(features: ReturnType<typeof trafficArrows>, zoom: number) {
  return features.filter((feature) => {
    const range = (feature as { tippecanoe: { minzoom: number; maxzoom: number } }).tippecanoe;
    return range.minzoom <= zoom && zoom <= range.maxzoom;
  });
}

describe("traffic lane arrows", () => {
  const arrows = trafficArrows([lane(eastbound)]);

  it("puts arrows inside the lane, across its length", () => {
    const shown = arrowsAt(arrows, 10);
    assert.ok(shown.length >= 2);
    const polygon = gdal.Geometry.fromGeoJson({ type: "Polygon", coordinates: [eastbound] });
    for (const arrow of shown) {
      const [x, y] = (arrow.geometry as { coordinates: number[] }).coordinates;
      assert.ok(x > 0.02 && x < 0.48);
      assert.ok(polygon.contains(gdal.Geometry.fromGeoJson({ type: "Point", coordinates: [x, y] })));
      assert.equal(arrow.properties.flow, 1);
      assert.equal(arrow.properties.ORIENT, 90);
      assert.equal((arrow as { tippecanoe: { layer: string } }).tippecanoe.layer, "separation");
    }
    const xs = shown.map((arrow) => (arrow.geometry as { coordinates: number[] }).coordinates[0]);
    assert.ok(Math.max(...xs) - Math.min(...xs) > 0.2);
  });

  it("uses a closer spacing once the scheme is zoomed in", () => {
    assert.ok(arrowsAt(arrows, 12).length > arrowsAt(arrows, 10).length);
  });

  it("gives a short lane one arrow", () => {
    const short = trafficArrows([
      lane([
        [0, 0],
        [0.05, 0],
        [0.05, 0.02],
        [0, 0.02],
        [0, 0],
      ]),
    ]);
    assert.equal(arrowsAt(short, 10).length, 1);
    assert.equal(arrowsAt(short, 12).length, 1);
  });

  it("draws none for a lane with no direction, or for the separation zone", () => {
    const kept = trafficArrows([
      lane(eastbound, { ORIENT: undefined }),
      lane(eastbound, { obj: "TSEZNE", ORIENT: 90 }),
    ]);
    assert.equal(kept.length, 0);
  });

  it("stays inside the lane's own zoom range", () => {
    const shown = trafficArrows([lane(eastbound, {}, { minzoom: 10, maxzoom: 10 })]);
    assert.ok(shown.length > 0);
    assert.ok(arrowsAt(shown, 12).length === 0);
    assert.ok(arrowsAt(shown, 10).length > 0);
  });
});

describe("recommended track arrows", () => {
  function track(
    coordinates: number[][],
    orient: number | undefined = 90,
    zooms = { minzoom: 11, maxzoom: 16 }
  ) {
    return {
      type: "Feature",
      properties: { obj: "RECTRC", cls: "route", ORIENT: orient },
      geometry: { type: "LineString", coordinates },
      tippecanoe: { layer: "route", ...zooms },
    };
  }

  it("spaces arrows along an eastbound track, pointing east", () => {
    const arrows = trackArrows([
      track([
        [0, 0],
        [0.3, 0],
      ]),
    ]);
    const shown = arrowsAt(arrows, 12);
    assert.ok(shown.length >= 2);
    for (const arrow of shown) {
      const [x, y] = (arrow.geometry as { coordinates: number[] }).coordinates;
      assert.ok(x > 0 && x < 0.3);
      assert.ok(Math.abs(y) < 1e-6);
      assert.ok(Math.abs((arrow.properties.ORIENT as number) - 90) < 1);
      assert.equal((arrow as { tippecanoe: { layer: string } }).tippecanoe.layer, "route");
    }
    assert.ok(arrowsAt(arrows, 15).length > shown.length);
  });

  it("turns the arrows around when the stored direction faces the other way", () => {
    const arrows = arrowsAt(
      trackArrows([
        track(
          [
            [0, 0],
            [0.3, 0],
          ],
          270
        ),
      ]),
      12
    );
    assert.ok(arrows.length >= 1);
    for (const arrow of arrows) assert.ok(Math.abs((arrow.properties.ORIENT as number) - 270) < 1);
  });

  it("gives a short track one arrow and ignores other classes and bad geometry", () => {
    const short = trackArrows([
      track([
        [0, 0],
        [0.02, 0],
      ]),
    ]);
    assert.equal(arrowsAt(short, 12).length, 1);
    assert.equal(arrowsAt(short, 15).length, 1);
    const good = track([
      [0, 0],
      [0.3, 0],
    ]);
    const junk = [
      good,
      { type: "Feature", properties: { obj: "NAVLNE" }, geometry: { type: "LineString", coordinates: [[0, 0], [1, 0]] } },
      { type: "Feature", properties: { obj: "RECTRC" }, geometry: null },
      { type: "Feature", properties: null, geometry: { type: "LineString", coordinates: [[0, 0], [1, 0]] } },
      { type: "Feature", properties: { obj: "RECTRC", ORIENT: 90 }, geometry: { type: "LineString", coordinates: [[Number.NaN, 0], [1, 0]] } },
    ];
    assert.equal(trackArrows(junk as unknown as Parameters<typeof trackArrows>[0]).length, trackArrows([good]).length);
  });
});
