import {
  canRasterBreakdownByValue,
  defaultRasterOverlayAreaGroupBy,
  getClassTableRows,
  getRasterCategoryColorsFromStyle,
  getRasterExcludedValuesFromStyle,
  getRasterOverlayAreaClassValues,
} from "./ClassTableRows";
import { AnyLayer } from "mapbox-gl";
import { SuggestedRasterPresentation } from "@seasketch/geostats-types";
import { OverlaySourceDetailsFragment } from "../../generated/graphql";

describe("raster class table helpers", () => {
  const substrateStyle = [
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
          "rgba(254,127,0,1.0)",
          2,
          "rgba(116,121,90,1.0)",
        ],
      },
      metadata: {
        "s:excluded": [0],
        "s:legend-labels": {
          "1": "Hard",
          "2": "Soft",
        },
      },
    },
  ] as unknown as AnyLayer[];

  const mangrovePresenceStyle = [
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
      metadata: {
        "s:excluded": [0],
      },
    },
  ] as unknown as AnyLayer[];

  test("extracts per-value colors from step raster-color", () => {
    expect(getRasterCategoryColorsFromStyle(substrateStyle)).toEqual({
      "1": "rgba(254,127,0,1.0)",
      "2": "rgba(116,121,90,1.0)",
    });
  });

  test("reads s:excluded values", () => {
    expect([...getRasterExcludedValuesFromStyle(substrateStyle)].sort()).toEqual(
      ["0"]
    );
  });

  test("handles nullish styles", () => {
    expect(getRasterCategoryColorsFromStyle(undefined)).toEqual({});
    expect(getRasterExcludedValuesFromStyle(undefined).size).toBe(0);
  });

  test("collects multi-class values from categories", () => {
    expect(
      getRasterOverlayAreaClassValues({
        geostats: {
          presentation: SuggestedRasterPresentation.categorical,
          bands: [
            {
              stats: {
                categories: [
                  [0, 10],
                  [1, 20],
                  [2, 30],
                ],
              },
            },
          ],
        },
        mapboxGlStyles: substrateStyle,
      })
    ).toEqual(["1", "2"]);
  });

  test("presence rasters have fewer than two class values", () => {
    const source = {
      geostats: {
        presentation: SuggestedRasterPresentation.categorical,
        bands: [{ stats: { categories: [[1, 100]] } }],
      },
      mapboxGlStyles: mangrovePresenceStyle,
    };
    expect(getRasterOverlayAreaClassValues(source)).toEqual(["1"]);
    expect(canRasterBreakdownByValue(source)).toBe(false);
    expect(defaultRasterOverlayAreaGroupBy(source)).toBeUndefined();
  });

  test("defaults groupBy value when multi-class symbology exists", () => {
    expect(
      defaultRasterOverlayAreaGroupBy({
        geostats: {
          presentation: SuggestedRasterPresentation.continuous,
          bands: [],
        },
        mapboxGlStyles: substrateStyle,
      })
    ).toBe("value");
  });

  test("defaults to single row for continuous without categorical style", () => {
    expect(
      defaultRasterOverlayAreaGroupBy({
        geostats: {
          presentation: SuggestedRasterPresentation.continuous,
          bands: [],
        },
        mapboxGlStyles: [
          {
            type: "raster",
            paint: {
              "raster-color": [
                "interpolate",
                ["linear"],
                ["raster-value"],
                0,
                "#000",
                1,
                "#fff",
              ],
            },
          },
        ] as unknown as AnyLayer[],
      })
    ).toBeUndefined();
  });

  test("groupBy value with no discoverable classes keeps a total row", () => {
    const source = {
      stableId: "mangrove",
      geostats: {
        presentation: SuggestedRasterPresentation.continuous,
        bands: [{ stats: {} }],
      },
      mapboxGlStyles: null,
      tableOfContentsItem: { title: "Mangroves 2020" },
    } as unknown as OverlaySourceDetailsFragment;

    const rows = getClassTableRows({
      dependencies: [
        {
          type: "raster_overlay_area",
          subjectType: "fragments",
          stableId: "mangrove",
          parameters: { groupBy: "value" },
        },
      ],
      sources: [source],
      customLabels: {},
      allFeaturesLabel: "All features",
    });

    expect(rows).toEqual([
      expect.objectContaining({
        key: "mangrove-*",
        label: "Mangroves 2020",
        groupByKey: "*",
        sourceId: "mangrove",
      }),
    ]);
  });
});
