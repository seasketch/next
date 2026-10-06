import { OUS_DEMOGRAPHICS_ROLLUP_KEY } from "overlay-engine";
import {
  buildOusDemographicsFigures,
  ousFragmentBelongsToGeography,
  resolveOusDemographicsTotalScope,
} from "./ousDemographicsRows";

const fragmentValue = {
  groups: {
    Fishing: { r1: { representedInSector: 10, participants: 20 } },
    OnlyPlan: { r2: { representedInSector: 5, participants: 5 } },
    [OUS_DEMOGRAPHICS_ROLLUP_KEY]: {
      r1: { representedInSector: 10, participants: 20 },
      r2: { representedInSector: 5, participants: 5 },
    },
  },
  totals: {
    Fishing: { representedInSector: 100, participants: 200, respondents: 4 },
    OnlyDataset: { representedInSector: 8, participants: 8, respondents: 1 },
    OnlyPlan: { representedInSector: 5, participants: 5, respondents: 1 },
    [OUS_DEMOGRAPHICS_ROLLUP_KEY]: {
      representedInSector: 113,
      participants: 213,
      respondents: 6,
    },
  },
};

const geographyValue = {
  groups: {
    Fishing: {
      r1: { representedInSector: 10, participants: 20 },
      r3: { representedInSector: 30, participants: 60 },
    },
    [OUS_DEMOGRAPHICS_ROLLUP_KEY]: {
      r1: { representedInSector: 10, participants: 20 },
      r3: { representedInSector: 30, participants: 60 },
    },
  },
  // Full-dataset totals are still stored on geography metrics. The Total
  // column must ignore them.
  totals: fragmentValue.totals,
};

describe("ousFragmentBelongsToGeography", () => {
  test("matches a fragment tagged with the denominator geography", () => {
    expect(ousFragmentBelongsToGeography({ geographies: [1, 2] }, 1)).toBe(
      true
    );
  });

  test("rejects fragments that only overlap other geographies", () => {
    expect(ousFragmentBelongsToGeography({ geographies: [2] }, 1)).toBe(false);
    expect(ousFragmentBelongsToGeography(null, 1)).toBe(false);
    expect(ousFragmentBelongsToGeography(undefined, 1)).toBe(false);
    expect(ousFragmentBelongsToGeography({}, 1)).toBe(false);
    expect(ousFragmentBelongsToGeography({ geographies: "1" }, 1)).toBe(false);
  });
});

describe("resolveOusDemographicsTotalScope", () => {
  test("uses the clipping geography when the card never chose a population", () => {
    expect(resolveOusDemographicsTotalScope(undefined, true)).toBe("geography");
  });

  test("keeps the entire survey when the sketch class does not clip", () => {
    expect(resolveOusDemographicsTotalScope(undefined, false)).toBe("dataset");
  });

  test("keeps an explicit choice", () => {
    expect(resolveOusDemographicsTotalScope("dataset", true)).toBe("dataset");
    expect(resolveOusDemographicsTotalScope("geography", false)).toBe(
      "geography"
    );
  });
});

describe("buildOusDemographicsFigures", () => {
  test("dataset scope uses full-survey totals, including groups with no plan overlap", () => {
    const figures = buildOusDemographicsFigures({
      fragmentValue,
      geographyValue,
      totalScope: "dataset",
      totalMode: "representedInSector",
    });
    expect(figures.groups).toEqual(
      expect.arrayContaining([
        { key: "Fishing", within: 10, total: 100 },
        { key: "OnlyDataset", within: 0, total: 8 },
        { key: "OnlyPlan", within: 5, total: 5 },
      ])
    );
    expect(figures.groups).toHaveLength(3);
    expect(figures.rollup).toEqual({
      key: OUS_DEMOGRAPHICS_ROLLUP_KEY,
      within: 15,
      total: 113,
    });
  });

  test("geography scope uses overlap groups and drops survey-only groups", () => {
    const figures = buildOusDemographicsFigures({
      fragmentValue,
      geographyValue,
      totalScope: "geography",
      totalMode: "representedInSector",
    });
    const byKey = Object.fromEntries(figures.groups.map((row) => [row.key, row]));
    expect(byKey.Fishing).toEqual({ key: "Fishing", within: 10, total: 40 });
    expect(byKey.OnlyPlan).toEqual({ key: "OnlyPlan", within: 5, total: 0 });
    expect(byKey.OnlyDataset).toBeUndefined();
    expect(figures.rollup).toEqual({
      key: OUS_DEMOGRAPHICS_ROLLUP_KEY,
      within: 15,
      total: 40,
    });
  });

  test("participants mode reads the participants field of the chosen population", () => {
    const figures = buildOusDemographicsFigures({
      fragmentValue,
      geographyValue,
      totalScope: "geography",
      totalMode: "participants",
    });
    const fishing = figures.groups.find((row) => row.key === "Fishing");
    expect(fishing).toEqual({ key: "Fishing", within: 10, total: 80 });
  });
});
