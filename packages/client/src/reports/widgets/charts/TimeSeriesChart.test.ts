import {
  paddedTimeSeriesYDomain,
  removeOverlappingTimeTicks,
  timeSeriesXDomain,
  timeSeriesYAxis,
  yAxisGutterWidth,
} from "./TimeSeriesChart";

describe("timeSeriesXDomain", () => {
  test("yearly points sit on coverage start, not exclusive end", () => {
    const domain = timeSeriesXDomain([
      { x: Date.UTC(2015, 0, 1), xEnd: Date.UTC(2016, 0, 1) },
      { x: Date.UTC(2024, 0, 1), xEnd: Date.UTC(2025, 0, 1) },
    ]);
    expect(domain).toEqual([Date.UTC(2015, 0, 1), Date.UTC(2024, 0, 1)]);
  });

  test("a multi-year span extends the domain to exclusive end", () => {
    const domain = timeSeriesXDomain([
      {
        x: Date.UTC(2015, 0, 1),
        xEnd: Date.UTC(2021, 0, 1),
        span: true,
      },
    ]);
    expect(domain).toEqual([Date.UTC(2015, 0, 1), Date.UTC(2021, 0, 1)]);
  });

  test("a single instant still produces a positive interval", () => {
    const domain = timeSeriesXDomain([{ x: Date.UTC(2018, 0, 1) }]);
    expect(domain).not.toBeNull();
    expect(domain![1]).toBeGreaterThan(domain![0]);
  });
});

describe("paddedTimeSeriesYDomain", () => {
  test("pads a low percent series from zero by 1.25x the data max", () => {
    const domain = paddedTimeSeriesYDomain([0.03, 0.09]);
    expect(domain).not.toBeNull();
    expect(domain![0]).toBe(0);
    expect(domain![1]).toBeCloseTo(0.09 * 1.25);
  });

  test("a percent ceil does not exceed 100% or clip the observed max", () => {
    expect(paddedTimeSeriesYDomain([0.8, 0.95], { ceil: 1 })).toEqual([
      0, 1,
    ]);
    expect(paddedTimeSeriesYDomain([0.03, 0.09], { ceil: 1 })?.[1]).toBeCloseTo(
      0.09 * 1.25
    );
  });

  test("a flat all-zero percent series stays near zero instead of 0–100%", () => {
    const domain = paddedTimeSeriesYDomain([0, 0, 0], {
      ceil: 1,
      zeroSpan: 0.01,
    });
    expect(domain).toEqual([0, 0.01]);
    const axis = timeSeriesYAxis(domain ?? undefined, [0, 0, 0]);
    expect(axis.domain[1]).toBeLessThanOrEqual(0.02);
    expect(axis.domain[1]).toBeGreaterThan(0);
  });

  test("a flat absolute series still uses a unit span when zeroSpan is omitted", () => {
    expect(paddedTimeSeriesYDomain([0, 0])).toEqual([0, 1]);
  });

  test("ignores non-finite values and returns null when none remain", () => {
    expect(paddedTimeSeriesYDomain([null, undefined, NaN, Infinity])).toBeNull();
    expect(paddedTimeSeriesYDomain([])).toBeNull();
  });
});

describe("removeOverlappingTimeTicks", () => {
  test("keeps exact domain endpoints and removes crowded interior labels", () => {
    expect(
      removeOverlappingTimeTicks(
        [
          { value: 1996, position: 0, label: "1996" },
          { value: 1998, position: 32, label: "1998" },
          { value: 2000, position: 64, label: "2000" },
          { value: 2002, position: 96, label: "2002" },
          { value: 2004, position: 128, label: "2004" },
        ],
        52
      ).map((tick) => tick.label)
    ).toEqual(["1996", "2000", "2004"]);
  });

  test("deduplicates labels produced by a coarse formatter", () => {
    expect(
      removeOverlappingTimeTicks(
        [
          { value: 1, position: 0, label: "2018" },
          { value: 2, position: 30, label: "2018" },
          { value: 3, position: 60, label: "2019" },
        ],
        40
      ).map((tick) => tick.label)
    ).toEqual(["2018", "2019"]);
  });
});

describe("yAxisGutterWidth", () => {
  test("sizes the gutter from the widest formatted tick, not the domain max", () => {
    const formatKm2 = (value: number) => {
      if (value === 0) return "0 km²";
      if (value === 1) return "1 km²";
      return `${value} km²`;
    };
    const { ticks } = timeSeriesYAxis([0, 1], []);
    const labels = ticks.map(formatKm2);
    const domainMaxLabel = formatKm2(1);
    expect(labels.some((label) => label.length > domainMaxLabel.length)).toBe(
      true
    );
    expect(yAxisGutterWidth(labels)).toBeGreaterThan(
      yAxisGutterWidth([domainMaxLabel])
    );
  });

  test("short numeric ticks stay narrower than three-digit ticks", () => {
    expect(yAxisGutterWidth(["0", "5", "10", "15"])).toBeLessThan(
      yAxisGutterWidth(["0", "50", "100"])
    );
  });
});
