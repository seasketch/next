import {
  gfwBreaksForZoom,
  gfwFrameForClock,
  gfwHoursExpression,
  gfwHoursFromProperties,
  parseGfwBins,
} from "./gfwEffort";

const NOW = new Date("2026-11-06T18:00:00.000Z");

describe("gfwFrameForClock", () => {
  it("reads one year in instant mode", () => {
    expect(
      gfwFrameForClock(
        {
          mode: "instant",
          start: "2024",
          end: "2025",
          viewResolution: "year",
        },
        NOW
      )
    ).toEqual({ years: [2024], partialYear: null });
  });

  it("sums the years inside a window", () => {
    expect(
      gfwFrameForClock(
        {
          mode: "window",
          start: "2018",
          end: "2021",
          viewResolution: "year",
        },
        NOW
      ).years
    ).toEqual([2018, 2019, 2020]);
  });

  it("sums from 2012 through the selected year, including a partial current year", () => {
    expect(
      gfwFrameForClock(
        {
          mode: "cumulative",
          start: "2026",
          end: "2027",
          viewResolution: "year",
        },
        NOW
      )
    ).toEqual({
      years: [
        2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023,
        2024, 2025, 2026,
      ],
      partialYear: 2026,
    });
  });
});

describe("gfwHoursExpression", () => {
  it("treats a missing year property as zero and adds the rest", () => {
    expect(gfwHoursExpression([2023])).toEqual([
      "to-number",
      ["get", "2023"],
      0,
    ]);
    expect(gfwHoursExpression([2023, 2024])).toEqual([
      "+",
      ["to-number", ["get", "2023"], 0],
      ["to-number", ["get", "2024"], 0],
    ]);
  });

  it("sums numeric and numeric-string properties", () => {
    expect(
      gfwHoursFromProperties({ "2023": 1.5, "2024": "2" }, [2023, 2024, 2025])
    ).toBe(3.5);
    expect(gfwHoursFromProperties(null, [2024])).toBe(0);
  });
});

describe("gfw bins", () => {
  it("divides zoom-0 breaks by 4^z", () => {
    expect(gfwBreaksForZoom([0, 1024, 4096], 5)).toEqual([1, 4]);
  });

  it("accepts a bare array or a bins field and rejects junk", () => {
    expect(parseGfwBins([0, 10, 20])).toEqual([0, 10, 20]);
    expect(parseGfwBins({ bins: [4, 1] })).toEqual([1, 4]);
    expect(parseGfwBins(null)).toBeNull();
    expect(parseGfwBins({ bins: ["nope"] })).toBeNull();
    expect(parseGfwBins(undefined)).toBeNull();
  });
});
