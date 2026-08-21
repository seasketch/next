import { SuggestedRasterPresentation, type RasterInfo } from "@seasketch/geostats-types";
import type { AiDataAnalystNotes } from "ai-data-analyst";
import { describe, expect, it } from "vitest";
import { buildCategoricalRasterLayer } from "../lib/builders/rasters";

function categoricalRasterInfo(): RasterInfo {
  return {
    presentation: SuggestedRasterPresentation.categorical,
    byteEncoding: true,
    bands: [
      {
        name: "b1",
        colorInterpretation: "Palette",
        base: 0,
        count: 2,
        minimum: 1,
        maximum: 2,
        interval: 1,
        noDataValue: 0,
        scale: null,
        offset: null,
        stats: {
          mean: 1,
          stdev: 0,
          equalInterval: {},
          geometricInterval: {},
          naturalBreaks: {},
          quantiles: {},
          standardDeviations: {},
          histogram: [],
          categories: [
            [1, 0.5],
            [2, 0.5],
          ],
        },
      },
    ],
  };
}

describe("buildCategoricalRasterLayer", () => {
  it("omits s:palette when the scale is a customPalette", () => {
    const [layer] = buildCategoricalRasterLayer(categoricalRasterInfo(), {
      custom_palette: { "1": "#2ca25f", "2": "#99d8c9" },
    } as AiDataAnalystNotes);
    expect(layer.metadata?.["s:type"]).toBe("Categorical Raster");
    expect(layer.metadata?.["s:palette"]).toBeUndefined();
  });

  it("records a named d3 categorical palette", () => {
    const [layer] = buildCategoricalRasterLayer(categoricalRasterInfo(), {
      palette: "schemeTableau10",
    } as AiDataAnalystNotes);
    expect(layer.metadata?.["s:palette"]).toBe("schemeTableau10");
  });
});
