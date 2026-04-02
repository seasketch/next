import * as d3Chromatic from "d3-scale-chromatic";
import { colord } from "colord";
import { describe, expect, it } from "vitest";
import type { RasterBandInfo } from "@seasketch/geostats-types";
import type { ColorScaleFn } from "../lib/colorScales";
import {
  buildCustomColorScale,
  buildRasterStepColorExpression,
  getColorScale,
  getColorStopsFromScale,
  resolveRasterStepBuckets,
} from "../lib/colorScales";

function assertContinuousMatchesD3(
  scale: ColorScaleFn,
  resolvedName: string,
  d3Interpolate: (t: number) => string,
) {
  expect(scale.name).toBe(resolvedName);
  for (const t of [0, 0.2, 0.5, 1]) {
    expect(scale(t)).toBe(d3Interpolate(t));
  }
}

function assertCategoricalMatchesD3(
  scale: ColorScaleFn,
  resolvedName: string,
  colors: readonly string[],
) {
  expect(scale.name).toBe(resolvedName);
  const len = colors.length;
  for (let i = 0; i < len + 5; i++) {
    expect(scale(i)).toBe(colors[i % len]);
  }
}

describe("getColorScale", () => {
  describe("continuous — known full scale names", () => {
    it("wraps interpolatePlasma with that name", () => {
      assertContinuousMatchesD3(
        getColorScale("continuous", "interpolatePlasma"),
        "interpolatePlasma",
        d3Chromatic.interpolatePlasma,
      );
    });

    it("wraps interpolateViridis with that name", () => {
      assertContinuousMatchesD3(
        getColorScale("continuous", "interpolateViridis"),
        "interpolateViridis",
        d3Chromatic.interpolateViridis,
      );
    });

    it("wraps interpolateBrBG with that name", () => {
      assertContinuousMatchesD3(
        getColorScale("continuous", "interpolateBrBG"),
        "interpolateBrBG",
        d3Chromatic.interpolateBrBG,
      );
    });

    it("wraps interpolateRainbow with that name", () => {
      assertContinuousMatchesD3(
        getColorScale("continuous", "interpolateRainbow"),
        "interpolateRainbow",
        d3Chromatic.interpolateRainbow,
      );
    });
  });

  describe("continuous — partial / fuzzy names (case-insensitive)", () => {
    it("matches plasma inside interpolatePlasma", () => {
      assertContinuousMatchesD3(
        getColorScale("continuous", "plasma"),
        "interpolatePlasma",
        d3Chromatic.interpolatePlasma,
      );
    });

    it("matches brbg inside interpolateBrBG (diverging)", () => {
      assertContinuousMatchesD3(
        getColorScale("continuous", "brbg"),
        "interpolateBrBG",
        d3Chromatic.interpolateBrBG,
      );
    });

    it("matches mixed case", () => {
      assertContinuousMatchesD3(
        getColorScale("continuous", "PLASMA"),
        "interpolatePlasma",
        d3Chromatic.interpolatePlasma,
      );
    });

    it("matches turbo substring", () => {
      assertContinuousMatchesD3(
        getColorScale("continuous", "turbo"),
        "interpolateTurbo",
        d3Chromatic.interpolateTurbo,
      );
    });
  });

  describe("continuous — default when no match", () => {
    it("uses interpolatePlasma with that name", () => {
      assertContinuousMatchesD3(
        getColorScale("continuous", "zzzz-no-such-scale-999"),
        "interpolatePlasma",
        d3Chromatic.interpolatePlasma,
      );
    });
  });

  describe("categorical — known full scale names", () => {
    it("wraps schemeCategory10 with that name", () => {
      assertCategoricalMatchesD3(
        getColorScale("categorical", "schemeCategory10"),
        "schemeCategory10",
        d3Chromatic.schemeCategory10,
      );
    });

    it("wraps schemeTableau10 with that name", () => {
      assertCategoricalMatchesD3(
        getColorScale("categorical", "schemeTableau10"),
        "schemeTableau10",
        d3Chromatic.schemeTableau10,
      );
    });
  });

  describe("categorical — partial names", () => {
    it("matches tableau inside schemeTableau10", () => {
      assertCategoricalMatchesD3(
        getColorScale("categorical", "tableau"),
        "schemeTableau10",
        d3Chromatic.schemeTableau10,
      );
    });

    it("matches paired inside schemePaired", () => {
      assertCategoricalMatchesD3(
        getColorScale("categorical", "paired"),
        "schemePaired",
        d3Chromatic.schemePaired,
      );
    });
  });

  describe("categorical — default when no match", () => {
    it("uses schemeCategory10 with that name", () => {
      assertCategoricalMatchesD3(
        getColorScale("categorical", "zzzz-no-such-scheme-999"),
        "schemeCategory10",
        d3Chromatic.schemeCategory10,
      );
    });
  });

  describe("custom palette (LLM / user)", () => {
    it("uses a valid array and sets name to customPalette", () => {
      const scale = getColorScale("categorical", "schemeCategory10", [
        "#f00",
        "#00f",
      ]);
      expect(scale.name).toBe("customPalette");
      expect(scale(0)).toBe(colord("#f00").toHex());
      expect(scale(1)).toBe(colord("#00f").toHex());
      expect(scale(2)).toBe(colord("#f00").toHex());
    });

    it("skips invalid array entries and keeps order of valid colors", () => {
      const scale = buildCustomColorScale([
        "not-a-color",
        "#FFFFFF",
        "",
        null as unknown as string,
        "rgba(0, 128, 0, 0.5)",
        "#000000",
      ]);
      expect(scale).not.toBeNull();
      expect(scale!.name).toBe("customPalette");
      expect(scale!(0)).toBe(colord("#FFFFFF").toHex());
      expect(scale!(1)).toBe("rgba(0, 128, 0, 0.5)");
      expect(scale!(2)).toBe(colord("#000000").toHex());
    });

    it("accepts named colors when names plugin is enabled", () => {
      const scale = buildCustomColorScale(["green", "rebeccapurple"]);
      expect(scale).not.toBeNull();
      expect(scale!(0)).toBe(colord("green").toHex());
      expect(scale!(1)).toBe(colord("rebeccapurple").toHex());
    });

    it("returns null for all-invalid array so getColorScale can fall back", () => {
      expect(buildCustomColorScale(["inva-lid", ""])).toBeNull();
      const scale = getColorScale("categorical", "tableau", [
        "bad",
        "",
        null as unknown as string,
      ]);
      assertCategoricalMatchesD3(
        scale,
        "schemeTableau10",
        d3Chromatic.schemeTableau10,
      );
    });

    it("returns null for empty array or empty object", () => {
      expect(buildCustomColorScale([])).toBeNull();
      expect(buildCustomColorScale({})).toBeNull();
    });

    it("maps object keys in numeric-aware key order for bucket indices", () => {
      const scale = buildCustomColorScale({
        "10": "#aaa",
        "2": "#bbb",
        "1": "#ccc",
      });
      expect(scale).not.toBeNull();
      expect(scale!(0)).toBe(colord("#ccc").toHex());
      expect(scale!(1)).toBe(colord("#bbb").toHex());
      expect(scale!(2)).toBe(colord("#aaa").toHex());
    });

    it("drops object entries with invalid colors", () => {
      const scale = buildCustomColorScale({
        a: "#ff0000",
        b: "nope",
        c: "#0000ff",
      });
      expect(scale).not.toBeNull();
      expect(scale!(0)).toBe(colord("#ff0000").toHex());
      expect(scale!(1)).toBe(colord("#0000ff").toHex());
    });

    it("ignores custom palette for continuous scales", () => {
      assertContinuousMatchesD3(
        getColorScale("continuous", "viridis", ["#f00", "#00f"]),
        "interpolateViridis",
        d3Chromatic.interpolateViridis,
      );
    });
  });

  describe("raster step expressions (class breaks)", () => {
    it("getColorStopsFromScale matches d3 fractions for n > 1", () => {
      const scale = getColorScale("continuous", "interpolatePlasma");
      const stops = getColorStopsFromScale(scale, 4, false);
      expect(stops).toHaveLength(4);
      for (let i = 0; i < 4; i++) {
        expect(stops[i]).toBe(scale(i / 3));
      }
    });

    it("buildRasterStepColorExpression builds a step expression", () => {
      const scale = getColorScale("continuous", "interpolatePlasma");
      const buckets: [number, number | null][] = [
        [0, 0.25],
        [25, 0.25],
        [50, 0.25],
        [75, 0.25],
        [100, null],
      ];
      const expr = buildRasterStepColorExpression(
        buckets,
        scale,
        false,
        ["raster-value"],
      );
      expect(expr[0]).toBe("step");
      expect(expr[1]).toEqual(["raster-value"]);
      expect(expr[2]).toBe("transparent");
      expect(expr.length).toBeGreaterThan(3);
    });

    it("resolveRasterStepBuckets picks closest valid class count", () => {
      const stats: RasterBandInfo["stats"] = {
        mean: 0,
        stdev: 1,
        equalInterval: {},
        geometricInterval: {},
        naturalBreaks: {
          3: [
            [0, 0.3],
            [10, 0.3],
            [20, 0.3],
            [30, null],
          ],
          8: [
            [0, 0.1],
            [5, 0.1],
            [10, 0.1],
            [15, 0.1],
            [20, 0.1],
            [25, 0.1],
            [30, 0.1],
            [35, 0.1],
            [40, null],
          ],
        },
        quantiles: {},
        standardDeviations: {},
        histogram: [],
        categories: [],
      };
      const r99 = resolveRasterStepBuckets(stats, "naturalBreaks", 99);
      expect(r99).not.toBeNull();
      expect(r99!.n).toBe(8);
      expect(r99!.buckets.length).toBe(9);

      const r8 = resolveRasterStepBuckets(stats, "naturalBreaks", 8);
      expect(r8!.n).toBe(8);

      const rNearest = resolveRasterStepBuckets(stats, "naturalBreaks", 5);
      expect(rNearest!.n).toBe(3);
    });

    it("resolveRasterStepBuckets picks max key when requested count exceeds all available", () => {
      const nb: RasterBandInfo["stats"]["naturalBreaks"] = {};
      for (let k = 1; k <= 6; k++) {
        nb[k] = Array.from({ length: k + 1 }, (_, i) => [
          i * 10,
          i < k ? 1 / k : null,
        ]) as [number, number | null][];
      }
      const stats: RasterBandInfo["stats"] = {
        mean: 0,
        stdev: 1,
        equalInterval: {},
        geometricInterval: {},
        naturalBreaks: nb,
        quantiles: {},
        standardDeviations: {},
        histogram: [],
        categories: [],
      };
      const r = resolveRasterStepBuckets(stats, "naturalBreaks", 8);
      expect(r).not.toBeNull();
      expect(r!.n).toBe(6);
    });

    it("resolveRasterStepBuckets returns null when method has no usable breaks", () => {
      const base: RasterBandInfo["stats"] = {
        mean: 0,
        stdev: 1,
        equalInterval: {},
        geometricInterval: {},
        naturalBreaks: {},
        quantiles: {},
        standardDeviations: {},
        histogram: [],
        categories: [],
      };
      expect(resolveRasterStepBuckets(base, "naturalBreaks", 8)).toBeNull();

      const onlyShort: RasterBandInfo["stats"] = {
        ...base,
        naturalBreaks: { 5: [[0, 1]] },
      };
      expect(resolveRasterStepBuckets(onlyShort, "naturalBreaks", 5)).toBeNull();
    });
  });
});
