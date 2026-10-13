import { Feature, LineString } from "geojson";
import { SpatialMetricState } from "../../generated/graphql";
import { exportDistanceToPointMap } from "./exports/exporters/distanceToPointMap.export";
import {
  convertTravelCostNumbers,
  defaultTravelCostSettings,
  formatTravelCost,
  clearFuelCostClientOverrides,
  fuelCostOverridesMatchSettings,
  fuelCostStorageKey,
  isFuelCostClientOverrides,
  isRecognizedCurrency,
  isTravelCostSettings,
  listCurrencyChoices,
  readFuelCostClientOverrides,
  writeFuelCostClientOverrides,
  travelCostForMeters,
  travelCostFromDefaults,
  travelCostsUsable,
  TravelCostSettings,
  withTravelCostPatch,
} from "./travelCost";

const fiji: TravelCostSettings = {
  enabled: true,
  currency: "FJD",
  volume: "liter",
  efficiencyMode: "distance-per-volume",
  efficiencyLength: "kilometer",
  defaultEfficiency: 1.5,
  defaultPrice: 2.31,
};

describe("isTravelCostSettings", () => {
  it("rejects null, undefined, and non-objects", () => {
    expect(isTravelCostSettings(null)).toBe(false);
    expect(isTravelCostSettings(undefined)).toBe(false);
    expect(isTravelCostSettings("FJD")).toBe(false);
    expect(isTravelCostSettings(2.31)).toBe(false);
    expect(isTravelCostSettings(["liter"])).toBe(false);
  });

  it("rejects a bad volume", () => {
    expect(isTravelCostSettings({ ...fiji, volume: "quart" })).toBe(false);
  });

  it("accepts a Fiji-shaped example and blank numbers", () => {
    expect(isTravelCostSettings(fiji)).toBe(true);
    expect(
      isTravelCostSettings({
        ...fiji,
        defaultEfficiency: null,
        defaultPrice: null,
      })
    ).toBe(true);
  });
});

describe("travelCostForMeters", () => {
  it("prices 76 km at 1.5 km/L and 2.31 FJD/L", () => {
    const cost = travelCostForMeters(76_000, fiji, 1.5, 2.31);
    expect(cost).not.toBeNull();
    // 76 / 1.5 * 2.31 = 117.04 one way, twice that to return on the same route.
    expect(cost?.oneWay).toBeCloseTo(117.04, 2);
    expect(cost?.roundTrip).toBeCloseTo(234.08, 2);
    expect(cost?.liters).toBeCloseTo(76 / 1.5, 5);
    const formatted = formatTravelCost(cost!.oneWay, "FJD", "en");
    expect(formatted).toMatch(/FJD/);
    expect(formatted).toMatch(/117\.04/);
  });

  it("returns null for blank inputs", () => {
    expect(
      travelCostFromDefaults(76_000, { ...fiji, defaultPrice: null })
    ).toBeNull();
    expect(
      travelCostFromDefaults(76_000, { ...fiji, defaultEfficiency: null })
    ).toBeNull();
    expect(travelCostForMeters(76_000, fiji, 1.5, 0)).toBeNull();
  });

  it("stays off until currency, fuel use, and price are all usable", () => {
    expect(travelCostsUsable(fiji)).toBe(true);
    expect(travelCostsUsable({ ...fiji, currency: "" })).toBe(false);
    expect(travelCostsUsable({ ...fiji, currency: "ZZZ" })).toBe(false);
    expect(travelCostsUsable({ ...fiji, defaultPrice: null })).toBe(false);
    expect(travelCostsUsable({ ...fiji, defaultEfficiency: 0 })).toBe(false);
  });

  it("does not format an unrecognized currency code", () => {
    expect(isRecognizedCurrency("FJD")).toBe(true);
    expect(isRecognizedCurrency("ZZZ")).toBe(false);
    expect(isRecognizedCurrency("")).toBe(false);
    expect(formatTravelCost(116, "ZZZ", "en")).toBeNull();
    expect(formatTravelCost(116, "fjd", "en")).toMatch(/FJD/);
  });
});

describe("convertTravelCostNumbers", () => {
  it("keeps the same estimate when the volume unit changes", () => {
    const converted = convertTravelCostNumbers(fiji, {
      ...fiji,
      volume: "gallon",
    });
    const next: TravelCostSettings = {
      ...fiji,
      volume: "gallon",
      ...converted,
    };
    const before = travelCostFromDefaults(76_000, fiji);
    const after = travelCostFromDefaults(76_000, next);
    expect(before).not.toBeNull();
    expect(after?.oneWay).toBeCloseTo(before!.oneWay, 4);
    expect(after?.roundTrip).toBeCloseTo(before!.roundTrip, 4);
    expect(next.defaultEfficiency).toBeGreaterThan(fiji.defaultEfficiency!);
  });

  it("keeps the same estimate in nautical miles and volume-per-distance", () => {
    const patched = withTravelCostPatch(fiji, {
      efficiencyLength: "nautical-mile",
      efficiencyMode: "volume-per-distance",
    });
    const before = travelCostFromDefaults(76_000, fiji);
    const after = travelCostFromDefaults(76_000, patched);
    expect(after?.oneWay).toBeCloseTo(before!.oneWay, 4);
    expect(patched.efficiencyMode).toBe("volume-per-distance");
    expect(patched.efficiencyLength).toBe("nautical-mile");
  });

  it("leaves blank numbers blank", () => {
    const blank: TravelCostSettings = {
      ...fiji,
      defaultEfficiency: null,
      defaultPrice: null,
    };
    expect(
      convertTravelCostNumbers(blank, { ...blank, volume: "gallon" })
    ).toEqual({
      defaultEfficiency: null,
      defaultPrice: null,
    });
  });
});

describe("defaultTravelCostSettings", () => {
  it("matches a mile map and otherwise starts in kilometers", () => {
    expect(defaultTravelCostSettings("mile").efficiencyLength).toBe("mile");
    expect(defaultTravelCostSettings("nautical-mile").efficiencyLength).toBe(
      "nautical-mile"
    );
    expect(defaultTravelCostSettings("meter").efficiencyLength).toBe(
      "kilometer"
    );
    expect(defaultTravelCostSettings(undefined).defaultPrice).toBeNull();
    expect(defaultTravelCostSettings("kilometer").volume).toBe("liter");
    expect(defaultTravelCostSettings("kilometer").enabled).toBe(false);
  });
});

describe("listCurrencyChoices", () => {
  it("names FJD from the browser currency list", () => {
    const choices = listCurrencyChoices("en");
    const fjd = choices.find((choice) => choice.code === "FJD");
    expect(fjd).toBeTruthy();
    if (typeof Intl.DisplayNames === "function") {
      expect(fjd!.name.toLowerCase()).toContain("fiji");
    }
    expect(choices.some((choice) => choice.code === "ZZZ")).toBe(false);
  });
});

describe("fuel cost client overrides", () => {
  const saved = {
    efficiency: "2",
    price: "3",
    volume: "liter" as const,
    efficiencyMode: "distance-per-volume" as const,
    efficiencyLength: "kilometer" as const,
    currency: "FJD",
  };

  afterEach(() => {
    window.localStorage.clear();
  });

  it("rejects null, undefined, and a non-object", () => {
    expect(isFuelCostClientOverrides(null)).toBe(false);
    expect(isFuelCostClientOverrides(undefined)).toBe(false);
    expect(isFuelCostClientOverrides("2")).toBe(false);
    expect(isFuelCostClientOverrides({ efficiency: "2" })).toBe(false);
  });

  it("stores edits under the report card id and restores by clearing them", () => {
    expect(fuelCostStorageKey(10)).toBe("10-fuel-costs");
    expect(isFuelCostClientOverrides(saved)).toBe(true);
    expect(fuelCostOverridesMatchSettings(saved, fiji)).toBe(true);
    expect(
      fuelCostOverridesMatchSettings({ ...saved, volume: "gallon" }, fiji)
    ).toBe(false);
    writeFuelCostClientOverrides(10, saved);
    expect(readFuelCostClientOverrides(10)).toEqual(saved);
    expect(window.localStorage.getItem("10-fuel-costs")).toContain("FJD");
    clearFuelCostClientOverrides(10);
    expect(readFuelCostClientOverrides(10)).toBeNull();
  });
});

describe("distance to point export", () => {
  const line: Feature<LineString> = {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: [
        [0, 0],
        [1, 1],
      ],
    },
  };

  function sections(travelCost?: TravelCostSettings) {
    return exportDistanceToPointMap({
      dependencies: [],
      metrics: [
        {
          type: "distance_to_features_over_water",
          state: SpatialMetricState.Complete,
          value: {
            exceededLimit: false,
            features: [
              {
                __id: 1,
                meters: 76000,
                properties: { PORT_NAME: "Suva" },
                geojsonLine: line,
              },
            ],
          },
          subject: { hash: "1", geographies: [], sketches: [1] },
        },
      ],
      sources: [],
      geographies: [],
      componentSettings: {
        labelColumn: "PORT_NAME",
        ...(travelCost ? { travelCost } : {}),
      },
      sketchClass: {},
      subject: {
        sketchId: 1,
        sketchName: "Sketch",
        isCollection: false,
        childSketches: [],
      },
      relatedFragments: [],
      t: (key: string) => key,
    } as Parameters<typeof exportDistanceToPointMap>[0]);
  }

  it("leaves existing columns unchanged when fuel costs are off", () => {
    const [section] = sections();
    expect(section.columns.map((column) => column.key)).toEqual([
      "scope",
      "sketchId",
      "sketchName",
      "meters",
      "name",
      "unit",
    ]);
  });

  it("exports one-way and round-trip cost from the stored defaults", () => {
    const [section] = sections(fiji);
    const row = section.rows[0];
    expect(row?.name).toBe("Suva");
    expect(row?.currency).toBe("FJD");
    expect(row?.oneWayCost).toBeCloseTo(117.04, 2);
    expect(row?.roundTripCost).toBeCloseTo(234.08, 2);
    expect(section.columns.map((column) => column.key)).toContain("oneWayCost");
  });
});
