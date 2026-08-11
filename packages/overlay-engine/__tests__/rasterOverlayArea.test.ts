import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { Feature, MultiPolygon, Polygon } from "geojson";
import calcBBox from "@turf/bbox";
import calcArea from "@turf/area";
// @ts-ignore
import proj4 from "proj4";
import {
  attachRasterOverlayAreaOverlapScope,
  combineMetricsForFragments,
  combineRasterOverlayAreaMetrics,
  RasterOverlayAreaMetricValue,
  RasterOverlayAreaOverlapInfo,
} from "../src/metrics/metrics";
import {
  calculateRasterOverlayArea,
  histogramToClassCounts,
  pixelCountsToAreaKm2,
} from "../src/rasterOverlayArea";
import { computeBufferedSubjectAndCollar } from "../src/metrics/computeSubjectCollar";
import * as clipping from "polyclip-ts";

const FIXTURE_DIR = join(__dirname, "fixtures/raster-overlay-area");

function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, name), "utf8")) as T;
}

proj4.defs(
  "EPSG:6933",
  "+proj=cea +lat_ts=30 +lon_0=0 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs +type=crs",
);
proj4.defs(
  "EPSG:3857",
  "+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs +type=crs",
);

function reprojectFeature(
  feature: Feature<Polygon | MultiPolygon>,
  epsg: number,
): Feature<Polygon | MultiPolygon> {
  const project = proj4("EPSG:4326", `EPSG:${epsg}`);
  const mapCoords = (coords: any): any => {
    return typeof coords[0] === "number"
      ? project.forward([coords[0], coords[1]])
      : coords.map(mapCoords);
  };
  const geom = JSON.parse(JSON.stringify(feature.geometry));
  geom.coordinates = mapCoords(geom.coordinates);
  return { ...feature, geometry: geom };
}

describe("histogramToClassCounts / pixelCountsToAreaKm2", () => {
  it("builds * from valid count without groupBy", () => {
    expect(histogramToClassCounts([[1, 10]], false, 10)).toEqual({ "*": 10 });
  });

  it("groups by rounded pixel value and merges collisions", () => {
    const counts = histogramToClassCounts(
      [
        [1.2, 3],
        [1.4, 2],
        [2, 5],
      ],
      true,
      10,
    );
    expect(counts).toEqual({ "*": 10, "1": 5, "2": 5 });
  });

  it("throws when class count exceeds MAX", () => {
    const hist: [number, number][] = [];
    for (let i = 0; i < 40; i++) {
      hist.push([i, 1]);
    }
    expect(() => histogramToClassCounts(hist, true, 40)).toThrow(/max 32/i);
  });

  it("converts rescaled (native-pixel) counts to km²", () => {
    // geoblaze rescale:true already returns fractional native pixels.
    // 4 native-pixel equivalents × 1 m × 1 m = 4 m² = 4e-6 km²
    const areas = pixelCountsToAreaKm2({ "*": 4 }, { mX: 1, mY: 1 });
    expect(areas["*"]).toBeCloseTo(4e-6, 12);
  });
});

describe("combineRasterOverlayAreaMetrics", () => {
  it("returns zero areas for empty input", () => {
    expect(combineRasterOverlayAreaMetrics([])).toEqual({
      areas: { "*": 0 },
    });
  });

  it("sums unbuffered areas per key", () => {
    const combined = combineRasterOverlayAreaMetrics([
      { areas: { "*": 1, "1": 0.4 } },
      { areas: { "*": 2, "1": 0.6, "2": 1 } },
    ]);
    expect(combined.areas).toEqual({ "*": 3, "1": 1, "2": 1 });
    expect(combined.overlap).toBeUndefined();
  });

  it("omits overlap when buffered bboxes are disjoint", () => {
    const a: RasterOverlayAreaMetricValue = {
      areas: { "*": 10, "1": 10 },
      overlap: {
        bufferKm: 1,
        bbox: [0, 0, 1, 1],
        bboxAreaKm2: 100,
        collarAreas: { "*": 2, "1": 2 },
        innerAreas: { "*": 8, "1": 8 },
      },
    };
    const b: RasterOverlayAreaMetricValue = {
      areas: { "*": 10, "1": 10 },
      overlap: {
        bufferKm: 1,
        bbox: [10, 10, 11, 11],
        bboxAreaKm2: 100,
        collarAreas: { "*": 2, "1": 2 },
        innerAreas: { "*": 8, "1": 8 },
      },
    };
    const combined = combineRasterOverlayAreaMetrics([a, b]);
    expect(combined.areas["1"]).toBe(20);
    expect(combined.overlap).toBeUndefined();
  });

  it("omits overlap when bboxes intersect but collars are empty (not source-positive)", () => {
    const mk = (bbox: [number, number, number, number]): RasterOverlayAreaMetricValue => ({
      areas: { "*": 10, "1": 10 },
      overlap: {
        bufferKm: 1,
        bbox,
        bboxAreaKm2: 100,
        collarAreas: { "*": 0, "1": 0 },
        innerAreas: { "*": 10, "1": 10 },
      },
    });
    const combined = combineRasterOverlayAreaMetrics([
      mk([0, 0, 2, 2]),
      mk([1, 1, 3, 3]),
    ]);
    expect(combined.overlap).toBeUndefined();
  });

  it("computes λ and Ê = U·λ for source-positive pairs; silence when Ê/naive < 10%", () => {
    // Worked micro-example from the plan
    const mk = (): RasterOverlayAreaMetricValue => ({
      areas: { "1": 10 },
      overlap: {
        bufferKm: 1,
        bbox: [0, 0, 1, 1],
        bboxAreaKm2: 100,
        collarAreas: { "1": 2 },
        innerAreas: { "1": 8 },
      },
    });
    // Force bbox overlap of 25% of min bbox via identical bboxes → λ=1 would be too high.
    // Instead set bboxArea=100 and overlap area from intersection of [0,0,1,1]x[0.5,0,1.5,1].
    // Plan example used λ=0.25 with bboxOverlap=25 on area 100 — synthesize via large equal bboxes
    // that we can't easily get from degree boxes without faking bboxAreaKm2.
    // Use identical bboxes so λ=1, then scale collars so Ê/naive = 0.025.
    const a = mk();
    const b = mk();
    (a.overlap as RasterOverlayAreaOverlapInfo).bbox = [0, 0, 10, 10];
    (b.overlap as RasterOverlayAreaOverlapInfo).bbox = [5, 0, 15, 10];
    // Geodesic area of degree boxes won't be 100 — instead assert relative structure.
    const combined = combineRasterOverlayAreaMetrics([a, b]);
    expect(combined.areas["1"]).toBe(20);
    expect(combined.overlap).toBeDefined();
    if (!combined.overlap || !("perClass" in combined.overlap)) {
      throw new Error("expected combine overlap");
    }
    const pc = combined.overlap.perClass["1"];
    expect(pc.overcountMin).toBe(0);
    expect(pc.naiveSum).toBe(20);
    expect(pc.overcountMax).toBeCloseTo(2, 6); // U = min(2,2)
    expect(pc.overcountEstimate).toBeGreaterThan(0);
    expect(pc.overcountEstimate).toBeLessThanOrEqual(pc.overcountMax);
    // With λ from real geodesic overlap of those degree boxes, estimate/naive may or may not hit 10%.
    // Explicit silence case: tiny estimate relative to naive
    expect(combined.overlap.flagged).toBe(
      pc.overcountEstimate / pc.naiveSum >= 0.1,
    );
  });

  it("flags when overcountEstimate / naiveSum ≥ 10%", () => {
    const mk = (collar: number): RasterOverlayAreaMetricValue => ({
      areas: { "1": 10 },
      overlap: {
        bufferKm: 1,
        // Nearly identical bboxes → λ ≈ 1
        bbox: [0, 0, 1, 1],
        bboxAreaKm2: 1,
        collarAreas: { "1": collar },
        innerAreas: { "1": 10 - collar },
      },
    });
    const combined = combineRasterOverlayAreaMetrics([mk(8), mk(8)]);
    expect(combined.overlap).toBeDefined();
    if (!combined.overlap || !("flagged" in combined.overlap)) {
      throw new Error("expected combine overlap");
    }
    // U=8, λ≈1 ⇒ Ê≈8, naive=20 ⇒ 40% → flagged
    expect(combined.overlap.flagged).toBe(true);
    expect(combined.overlap.perClass["1"].overcountEstimate).toBeGreaterThanOrEqual(
      2,
    );
  });

  it("does not degenerate the estimate to hardMax when one buffered bbox contains the other", () => {
    // Regression for the "Mangrove test 2" sketch: two disjoint fragments,
    // 0.5 km buffers. The tiny fragment's buffered bbox sits entirely inside
    // the big fragment's buffered bbox, so λ = bboxOverlap/min(bboxArea)
    // clamps to 1 and the old Ê = U × λ collapsed to the hard ceiling
    // (all of the small fragment's collar habitat), warning at ~14% when the
    // true double-count is ~7% (below the 10% gate).
    //
    // Buffered bboxes are computed from the committed real fragments; collar
    // habitat km² are the verified values from the production run.
    const fragments = loadJson<{
      features: Feature<Polygon | MultiPolygon>[];
    }>("mangrove-test-2-fragments.geojson.json").features;
    expect(fragments).toHaveLength(2);

    const infos = fragments.map((frag) => {
      const { buffered } = computeBufferedSubjectAndCollar(frag, 0.5);
      const box = calcBBox(buffered, { recompute: true }) as [
        number,
        number,
        number,
        number,
      ];
      const bboxAreaKm2 =
        calcArea({
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [box[0], box[1]],
                [box[2], box[1]],
                [box[2], box[3]],
                [box[0], box[3]],
                [box[0], box[1]],
              ],
            ],
          },
        }) / 1_000_000;
      return { bbox: box, bboxAreaKm2 };
    });

    // Containment precondition for this regression: B's buffered bbox is
    // inside A's buffered bbox (λ would clamp to 1).
    const [a, b] = infos;
    expect(b.bbox[0]).toBeGreaterThanOrEqual(a.bbox[0]);
    expect(b.bbox[1]).toBeGreaterThanOrEqual(a.bbox[1]);
    expect(b.bbox[2]).toBeLessThanOrEqual(a.bbox[2]);
    expect(b.bbox[3]).toBeLessThanOrEqual(a.bbox[3]);

    // Verified habitat values from the production run (report 180).
    const collarHabitatA = 4.563068474872067;
    const collarHabitatB = 0.7260849930530756;
    const combined = combineRasterOverlayAreaMetrics([
      {
        areas: { "*": collarHabitatA },
        overlap: {
          bufferKm: 0.5,
          bbox: a.bbox,
          bboxAreaKm2: a.bboxAreaKm2,
          collarAreas: { "*": collarHabitatA },
          innerAreas: { "*": 0 },
        },
      },
      {
        areas: { "*": collarHabitatB },
        overlap: {
          bufferKm: 0.5,
          bbox: b.bbox,
          bboxAreaKm2: b.bboxAreaKm2,
          collarAreas: { "*": collarHabitatB },
          innerAreas: { "*": 0 },
        },
      },
    ]);

    expect(combined.overlap).toBeDefined();
    if (!combined.overlap || !("perClass" in combined.overlap)) {
      throw new Error("expected combine overlap");
    }
    const pc = combined.overlap.perClass["*"];
    const naive = collarHabitatA + collarHabitatB;
    expect(pc.naiveSum).toBeCloseTo(naive, 6);
    // Hard ceiling is still the smaller collar's habitat — that bound is
    // geometrically correct (true overcount 0.376 ≤ 0.726).
    expect(pc.overcountMax).toBeCloseTo(collarHabitatB, 6);
    // The estimate must be strictly inside the ceiling, not pinned to it.
    // Ground truth (habitat in buffer(A) ∩ buffer(B)) is ~0.376 km²;
    // the density model gives ~0.31 km².
    expect(pc.overcountEstimate).toBeLessThan(pc.overcountMax * 0.75);
    expect(pc.overcountEstimate).toBeGreaterThan(0.2);
    expect(pc.overcountEstimate).toBeLessThan(0.45);
    // 5.9% of naive — below the 10% warning gate (true value is 7.1%,
    // also below the gate; the old model warned at 13.7%).
    expect(pc.overcountEstimate / pc.naiveSum).toBeLessThan(0.1);
    expect(combined.overlap.flagged).toBe(false);
  });

  it("attachRasterOverlayAreaOverlapScope fills sketch ids and scope", () => {
    const combined = combineRasterOverlayAreaMetrics([
      {
        areas: { "1": 10 },
        overlap: {
          bufferKm: 1,
          bbox: [0, 0, 1, 1],
          bboxAreaKm2: 1,
          collarAreas: { "1": 8 },
          innerAreas: { "1": 2 },
        },
      },
      {
        areas: { "1": 10 },
        overlap: {
          bufferKm: 1,
          bbox: [0, 0, 1, 1],
          bboxAreaKm2: 1,
          collarAreas: { "1": 8 },
          innerAreas: { "1": 2 },
        },
      },
    ]);
    const enriched = attachRasterOverlayAreaOverlapScope(
      { type: "raster_overlay_area", value: combined },
      [
        {
          type: "raster_overlay_area",
          subject: { hash: "a", geographies: [1], sketches: [10] },
        },
        {
          type: "raster_overlay_area",
          subject: { hash: "b", geographies: [1], sketches: [20] },
        },
      ],
    );
    const overlap = enriched.value.overlap;
    expect(overlap && "pairs" in overlap).toBe(true);
    if (!overlap || !("pairs" in overlap)) {
      throw new Error("expected pairs");
    }
    expect(overlap.pairs[0].fragmentHashA).toBe("a");
    expect(overlap.pairs[0].fragmentHashB).toBe("b");
    expect(overlap.pairs[0].sketchIdsA).toEqual([10]);
    expect(overlap.pairs[0].sketchIdsB).toEqual([20]);
    expect(overlap.scope).toBe("between-sketches");
    expect(overlap.partnerSketchIds?.sort()).toEqual([10, 20]);
  });

  it("combineMetricsForFragments routes raster_overlay_area", () => {
    const combined = combineMetricsForFragments(
      [
        { type: "raster_overlay_area", value: { areas: { "*": 1 } } },
        { type: "raster_overlay_area", value: { areas: { "*": 2 } } },
      ],
      "raster_overlay_area",
    );
    expect(combined).toEqual({
      type: "raster_overlay_area",
      value: { areas: { "*": 3 } },
    });
  });
});

describe("calculateRasterOverlayArea vs GDAL fixtures", () => {
  it(
    "mangroves-2020 bordering sketch (VRM off) matches fixture within tolerance",
    async () => {
      const fixture = loadJson<{
        sourceUrl: string;
        epsg: number;
        expected: { areas: { "*": number } };
        toleranceKm2: number;
      }>("mangroves-2020-bordering.json");
      const sketch = loadJson<Feature<Polygon | MultiPolygon>>(
        "Mangrove-bordering-sketch.geojson.json",
      );
      const projected = reprojectFeature(sketch, fixture.epsg);
      const bbox = calcBBox(sketch, { recompute: true });
      const centerLonLat: [number, number] = [
        (bbox[0] + bbox[2]) / 2,
        (bbox[1] + bbox[3]) / 2,
      ];
      const result = await calculateRasterOverlayArea(
        fixture.sourceUrl,
        projected,
        {
          vrm: false,
          centerLonLat,
          fragmentAreaSqM: calcArea(sketch),
          groupByValue: false,
        },
      );
      expect(result.areas["*"]).toBeGreaterThan(0);
      expect(
        Math.abs(result.areas["*"] - fixture.expected.areas["*"]),
      ).toBeLessThanOrEqual(fixture.toleranceKm2);
    },
    120_000,
  );

  it(
    "substrate classes produce per-value rows within tolerance",
    async () => {
      const fixture = loadJson<{
        sourceUrl: string;
        epsg: number;
        expected: { areas: Record<string, number> };
        toleranceKm2: number;
        toleranceKm2StarAndZero?: number;
      }>("substrate-classes-test.json");
      const sketch = loadJson<Feature<Polygon | MultiPolygon>>(
        "Substrate-Test.geojson.json",
      );
      const projected = reprojectFeature(sketch, fixture.epsg);
      const bbox = calcBBox(sketch, { recompute: true });
      const centerLonLat: [number, number] = [
        (bbox[0] + bbox[2]) / 2,
        (bbox[1] + bbox[3]) / 2,
      ];
      const result = await calculateRasterOverlayArea(
        fixture.sourceUrl,
        projected,
        {
          vrm: false,
          centerLonLat,
          fragmentAreaSqM: calcArea(sketch),
          groupByValue: true,
        },
      );
      expect(result.areas["*"]).toBeGreaterThan(0);
      expect(result.areas["1"]).toBeDefined();
      expect(result.areas["2"]).toBeDefined();
      const loose = fixture.toleranceKm2StarAndZero ?? 2;
      for (const key of Object.keys(fixture.expected.areas)) {
        const tol =
          key === "*" || key === "0" ? loose : fixture.toleranceKm2;
        expect(
          Math.abs((result.areas[key] ?? 0) - fixture.expected.areas[key]),
        ).toBeLessThanOrEqual(tol);
      }
    },
    180_000,
  );

  it(
    "buffered mangrove fragment attaches collar/inner/bbox metadata",
    async () => {
      const fixture = loadJson<{
        sourceUrl: string;
        epsg: number;
        bufferDistanceKm: number;
        expected: {
          areas: { "*": number };
          collarAreas: { "*": number };
          innerAreas: { "*": number };
          bbox: [number, number, number, number];
        };
        toleranceKm2: number;
      }>("mangroves-2020-bordering-buffered.json");
      const sketch = loadJson<Feature<Polygon | MultiPolygon>>(
        "Mangrove-bordering-sketch.geojson.json",
      );
      const { buffered, collar, bbox } = computeBufferedSubjectAndCollar(
        sketch,
        fixture.bufferDistanceKm,
      );
      const projectedBuffered = reprojectFeature(buffered, fixture.epsg);
      const projectedCollar = reprojectFeature(collar, fixture.epsg);
      const wgsBBox = calcBBox(buffered, { recompute: true });
      const centerLonLat: [number, number] = [
        (wgsBBox[0] + wgsBBox[2]) / 2,
        (wgsBBox[1] + wgsBBox[3]) / 2,
      ];
      const result = await calculateRasterOverlayArea(
        fixture.sourceUrl,
        projectedBuffered,
        {
          vrm: false,
          centerLonLat,
          fragmentAreaSqM: calcArea(buffered),
          groupByValue: false,
          collar: {
            feature: projectedCollar,
            bbox,
            bufferKm: fixture.bufferDistanceKm,
          },
        },
      );
      expect(result.areas["*"]).toBeGreaterThan(0);
      expect(result.overlap).toBeDefined();
      if (!result.overlap || !("collarAreas" in result.overlap)) {
        throw new Error("expected fragment overlap info");
      }
      expect(
        Math.abs(result.areas["*"] - fixture.expected.areas["*"]),
      ).toBeLessThanOrEqual(fixture.toleranceKm2);
      expect(
        Math.abs(
          result.overlap.collarAreas["*"] - fixture.expected.collarAreas["*"],
        ),
      ).toBeLessThanOrEqual(fixture.toleranceKm2);
      // Identity: areas ≈ inner + collar
      expect(
        Math.abs(
          result.areas["*"] -
            ((result.overlap.innerAreas["*"] ?? 0) +
              (result.overlap.collarAreas["*"] ?? 0)),
        ),
      ).toBeLessThan(1e-9);
      expect(result.overlap.bboxAreaKm2).toBeGreaterThan(0);
    },
    180_000,
  );

  it(
    "mangrove-test-2 buffered fragments: overcount bounds honest vs ground truth",
    async () => {
      const fixture = loadJson<{
        sourceUrl: string;
        epsg: number;
        bufferDistanceKm: number;
        expected: {
          naiveSumKm2: number;
          overcountMaxKm2: number;
          unionHabitatKm2: number;
          trueOvercountKm2: number;
        };
        toleranceKm2: number;
      }>("mangrove-test-2-overcount.json");
      const fragments = loadJson<{
        features: Feature<Polygon | MultiPolygon>[];
      }>("mangrove-test-2-fragments.geojson.json").features;

      const computeValue = async (
        featureWgs: Feature<Polygon | MultiPolygon>,
        collarWgs?: Feature<Polygon | MultiPolygon>,
      ) => {
        const wgsBBox = calcBBox(featureWgs, { recompute: true }) as [
          number,
          number,
          number,
          number,
        ];
        return calculateRasterOverlayArea(
          fixture.sourceUrl,
          reprojectFeature(featureWgs, fixture.epsg),
          {
            vrm: "auto",
            centerLonLat: [
              (wgsBBox[0] + wgsBBox[2]) / 2,
              (wgsBBox[1] + wgsBBox[3]) / 2,
            ],
            fragmentAreaSqM: calcArea(featureWgs),
            groupByValue: false,
            ...(collarWgs
              ? {
                  collar: {
                    feature: reprojectFeature(collarWgs, fixture.epsg),
                    bbox: wgsBBox,
                    bufferKm: fixture.bufferDistanceKm,
                  },
                }
              : {}),
          },
        );
      };

      // Same pipeline as the overlay-worker's raster_overlay_area case.
      const bufferedFeatures: Feature<Polygon | MultiPolygon>[] = [];
      const values: RasterOverlayAreaMetricValue[] = [];
      for (const frag of fragments) {
        const { buffered, collar } = computeBufferedSubjectAndCollar(
          frag,
          fixture.bufferDistanceKm,
        );
        bufferedFeatures.push(buffered);
        values.push(await computeValue(buffered, collar));
      }

      const combined = combineRasterOverlayAreaMetrics(values);
      const tol = fixture.toleranceKm2;
      expect(combined.areas["*"]).toBeCloseTo(
        fixture.expected.naiveSumKm2,
        1,
      );
      expect(combined.overlap).toBeDefined();
      if (!combined.overlap || !("perClass" in combined.overlap)) {
        throw new Error("expected combine overlap");
      }
      const pc = combined.overlap.perClass["*"];
      expect(
        Math.abs(pc.overcountMax - fixture.expected.overcountMaxKm2),
      ).toBeLessThanOrEqual(tol);

      // Ground truth: habitat inside union(buffer A, buffer B). The true
      // double-count is naive − union.
      const unionCoords = clipping.union(
        bufferedFeatures[0].geometry.coordinates as clipping.Geom,
        bufferedFeatures[1].geometry.coordinates as clipping.Geom,
      );
      const unionValue = await computeValue({
        type: "Feature",
        properties: {},
        geometry: {
          type: "MultiPolygon",
          coordinates: unionCoords as MultiPolygon["coordinates"],
        },
      });
      const trueOvercount = pc.naiveSum - (unionValue.areas["*"] ?? 0);
      expect(
        Math.abs(trueOvercount - fixture.expected.trueOvercountKm2),
      ).toBeLessThanOrEqual(tol);

      // Bounds must bracket the truth…
      expect(trueOvercount).toBeGreaterThanOrEqual(pc.overcountMin);
      expect(trueOvercount).toBeLessThanOrEqual(pc.overcountMax + tol);
      // …and the estimate must gate consistently with the truth for this
      // case: both sides of the 10% warning threshold agree (no warning).
      expect(trueOvercount / pc.naiveSum).toBeLessThan(0.1);
      expect(pc.overcountEstimate / pc.naiveSum).toBeLessThan(0.1);
      expect(combined.overlap.flagged).toBe(false);
    },
    180_000,
  );
});
