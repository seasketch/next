import {
  getRasterTimeSeriesAreaUnit,
  getRasterTimeSeriesPresentation,
  getRasterTimeSeriesPrintPresentations,
  getRasterTimeSeriesTabLabels,
  getRasterTimeSeriesTabOrder,
  isPlottableRasterStatsBand,
} from "./rasterTimeSeriesSettings";

describe("getRasterTimeSeriesAreaUnit", () => {
  test("defaults to kilometers and accepts AreaUnit or short display codes", () => {
    expect(getRasterTimeSeriesAreaUnit({})).toBe("kilometer");
    expect(getRasterTimeSeriesAreaUnit({ unit: null })).toBe("kilometer");
    expect(getRasterTimeSeriesAreaUnit({ unit: "nope" })).toBe("kilometer");
    expect(getRasterTimeSeriesAreaUnit({ unit: "mile" })).toBe("mile");
    expect(getRasterTimeSeriesAreaUnit({ unit: "mi" })).toBe("mile");
    expect(getRasterTimeSeriesAreaUnit({ unit: "acres" })).toBe("acre");
  });
});

describe("getRasterTimeSeriesPresentation", () => {
  test("defaults existing widgets to both values with absolute first", () => {
    expect(getRasterTimeSeriesPresentation({})).toEqual({
      showAbsolute: true,
      showPercent: true,
      defaultValue: "absolute",
    });
  });

  test("preserves the legacy percent-first setting", () => {
    expect(
      getRasterTimeSeriesPresentation({ defaultPresentation: "percent" })
    ).toEqual({
      showAbsolute: true,
      showPercent: true,
      defaultValue: "percent",
    });
  });

  test("supports one value or both values in either order", () => {
    expect(
      getRasterTimeSeriesPresentation({ presentation: "absolute" })
    ).toEqual({
      showAbsolute: true,
      showPercent: false,
      defaultValue: "absolute",
    });
    expect(
      getRasterTimeSeriesPresentation({ presentation: "percent" })
    ).toEqual({
      showAbsolute: false,
      showPercent: true,
      defaultValue: "percent",
    });
    expect(
      getRasterTimeSeriesPresentation({ presentation: "both_percent" })
    ).toEqual({
      showAbsolute: true,
      showPercent: true,
      defaultValue: "percent",
    });
  });
});

describe("getRasterTimeSeriesTabOrder", () => {
  test("puts the percent tab first when the admin chose percent first", () => {
    expect(
      getRasterTimeSeriesTabOrder({ presentation: "both_percent" })
    ).toEqual(["percent", "absolute"]);
  });

  test("keeps the absolute tab first unless percent is chosen first", () => {
    expect(getRasterTimeSeriesTabOrder({ presentation: "both_absolute" })).toEqual(
      ["absolute", "percent"]
    );
    expect(
      getRasterTimeSeriesTabOrder({ defaultPresentation: "percent" })
    ).toEqual(["percent", "absolute"]);
  });
});

describe("getRasterTimeSeriesPrintPresentations", () => {
  test("prints both value views in the admin tab order", () => {
    expect(
      getRasterTimeSeriesPrintPresentations({ presentation: "both_percent" })
    ).toEqual(["percent", "absolute"]);
    expect(getRasterTimeSeriesPrintPresentations({})).toEqual([
      "absolute",
      "percent",
    ]);
  });

  test("omits percent when it cannot be computed, and honors a single enabled view", () => {
    expect(
      getRasterTimeSeriesPrintPresentations(
        { presentation: "both_absolute" },
        { percentUnavailable: true }
      )
    ).toEqual(["absolute"]);
    expect(
      getRasterTimeSeriesPrintPresentations(
        {},
        { percentUnavailable: true }
      )
    ).toEqual(["absolute"]);
    expect(
      getRasterTimeSeriesPrintPresentations({ presentation: "percent" })
    ).toEqual(["percent"]);
  });
});

describe("getRasterTimeSeriesTabLabels", () => {
  test("uses custom absolute and percent tab labels", () => {
    expect(
      getRasterTimeSeriesTabLabels(
        {
          absoluteLabel: "Fishing Effort (hours)",
          percentLabel: "Percent of EEZ Effort",
        },
        { absolute: "Absolute", percent: "Percent" }
      )
    ).toEqual({
      absolute: "Fishing Effort (hours)",
      percent: "Percent of EEZ Effort",
    });
  });

  test("falls back to valueLabel then the mode defaults", () => {
    expect(
      getRasterTimeSeriesTabLabels(
        { valueLabel: "Hours fished" },
        { absolute: "Absolute", percent: "Percent" }
      )
    ).toEqual({
      absolute: "Hours fished",
      percent: "Percent",
    });
    expect(
      getRasterTimeSeriesTabLabels(
        { absoluteLabel: "  ", percentLabel: "   ", valueLabel: "" },
        { absolute: "Area", percent: "Percent" }
      )
    ).toEqual({
      absolute: "Area",
      percent: "Percent",
    });
  });
});

describe("isPlottableRasterStatsBand", () => {
  test("rejects overlap that is entirely nodata", () => {
    expect(isPlottableRasterStatsBand(null)).toBe(false);
    expect(isPlottableRasterStatsBand(undefined)).toBe(false);
    expect(
      isPlottableRasterStatsBand({
        mean: null,
        min: null,
        max: null,
        count: 470,
        invalid: 470,
        sum: 0,
      })
    ).toBe(false);
  });

  test("accepts a band with finite envelope stats", () => {
    expect(
      isPlottableRasterStatsBand({
        mean: 2.4,
        min: 0.1,
        max: 8.3,
        count: 470,
        invalid: 12,
        sum: 1128,
      })
    ).toBe(true);
  });

  test("accepts a zero-valued band as real data", () => {
    expect(
      isPlottableRasterStatsBand({
        mean: 0,
        min: 0,
        max: 0,
        count: 470,
        invalid: 0,
        sum: 0,
      })
    ).toBe(true);
  });
});
