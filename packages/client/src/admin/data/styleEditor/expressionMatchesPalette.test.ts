import { describe, expect, it } from "@jest/globals";
import { schemeTableau10 } from "d3-scale-chromatic";
import { Expression } from "mapbox-gl";
import { expressionMatchesPalette } from "./visualizationTypes";

const categoricalStep: Expression = [
  "step",
  ["round", ["raster-value"]],
  "transparent",
  1,
  "#2ca25f",
];

const steps = { steps: "continuous" as const, n: 10 };

describe("expressionMatchesPalette", () => {
  it("returns false for customPalette without throwing", () => {
    expect(
      expressionMatchesPalette(
        categoricalStep,
        // gl-style-builder writes this name for LLM custom palettes
        "customPalette" as any,
        false,
        steps
      )
    ).toBe(false);
  });

  it("returns false for unknown palette names", () => {
    expect(
      expressionMatchesPalette(
        categoricalStep,
        "notARealScale" as any,
        false,
        steps
      )
    ).toBe(false);
  });

  it("returns true when expression colors come from a named d3 scheme", () => {
    const expression: Expression = [
      "step",
      ["round", ["raster-value"]],
      "transparent",
      1,
      schemeTableau10[0],
    ];
    expect(
      expressionMatchesPalette(expression, "schemeTableau10", false, steps)
    ).toBe(true);
  });
});
