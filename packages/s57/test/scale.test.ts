import assert from "node:assert/strict";
import gdal from "gdal-async";
import { describe, it } from "node:test";
import { LabelCandidate, spaceLabels } from "../src/areaLabels.js";
import { cellEdge, outlineFeatures } from "../src/outlines.js";
import { fitToSource, sourceForBand } from "../src/layers.js";
import { MaskIndex } from "../src/peel.js";

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

function mask(
  cell: string,
  band: number,
  west: number,
  south: number,
  east: number,
  north: number
) {
  return {
    cell,
    band,
    geom: gdal.Geometry.fromGeoJson(square(west, south, east, north)),
    west,
    south,
    east,
    north,
  };
}

describe("MaskIndex", () => {
  const index = new MaskIndex([
    mask("harbour", 5, -119.7, 34.39, -119.65, 34.42),
    mask("far", 5, -70.1, 41.2, -70.0, 41.3),
    mask("approach", 4, -120, 34, -119, 35),
    mask("straddle", 5, -120.02, 33.98, -119.98, 34.02),
  ]);

  it("finds only cells of the band whose box meets the feature", () => {
    const near = index.near(5, {
      minX: -119.69,
      minY: 34.4,
      maxX: -119.68,
      maxY: 34.41,
    });
    assert.deepEqual(
      near.map((found) => found.cell),
      ["harbour"]
    );
  });

  it("finds a cell spanning grid squares once", () => {
    const near = index.near(5, {
      minX: -120.01,
      minY: 33.99,
      maxX: -119.99,
      maxY: 34.01,
    });
    assert.deepEqual(
      near.map((found) => found.cell),
      ["straddle"]
    );
  });

  it("returns nothing for an empty band or a distant feature", () => {
    assert.equal(
      index.near(6, { minX: -119.69, minY: 34.4, maxX: -119.68, maxY: 34.41 })
        .length,
      0
    );
    assert.equal(
      index.near(5, { minX: 10, minY: 10, maxX: 11, maxY: 11 }).length,
      0
    );
  });
});

function candidate(
  name: string | null,
  area: number,
  x: number,
  y: number,
  minzoom: number,
  maxzoom: number
): LabelCandidate {
  return {
    key: name == null ? null : `RESARE\0${name}`,
    area,
    x,
    y,
    zooms: { minzoom, maxzoom },
    feature: { properties: {}, tippecanoe: { minzoom, maxzoom } },
  };
}

describe("spaceLabels", () => {
  it("keeps one label for two halves of an area split at a cell edge", () => {
    const placed = spaceLabels([
      candidate("Zone", 1, 0, 0, 12, 16),
      candidate("Zone", 2, 0.01, 0, 12, 16),
    ]);
    assert.equal(placed.length, 1);
    assert.equal(placed[0].area, 2);
  });

  it("repeats a name along a long area", () => {
    const placed = spaceLabels([
      candidate("Zone", 1, 0, 0, 12, 16),
      candidate("Zone", 1, 0.2, 0, 12, 16),
    ]);
    assert.equal(placed.length, 2);
  });

  it("keeps different names and unkeyed labels", () => {
    const placed = spaceLabels([
      candidate("A", 1, 0, 0, 12, 16),
      candidate("B", 1, 0, 0, 12, 16),
      candidate(null, 1, 0, 0, 12, 16),
      candidate(null, 1, 0, 0, 12, 16),
    ]);
    assert.equal(placed.length, 4);
  });

  it("shortens a nearby label to the zooms the kept one does not cover", () => {
    const placed = spaceLabels([
      candidate("Zone", 5, 0, 0, 8, 11),
      candidate("Zone", 1, 0.01, 0, 8, 16),
    ]);
    assert.equal(placed.length, 2);
    assert.deepEqual(placed[1].zooms, { minzoom: 12, maxzoom: 16 });
  });
});

describe("outlineFeatures", () => {
  const coverage = [{ geometry: square(0, 0, 1, 1) }];

  function area(cls: string, obj: string, geometry: ReturnType<typeof square>) {
    return { type: "Feature", properties: { cls, obj }, geometry };
  }

  function length(geometry: unknown): number {
    return (
      gdal.Geometry.fromGeoJson(geometry as object) as gdal.LineString
    ).getLength();
  }

  it("leaves the cell edge out of a restricted area's stroke", () => {
    const [outline] = outlineFeatures(
      [area("regulated", "RESARE", square(0.5, 0, 1, 0.5))],
      cellEdge(coverage)
    );
    assert.ok(Math.abs(length(outline.geometry) - 1) < 1e-4);
  });

  it("draws no stroke for an area that fills the cell", () => {
    assert.equal(
      outlineFeatures(
        [area("regulated", "RESARE", square(0, 0, 1, 1))],
        cellEdge(coverage)
      ).length,
      0
    );
  });

  it("strokes an inner area all round and skips filled-only classes", () => {
    const outlines = outlineFeatures(
      [
        area("regulated", "ACHARE", square(0.2, 0.2, 0.4, 0.4)),
        area("depth_area", "DEPARE", square(0.2, 0.2, 0.4, 0.4)),
      ],
      cellEdge(coverage)
    );
    assert.equal(outlines.length, 1);
    assert.ok(Math.abs(length(outlines[0].geometry) - 0.8) < 1e-6);
  });

  it("strokes the separation zone and not the traffic lane", () => {
    const outlines = outlineFeatures(
      [
        area("separation", "TSEZNE", square(0.2, 0.2, 0.8, 0.4)),
        area("separation", "TSSLPT", square(0.2, 0.4, 0.8, 0.7)),
      ],
      cellEdge(coverage)
    );
    assert.equal(outlines.length, 1);
    assert.equal(outlines[0].properties.obj, "TSEZNE");
  });

  it("outlines kelp and a jurisdictional limit, and not a seabed area", () => {
    const outlines = outlineFeatures(
      [
        area("seabed", "WEDKLP", square(0.2, 0.2, 0.4, 0.4)),
        area("seabed", "SBDARE", square(0.5, 0.2, 0.7, 0.4)),
        area("limit", "ADMARE", square(0.2, 0.5, 0.4, 0.7)),
        area("land_detail", "PRDARE", square(0.5, 0.5, 0.7, 0.7)),
        area("land_detail", "BUISGL", square(0.6, 0.6, 0.65, 0.65)),
      ],
      cellEdge(coverage)
    );
    assert.deepEqual(
      outlines.map((outline) => outline.properties.obj).sort(),
      ["ADMARE", "PRDARE", "WEDKLP"]
    );
  });

  it("strokes the whole ring when the cell has no coverage", () => {
    const [outline] = outlineFeatures(
      [area("route", "FAIRWY", square(0, 0, 1, 1))],
      cellEdge([])
    );
    assert.ok(Math.abs(length(outline.geometry) - 4) < 1e-6);
  });
});

describe("per-scale archives", () => {
  const zooms = (minzoom: number, maxzoom: number) => ({
    properties: {} as Record<string, unknown>,
    tippecanoe: { minzoom, maxzoom },
  });

  it("puts each band in its archive and unknown bands at harbour scale", () => {
    assert.equal(sourceForBand(1).id, "small");
    assert.equal(sourceForBand(3).id, "coastal");
    assert.equal(sourceForBand(4).id, "approach");
    assert.equal(sourceForBand(6).id, "harbour");
    assert.equal(sourceForBand(null).id, "harbour");
    assert.equal(sourceForBand("4").id, "harbour");
  });

  it("leaves ranges inside the archive alone", () => {
    const feature = zooms(8, 10);
    fitToSource(feature, sourceForBand(3));
    assert.deepEqual(feature.tippecanoe, { minzoom: 8, maxzoom: 10 });
    assert.deepEqual(feature.properties, {});
  });

  it("moves ranges past the archive's last zoom into properties", () => {
    const late = zooms(13, 16);
    fitToSource(late, sourceForBand(3));
    assert.deepEqual(late.tippecanoe, { minzoom: 12, maxzoom: 12 });
    assert.deepEqual(late.properties, { zmin: 13 });

    const ends = zooms(9, 14);
    fitToSource(ends, sourceForBand(3));
    assert.deepEqual(ends.tippecanoe, { minzoom: 9, maxzoom: 12 });
    assert.deepEqual(ends.properties, { zmax: 14 });

    const open = zooms(9, 16);
    fitToSource(open, sourceForBand(3));
    assert.deepEqual(open.properties, {});
  });

  it("does not touch harbour-scale features", () => {
    const feature = zooms(15, 16);
    fitToSource(feature, sourceForBand(5));
    assert.deepEqual(feature.tippecanoe, { minzoom: 15, maxzoom: 16 });
    assert.deepEqual(feature.properties, {});
  });
});
