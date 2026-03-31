import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deriveValueSteps } from "../lib/geostats/valueSteps";

describe("deriveValueSteps", () => {
  it("defaults to target class count 8 using natural breaks", () => {
    const result = deriveValueSteps({
      bands: [
        {
          stats: {
            naturalBreaks: { "5": [], "8": [], "10": [] },
            quantiles: { "6": [], "7": [] },
            equalInterval: { "4": [], "9": [] },
            histogram: [
              [0, 10],
              [1, 2],
              [2, 1],
              [3, 15],
              [4, 0],
            ],
          },
        },
      ],
    });

    expect(result).toEqual({
      value_steps: "NATURAL_BREAKS",
      value_steps_n: 8,
    });
  });

  it("chooses continuous for near-uniform histogram", () => {
    const result = deriveValueSteps({
      bands: [
        {
          stats: {
            naturalBreaks: { "7": [] },
            quantiles: { "8": [] },
            equalInterval: { "8": [] },
            histogram: [
              [0, 10],
              [1, 9],
              [2, 11],
              [3, 10],
              [4, 10],
            ],
          },
        },
      ],
    });

    expect(result).toEqual({ value_steps: "CONTINUOUS" });
  });

  it("falls back to continuous when no break sets exist", () => {
    const result = deriveValueSteps({
      bands: [{ stats: { histogram: [[0, 10]] } }],
    });

    expect(result).toEqual({ value_steps: "CONTINUOUS" });
  });

  it("uses continuous for pristine-seas smooth raster distribution", () => {
    const fixture = JSON.parse(
      readFileSync(
        join(process.cwd(), "__tests__", "geostats", "pristine-seas.json"),
        "utf8",
      ),
    ) as { geostats: unknown };

    const result = deriveValueSteps(fixture.geostats);
    expect(result).toEqual({ value_steps: "CONTINUOUS" });
  });

  it("applies to continuous vector layers using chosen numeric column", () => {
    const geostats = {
      attributes: [
        {
          attribute: "height",
          type: "number",
          stats: {
            naturalBreaks: { "8": [] },
            quantiles: { "8": [] },
            equalInterval: { "8": [] },
            histogram: [
              [0, 10],
              [1, 5],
              [2, 2],
              [3, 11],
            ],
          },
        },
      ],
    };

    const result = deriveValueSteps(geostats, "height");
    expect(result).toEqual({ value_steps: "NATURAL_BREAKS", value_steps_n: 8 });
  });
});
