import { AnyLayer } from "mapbox-gl";
import { GeostatsAttribute } from "@seasketch/geostats-types";
import {
  extractColorsForCategories,
  isTransparentColor,
} from "./colors";

const landUseFilterStyle = [
  {
    type: "fill",
    paint: {
      "fill-pattern": "seasketch://sprites/629",
      "fill-outline-color": "rgba(91,11,125,1)",
    },
    filter: ["==", ["get", "type"], "construction"],
    metadata: { label: "construction" },
  },
  {
    type: "fill",
    paint: {
      "fill-color": "rgba(0,0,0,1)",
    },
    filter: ["==", ["get", "type"], "industrial"],
    metadata: { label: "industrial" },
  },
  {
    type: "line",
    paint: {
      "line-color": "rgb(0,0,0)",
      "line-width": 1,
      "line-opacity": 0,
      "line-dasharray": [0, 10],
    },
    filter: ["==", ["get", "type"], "industrial"],
    layout: {},
    metadata: { label: "industrial" },
  },
  {
    type: "fill",
    paint: {
      "fill-color": "rgba(13,117,0,1)",
    },
    filter: ["==", ["get", "type"], "farmland"],
    metadata: { label: "farmland" },
  },
  {
    type: "line",
    paint: {
      "line-color": "rgb(127,127,127)",
      "line-width": 1,
      "line-opacity": 1,
      "line-dasharray": [0, 10],
    },
    filter: ["==", ["get", "type"], "farmland"],
    layout: {},
    metadata: { label: "farmland" },
  },
  {
    type: "fill",
    paint: {
      "fill-color": "rgba(255,184,184,1)",
    },
    filter: ["==", ["get", "type"], "orchard"],
    metadata: { label: "orchard" },
  },
  {
    type: "line",
    paint: {
      "line-color": "rgb(127,127,127)",
      "line-width": 1,
      "line-opacity": 1,
      "line-dasharray": [0, 10],
    },
    filter: ["==", ["get", "type"], "orchard"],
    layout: {},
    metadata: { label: "orchard" },
  },
  {
    type: "fill",
    paint: {
      "fill-color": "rgba(178,178,178,1)",
    },
    filter: ["==", ["get", "type"], "residential"],
    metadata: { label: "residential" },
  },
  {
    type: "line",
    paint: {
      "line-color": "rgb(127,127,127)",
      "line-width": 1,
      "line-opacity": 1,
      "line-dasharray": [0, 10],
    },
    filter: ["==", ["get", "type"], "residential"],
    layout: {},
    metadata: { label: "residential" },
  },
] as AnyLayer[];

const typeAttribute = {
  attribute: "type",
  type: "string",
  values: {
    construction: 1,
    industrial: 1,
    farmland: 1,
    orchard: 1,
    residential: 1,
  },
} as GeostatsAttribute;

describe("extractColorsForCategories", () => {
  test("resolves colors from filter-based one-layer-per-category styles", () => {
    const values = [
      "construction",
      "industrial",
      "farmland",
      "orchard",
      "residential",
    ];
    const colors = extractColorsForCategories(
      values,
      typeAttribute,
      landUseFilterStyle
    );

    expect(colors.construction).toBe("rgba(91,11,125,1)");
    expect(colors.industrial).toBe("rgba(0,0,0,1)");
    expect(colors.farmland).toBe("rgba(13,117,0,1)");
    expect(colors.orchard).toBe("rgba(255,184,184,1)");
    expect(colors.residential).toBe("rgba(178,178,178,1)");
  });

  test("still resolves match-expression paint colors", () => {
    const style = [
      {
        type: "fill",
        paint: {
          "fill-color": [
            "match",
            ["get", "type"],
            "orchard",
            "rgba(255,184,184,1)",
            "residential",
            "rgba(178,178,178,1)",
            "#cccccc",
          ],
        },
      },
    ] as AnyLayer[];

    const colors = extractColorsForCategories(
      ["orchard", "residential", "other"],
      typeAttribute,
      style
    );

    expect(colors.orchard).toBe("rgba(255,184,184,1)");
    expect(colors.residential).toBe("rgba(178,178,178,1)");
    expect(colors.other).toBe("#cccccc");
  });

  test("reads equality filters nested under all", () => {
    const style = [
      {
        type: "fill",
        paint: { "fill-color": "rgba(10,20,30,1)" },
        filter: ["all", ["==", ["get", "type"], "farmland"]],
      },
    ] as AnyLayer[];

    const colors = extractColorsForCategories(
      ["farmland"],
      typeAttribute,
      style
    );
    expect(colors.farmland).toBe("rgba(10,20,30,1)");
  });
});

describe("isTransparentColor", () => {
  test("detects transparent rgba and keyword", () => {
    expect(isTransparentColor("transparent")).toBe(true);
    expect(isTransparentColor("rgba(0,0,0,0)")).toBe(true);
    expect(isTransparentColor("rgba(255,184,184,1)")).toBe(false);
  });
});
