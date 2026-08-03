import { describe, expect, it } from "@jest/globals";
import {
  extractRasterLabelFormatOptions,
  extractRasterLegendLabels,
  formatRasterDisplayValue,
  labelFromRasterLegendLabels,
  legendLabelForRasterValue,
  rasterInteractionLabel,
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

const degreeHeatingWeekStyles = [
  {
    type: "raster",
    metadata: {
      "s:palette": "interpolatePlasma",
      "s:value-suffix": "°C",
      "s:exclude-outside-range": false,
      "s:respect-scale-and-offset": true,
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

describe("extractRasterLabelFormatOptions", () => {
  it("reads suffix and round-numbers from style metadata", () => {
    expect(extractRasterLabelFormatOptions(degreeHeatingWeekStyles)).toEqual({
      roundNumbers: false,
      valueSuffix: "°C",
    });
    expect(
      extractRasterLabelFormatOptions([
        {
          type: "raster",
          metadata: {
            "s:round-numbers": true,
            "s:value-suffix": " m",
          },
        },
      ])
    ).toEqual({
      roundNumbers: true,
      valueSuffix: " m",
    });
  });
});

describe("formatRasterDisplayValue", () => {
  it("matches continuous legend label formatting", () => {
    expect(formatRasterDisplayValue(20.7, { valueSuffix: "°C" })).toBe(
      `${(20.7).toLocaleString()}°C`
    );
    expect(
      formatRasterDisplayValue(20.7, { roundNumbers: true, valueSuffix: "°C" })
    ).toBe(`${(21).toLocaleString()}°C`);
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

describe("rasterInteractionLabel", () => {
  it("prefers categorical legend overrides keyed by encoded DN", () => {
    const labels = extractRasterLegendLabels(styles);
    expect(rasterInteractionLabel(labels, 11, 11)).toBe("ocean");
  });

  it("formats continuous display values with scale/offset + suffix", () => {
    // Encoded DN 2070 with scale 0.01 → display 20.7; legend shows °C.
    const labels = extractRasterLegendLabels(degreeHeatingWeekStyles);
    const format = extractRasterLabelFormatOptions(degreeHeatingWeekStyles);
    expect(rasterInteractionLabel(labels, 2070, 20.7, format)).toBe(
      `${(20.7).toLocaleString()}°C`
    );
  });

  it("does not use encoded DN as the unlabeled continuous fallback", () => {
    expect(rasterInteractionLabel({}, 2070, 20.7, { valueSuffix: "°C" })).toBe(
      `${(20.7).toLocaleString()}°C`
    );
  });
});

describe("legendLabelForRasterValue", () => {
  it("extracts labels then resolves", () => {
    expect(legendLabelForRasterValue(styles, 11)).toBe("ocean");
    expect(legendLabelForRasterValue(styles, 95)).toBe("95");
  });
});
