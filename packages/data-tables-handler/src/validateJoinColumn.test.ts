import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GeostatsLayer } from "@seasketch/geostats-types";
import {
  assertUnmatchedRecordFractionAllowed,
  validateJoinColumnChoice,
} from "./validateJoinColumn";

function siteLayer(
  values: Record<string, number>,
  countDistinct = Object.keys(values).length,
): GeostatsLayer {
  return {
    layer: "sites",
    count: countDistinct,
    geometry: "Point",
    hasZ: false,
    attributeCount: 1,
    attributes: [
      {
        attribute: "site",
        type: "string",
        count: countDistinct,
        countDistinct,
        values,
      },
    ],
  };
}

describe("validateJoinColumnChoice", () => {
  it("accepts a complete match", () => {
    const result = validateJoinColumnChoice(
      ["site", "count"],
      "site",
      "site",
      siteLayer({ A: 1, B: 1 }),
      new Set(["A", "B"]),
    );
    assert.equal(result.matchedRows, 2);
    assert.equal(result.unmatchedRows, 0);
    assert.deepEqual(result.unmatchedJoinValues, []);
    assert.equal(result.histogramComplete, true);
  });

  it("returns unmatched sites instead of failing when the histogram is complete", () => {
    const result = validateJoinColumnChoice(
      ["site", "count"],
      "site",
      "site",
      siteLayer({ A: 1, B: 1 }),
      new Set(["A", "B", "MISSING_SITE"]),
    );
    assert.equal(result.matchedRows, 2);
    assert.equal(result.unmatchedRows, 1);
    assert.deepEqual(result.unmatchedJoinValues, ["MISSING_SITE"]);
    assert.deepEqual(result.matchedJoinValues, ["A", "B"]);
    assert.equal(result.histogramComplete, true);
  });

  it("still fails when no join values match the overlay", () => {
    assert.throws(
      () =>
        validateJoinColumnChoice(
          ["site", "count"],
          "site",
          "site",
          siteLayer({ A: 1 }),
          new Set(["MISSING_SITE"]),
        ),
      /No values in the join column match overlay feature identifiers/,
    );
  });

  it("does not treat unmatched values as droppable when the histogram is truncated", () => {
    const result = validateJoinColumnChoice(
      ["site", "count"],
      "site",
      "site",
      siteLayer({ A: 1, B: 1 }, 800),
      new Set(["A", "NOT_IN_HISTOGRAM"]),
    );
    assert.equal(result.histogramComplete, false);
    assert.deepEqual(result.unmatchedJoinValues, ["NOT_IN_HISTOGRAM"]);
    assert.equal(result.matchedRows, 1);
  });

  it("fails when the CSV is missing the join column", () => {
    assert.throws(
      () =>
        validateJoinColumnChoice(
          ["count"],
          "site",
          "site",
          siteLayer({ A: 1 }),
          new Set(["A"]),
        ),
      /Join column "site" not found/,
    );
  });
});

describe("assertUnmatchedRecordFractionAllowed", () => {
  it("allows dropping fewer than 25% of rows", () => {
    assert.doesNotThrow(() =>
      assertUnmatchedRecordFractionAllowed(24, 100, ["MISSING_SITE"]),
    );
  });

  it("fails when 25% or more of rows cannot join", () => {
    assert.throws(
      () =>
        assertUnmatchedRecordFractionAllowed(25, 100, [
          "MISSING_SITE",
          "OTHER_SITE",
        ]),
      /25% of rows \(25 of 100\).*Missing sites: MISSING_SITE, OTHER_SITE/,
    );
  });

  it("does nothing when there are no unmatched rows", () => {
    assert.doesNotThrow(() =>
      assertUnmatchedRecordFractionAllowed(0, 100, []),
    );
  });
});
