import { colord, extend } from "colord";
import a11yPlugin from "colord/plugins/a11y";
import {
  colorAtRasterValue,
  contrastSafeChartColor,
  rasterColorFollowsValue,
  rasterColorFromStyles,
  seriesColorFromStyles,
  timeSeriesDatumColors,
  timeSeriesRoleColor,
} from "./timeSeriesCartography";

extend([a11yPlugin]);

const mangroveStyle = [
  {
    type: "raster",
    paint: {
      "raster-color": [
        "step",
        ["round", ["raster-value"]],
        "transparent",
        0,
        "transparent",
        1,
        "rgba(0,128,0,1.0)",
      ],
    },
  },
];

const dhwStyle = [
  {
    type: "raster",
    paint: {
      "raster-color": [
        "interpolate",
        ["linear"],
        ["raster-value"],
        0,
        "#ffffcc",
        5,
        "#fd8d3c",
        10,
        "#800026",
      ],
    },
  },
];

describe("contrastSafeChartColor", () => {
  test("leaves a mid-saturation blue alone", () => {
    expect(contrastSafeChartColor("#0284c7")).toBe("#0284c7");
  });

  test("darkens a pale stop until it contrasts on white", () => {
    const ink = contrastSafeChartColor("#ffffcc");
    expect(colord(ink).brightness()).toBeLessThan(colord("#ffffcc").brightness());
    expect(colord(ink).contrast("#ffffff")).toBeGreaterThanOrEqual(3);
  });

  test("falls back when the color is not parseable", () => {
    expect(contrastSafeChartColor("not-a-color")).toBe("#0284c7");
  });
});

describe("timeSeriesRoleColor", () => {
  test("span is a darkened, hue-shifted sibling of observed", () => {
    const observed = timeSeriesRoleColor("#00a86b", "observed");
    const span = timeSeriesRoleColor("#00a86b", "span");
    expect(span).not.toBe(observed);
    expect(colord(span).hue()).not.toBeCloseTo(colord(observed).hue(), 0);
  });

  test("interpolated is lighter and less saturated than observed", () => {
    const observed = colord(timeSeriesRoleColor("#0284c7", "observed"));
    const interpolated = colord(timeSeriesRoleColor("#0284c7", "interpolated"));
    expect(interpolated.toHsl().s).toBeLessThan(observed.toHsl().s + 1);
  });
});

describe("rasterColorFromStyles / followsValue", () => {
  test("reads raster-color and treats interpolate/step as value-driven", () => {
    expect(rasterColorFollowsValue(rasterColorFromStyles(dhwStyle))).toBe(true);
    expect(rasterColorFollowsValue(rasterColorFromStyles(mangroveStyle))).toBe(
      true
    );
    expect(rasterColorFollowsValue("#0a7")).toBe(false);
    expect(rasterColorFollowsValue(null)).toBe(false);
  });

  test("handles missing or non-raster styles", () => {
    expect(rasterColorFromStyles(undefined)).toBeNull();
    expect(rasterColorFromStyles([{ type: "fill" }])).toBeNull();
  });
});

describe("seriesColorFromStyles", () => {
  test("skips transparent stops and uses the mangrove green", () => {
    const color = seriesColorFromStyles(mangroveStyle);
    expect(color).toBeTruthy();
    expect(colord(color!).toHex()).toBe("#008000");
  });

  test("picks a saturated mid-ramp stop over pale yellow", () => {
    const color = seriesColorFromStyles(dhwStyle);
    expect(color).toBeTruthy();
    expect(colord(color!).brightness()).toBeLessThan(
      colord("#ffffcc").brightness()
    );
  });
});

describe("colorAtRasterValue", () => {
  test("evaluates interpolate stops", () => {
    const expr = rasterColorFromStyles(dhwStyle);
    const low = colorAtRasterValue(expr, 0);
    const high = colorAtRasterValue(expr, 10);
    expect(low).toBeTruthy();
    expect(high).toBeTruthy();
    expect(colord(low!).brightness()).toBeGreaterThan(colord(high!).brightness());
  });

  test("evaluates categorical step at class 1", () => {
    const expr = rasterColorFromStyles(mangroveStyle);
    const present = colorAtRasterValue(expr, 1);
    expect(present).toBeTruthy();
    expect(colord(present!).toHex()).toBe("#008000");
  });
});

describe("timeSeriesDatumColors", () => {
  test("stats mode follows the Y-axis value through the ramp", () => {
    const low = timeSeriesDatumColors({
      styles: dhwStyle,
      mode: "stats",
      value: 1,
      min: 0,
      max: 2,
    });
    const high = timeSeriesDatumColors({
      styles: dhwStyle,
      mode: "stats",
      value: 9,
      min: 8,
      max: 10,
    });
    expect(low.color).toBeTruthy();
    expect(high.color).toBeTruthy();
    expect(low.color).not.toBe(high.color);
    expect(low.colorMin).toBeTruthy();
    expect(high.colorMax).toBeTruthy();
  });

  test("area mode uses a single layer color, not the plotted area", () => {
    const a = timeSeriesDatumColors({
      styles: mangroveStyle,
      mode: "area",
      value: 12.5,
    });
    const b = timeSeriesDatumColors({
      styles: mangroveStyle,
      mode: "area",
      value: 80,
    });
    expect(a.color).toBe(b.color);
    expect(a.color).toBe(contrastSafeChartColor("#008000"));
    expect(a.colorMin).toBeUndefined();
  });

  test("returns empty when there is no cartography", () => {
    expect(
      timeSeriesDatumColors({ styles: null, mode: "stats", value: 3 })
    ).toEqual({});
  });
});
