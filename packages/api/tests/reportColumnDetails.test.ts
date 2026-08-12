import {
  knownColumnName,
  normalizeColumnDetails,
  pickBestCategoryColumn,
  pickBestContinuousColumn,
} from "../src/plugins/reportColumnDetails";

const sectorsLikeAttributes = [
  { attribute: "fid", type: "number", countDistinct: 369 },
  { attribute: "response_id", type: "number", countDistinct: 102 },
  { attribute: "priority", type: "number", countDistinct: 20 },
  {
    attribute: "aquaculture_mariculture_species_other",
    type: "string",
    countDistinct: 1,
  },
  {
    attribute: "aquaculture_mariculture_functions_other",
    type: "string",
    countDistinct: 1,
  },
  {
    attribute: "aquaculture_mariculture_status",
    type: "string",
    countDistinct: 3,
  },
  { attribute: "sector", type: "string", countDistinct: 9 },
  { attribute: "participants", type: "number", countDistinct: 50 },
];

describe("normalizeColumnDetails", () => {
  test("keys geostats attribute arrays by column name, not index", () => {
    const details = normalizeColumnDetails(sectorsLikeAttributes);
    expect(Object.keys(details)).toEqual(
      sectorsLikeAttributes.map((a) => a.attribute),
    );
    expect(details["5"]).toBeUndefined();
    expect(details.aquaculture_mariculture_status).toEqual({
      type: "string",
      countDistinct: 3,
    });
  });

  test("recovers when an attributes array was treated as a Record", () => {
    const asRecord = Object.fromEntries(
      sectorsLikeAttributes.map((attr, i) => [String(i), attr]),
    );
    const details = normalizeColumnDetails(asRecord);
    expect(details.sector?.countDistinct).toBe(9);
    expect(details["5"]).toBeUndefined();
  });

  test("coerces countDistinct stored as a string (SQL jsonb ->>)", () => {
    const details = normalizeColumnDetails({
      sector: { type: "string", countDistinct: "9" },
    });
    expect(details.sector.countDistinct).toBe(9);
  });
});

describe("pickBestCategoryColumn", () => {
  test("does not return an array index for a geostats attributes list", () => {
    expect(pickBestCategoryColumn(sectorsLikeAttributes, 369)).toBe(
      "aquaculture_mariculture_status",
    );
  });

  test("does not return an array index when attributes were keyed by index", () => {
    const asRecord = Object.fromEntries(
      sectorsLikeAttributes.map((attr, i) => [String(i), attr]),
    );
    expect(pickBestCategoryColumn(asRecord, 369)).toBe(
      "aquaculture_mariculture_status",
    );
  });
});

describe("pickBestContinuousColumn", () => {
  test("returns a real numeric column name from a geostats attributes list", () => {
    expect(pickBestContinuousColumn(sectorsLikeAttributes, 369)).toBe(
      "participants",
    );
  });
});

describe("knownColumnName", () => {
  test("rejects names that are not in the layer", () => {
    const details = normalizeColumnDetails(sectorsLikeAttributes);
    expect(knownColumnName(details, "5")).toBeUndefined();
    expect(knownColumnName(details, "sector")).toBe("sector");
  });
});
