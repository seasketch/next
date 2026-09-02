import { describe, expect, it } from "vitest";
import { parseQueryParams, QueryError } from "../../src/dataTables/params";
import {
  enumerateWhenSteps,
  stepsOverlappingInterval,
} from "../../src/dataTables/whenStep";

function parse(qs: string) {
  return parseQueryParams(new URLSearchParams(qs));
}

describe("parse when.step", () => {
  it("parses a year series request", () => {
    const q = parse(
      "groupBy=site&op=mean&column=count&when.start=1514764800&when.end=1577836800&when.step=year"
    );
    expect(q.whenStep).toBe("year");
    expect(q.when).toEqual({ startSec: 1514764800, endSec: 1577836800 });
  });

  it("requires when.start/end and an aggregation", () => {
    expect(() => parse("when.step=year")).toThrow(QueryError);
    expect(() =>
      parse("when.start=1&when.end=2&when.step=year")
    ).toThrow(QueryError);
    expect(() => parse("when.step=decade&op=count&when.start=1&when.end=2")).toThrow(
      QueryError
    );
  });

  it("rejects groupBy=step", () => {
    expect(() =>
      parse("groupBy=step&op=count&when.start=1&when.end=2&when.step=year")
    ).toThrow(QueryError);
  });
});

describe("stepsOverlappingInterval", () => {
  const year2018 = {
    startSec: Date.UTC(2018, 0, 1) / 1000,
    endSec: Date.UTC(2019, 0, 1) / 1000,
  };
  const domain = {
    startSec: Date.UTC(2010, 0, 1) / 1000,
    endSec: Date.UTC(2022, 0, 1) / 1000,
  };

  it("bins a year-instant row to one year", () => {
    expect(
      stepsOverlappingInterval(
        year2018.startSec,
        year2018.endSec,
        domain,
        "year"
      )
    ).toEqual(["2018"]);
  });

  it("fans a multi-year span across each overlapping year", () => {
    expect(
      stepsOverlappingInterval(
        Date.UTC(2018, 0, 1) / 1000,
        Date.UTC(2021, 0, 1) / 1000,
        domain,
        "year"
      )
    ).toEqual(["2018", "2019", "2020"]);
  });

  it("clips to the query window", () => {
    expect(
      stepsOverlappingInterval(
        Date.UTC(2000, 0, 1) / 1000,
        Date.UTC(2030, 0, 1) / 1000,
        year2018,
        "year"
      )
    ).toEqual(["2018"]);
  });
});

describe("enumerateWhenSteps", () => {
  it("lists every year in a half-open range", () => {
    expect(
      enumerateWhenSteps(
        {
          startSec: Date.UTC(2018, 0, 1) / 1000,
          endSec: Date.UTC(2022, 0, 1) / 1000,
        },
        "year"
      )
    ).toEqual(["2018", "2019", "2020", "2021"]);
  });

  it("enumerates a multi-decade daily series", () => {
    const steps = enumerateWhenSteps(
      {
        startSec: Date.UTC(1999, 0, 1) / 1000,
        endSec: Date.UTC(2025, 0, 1) / 1000,
      },
      "day"
    );
    expect(steps[0]).toBe("1999-01-01");
    expect(steps.length).toBeGreaterThan(9000);
    expect(steps.length).toBeLessThan(10000);
  });

  it("rejects a day series that exceeds the safety cap", () => {
    expect(() =>
      enumerateWhenSteps(
        {
          startSec: Date.UTC(1800, 0, 1) / 1000,
          endSec: Date.UTC(2025, 0, 1) / 1000,
        },
        "day"
      )
    ).toThrow(QueryError);
    try {
      enumerateWhenSteps(
        {
          startSec: Date.UTC(1800, 0, 1) / 1000,
          endSec: Date.UTC(2025, 0, 1) / 1000,
        },
        "day"
      );
    } catch (error) {
      expect(error).toBeInstanceOf(QueryError);
      expect((error as QueryError).details).toMatchObject({
        code: "when_step_limit",
        step: "day",
        maxSteps: 40000,
      });
    }
  });
});
