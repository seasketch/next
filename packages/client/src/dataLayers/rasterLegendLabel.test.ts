import { describe, expect, it } from "@jest/globals";
import {
  extractRasterLegendLabels,
  labelFromRasterLegendLabels,
  legendLabelForRasterValue,
} from "./rasterLegendLabel";

const styles = [
  {
    type: "raster",
    metadata: {
      "s:type": "Categorical Raster",
      "s:legend-labels": {
        "11": "ocean",
        "21": "Developed, Open Space",
        "52": "",
      },
    },
  },
];

describe("extractRasterLegendLabels", () => {
  it("keeps non-empty string overrides", () => {
    expect(extractRasterLegendLabels(styles)).toEqual({
      "11": "ocean",
      "21": "Developed, Open Space",
    });
  });

  it("returns empty object for missing styles", () => {
    expect(extractRasterLegendLabels(undefined)).toEqual({});
    expect(extractRasterLegendLabels([])).toEqual({});
  });
});

describe("labelFromRasterLegendLabels", () => {
  const labels = extractRasterLegendLabels(styles);

  it("returns the legend override when present", () => {
    expect(labelFromRasterLegendLabels(labels, 11)).toBe("ocean");
  });

  it("falls back to the value string when unlabeled", () => {
    expect(labelFromRasterLegendLabels(labels, 95)).toBe("95");
    expect(labelFromRasterLegendLabels(labels, 52)).toBe("52");
  });
});

describe("legendLabelForRasterValue", () => {
  it("extracts labels then resolves", () => {
    expect(legendLabelForRasterValue(styles, 11)).toBe("ocean");
    expect(legendLabelForRasterValue(styles, 95)).toBe("95");
  });
});
