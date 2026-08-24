import { describe, expect, it } from "@jest/globals";
import { GeostatsLayer } from "@seasketch/geostats-types";
import {
  assessStylePaste,
  collectReferencedProperties,
  geometryFamily,
  inferStyleKind,
  isLayerStyleClipboardPayload,
  mergeClipboardWithHopper,
  parseLayerStyleClipboardText,
  sanitizeStyleLayers,
  styleGeometryFamilies,
  targetAttributeNames,
} from "./layerStyleClipboard";

const polygonLayer: GeostatsLayer = {
  layer: "mangroves",
  count: 2,
  geometry: "MultiPolygon",
  hasZ: false,
  attributeCount: 2,
  attributes: [
    {
      attribute: "class",
      type: "string",
      count: 2,
      countDistinct: 1,
      values: { mangrove: 2 },
    },
    {
      attribute: "year",
      type: "number",
      count: 2,
      countDistinct: 1,
      values: { "1996": 2 },
    },
  ],
};

const pointLayer: GeostatsLayer = {
  layer: "sites",
  count: 1,
  geometry: "Point",
  hasZ: false,
  attributeCount: 1,
  attributes: [
    {
      attribute: "name",
      type: "string",
      count: 1,
      countDistinct: 1,
      values: { Hopkins: 1 },
    },
  ],
};

const simpleFill = [
  {
    type: "fill",
    paint: { "fill-color": "#2ca25f", "fill-opacity": 0.7 },
  },
];

const classifiedFill = [
  {
    type: "fill",
    paint: {
      "fill-color": [
        "match",
        ["get", "class"],
        "mangrove",
        "#2ca25f",
        "#cccccc",
      ],
    },
    filter: ["==", ["get", "year"], 1996],
  },
  {
    type: "line",
    paint: { "line-color": "#145a32" },
  },
];

describe("isLayerStyleClipboardPayload", () => {
  it("rejects null, undefined, and non-objects", () => {
    expect(isLayerStyleClipboardPayload(null)).toBe(false);
    expect(isLayerStyleClipboardPayload(undefined)).toBe(false);
    expect(isLayerStyleClipboardPayload("style")).toBe(false);
    expect(isLayerStyleClipboardPayload([])).toBe(false);
  });

  it("accepts a valid envelope", () => {
    expect(
      isLayerStyleClipboardPayload({
        version: 1,
        styleKind: "vector",
        mapboxGlStyles: simpleFill,
        copiedFromTitle: "Mangroves 1996",
      })
    ).toBe(true);
  });

  it("rejects an empty style list", () => {
    expect(
      isLayerStyleClipboardPayload({
        version: 1,
        styleKind: "raster",
        mapboxGlStyles: [],
      })
    ).toBe(false);
  });
});

describe("parseLayerStyleClipboardText", () => {
  it("returns null for empty or invalid JSON", () => {
    expect(parseLayerStyleClipboardText(null)).toBeNull();
    expect(parseLayerStyleClipboardText("")).toBeNull();
    expect(parseLayerStyleClipboardText("not json")).toBeNull();
    expect(parseLayerStyleClipboardText("{}")).toBeNull();
  });

  it("parses a raw Mapbox GL style array from the code editor", () => {
    const parsed = parseLayerStyleClipboardText(JSON.stringify(simpleFill));
    expect(parsed?.styleKind).toBe("vector");
    expect(parsed?.mapboxGlStyles).toEqual(simpleFill);
    expect(parsed?.copiedFromTitle).toBe("");
  });

  it("parses the hopper envelope and strips id/source", () => {
    const parsed = parseLayerStyleClipboardText(
      JSON.stringify({
        version: 1,
        styleKind: "raster",
        copiedFromTitle: "GMW 1996",
        copiedFromTocItemId: 12,
        mapboxGlStyles: [
          {
            id: "layer-0",
            source: "1",
            "source-layer": "mock",
            type: "raster",
            paint: { "raster-opacity": 0.8 },
          },
        ],
      })
    );
    expect(parsed?.styleKind).toBe("raster");
    expect(parsed?.copiedFromTitle).toBe("GMW 1996");
    expect(parsed?.copiedFromTocItemId).toBe(12);
    expect(parsed?.mapboxGlStyles[0]).toEqual({
      type: "raster",
      paint: { "raster-opacity": 0.8 },
    });
  });

  it("rejects an array of primitives", () => {
    expect(parseLayerStyleClipboardText("[1, 2, 3]")).toBeNull();
  });
});

describe("mergeClipboardWithHopper", () => {
  const hopper = {
    version: 1 as const,
    copiedFromTitle: "Mangroves 1996",
    copiedFromTocItemId: 9,
    styleKind: "vector" as const,
    mapboxGlStyles: simpleFill,
  };

  it("keeps hopper metadata when the clipboard is the same raw style JSON", () => {
    const parsed = parseLayerStyleClipboardText(JSON.stringify(simpleFill));
    expect(mergeClipboardWithHopper(parsed, hopper)).toEqual(hopper);
  });

  it("prefers a different style copied from the code editor", () => {
    const other = [
      { type: "fill", paint: { "fill-color": "#ff0000" } },
    ];
    const parsed = parseLayerStyleClipboardText(JSON.stringify(other));
    expect(mergeClipboardWithHopper(parsed, hopper)?.mapboxGlStyles).toEqual(
      other
    );
    expect(mergeClipboardWithHopper(parsed, hopper)?.copiedFromTitle).toBe("");
  });

  it("falls back to the hopper when the clipboard is empty", () => {
    expect(mergeClipboardWithHopper(null, hopper)).toEqual(hopper);
  });
});

describe("sanitizeStyleLayers", () => {
  it("strips runtime-only keys and leaves paint intact", () => {
    expect(
      sanitizeStyleLayers([
        {
          id: "x",
          source: "src",
          "source-layer": "lyr",
          type: "fill",
          paint: { "fill-color": "#00ff00" },
        },
      ])
    ).toEqual([{ type: "fill", paint: { "fill-color": "#00ff00" } }]);
  });
});

describe("inferStyleKind", () => {
  it("classifies fill styles as vector and raster styles as raster", () => {
    expect(inferStyleKind(simpleFill)).toBe("vector");
    expect(inferStyleKind([{ type: "raster", paint: {} }])).toBe("raster");
  });

  it("returns null when no recognizable layer types are present", () => {
    expect(inferStyleKind([{ paint: {} }])).toBeNull();
  });
});

describe("collectReferencedProperties", () => {
  it("returns an empty list when there are no get expressions", () => {
    expect(collectReferencedProperties(simpleFill)).toEqual([]);
    expect(collectReferencedProperties(null)).toEqual([]);
  });

  it("collects nested get expressions and legacy filters", () => {
    expect(collectReferencedProperties(classifiedFill)).toEqual([
      "class",
      "year",
    ]);
    expect(
      collectReferencedProperties([
        { type: "fill", filter: ["==", "habitat", "reef"] },
      ])
    ).toEqual(["habitat"]);
  });

  it("ignores get-from-object and zoom filters", () => {
    expect(
      collectReferencedProperties([
        {
          type: "fill",
          paint: {
            "fill-color": ["get", "color", ["literal", { color: "red" }]],
          },
          filter: [">=", "zoom", 4],
        },
      ])
    ).toEqual([]);
  });
});

describe("geometry helpers", () => {
  it("maps GeoJSON types to families", () => {
    expect(geometryFamily("MultiPolygon")).toBe("polygon");
    expect(geometryFamily("Point")).toBe("point");
    expect(geometryFamily("LineString")).toBe("line");
    expect(geometryFamily("Unknown")).toBeNull();
    expect(geometryFamily(null)).toBeNull();
  });

  it("treats fill as polygon and circle as point", () => {
    expect(Array.from(styleGeometryFamilies(["fill", "line"]))).toEqual(
      expect.arrayContaining(["polygon", "line"])
    );
    expect(Array.from(styleGeometryFamilies(["circle"]))).toEqual(["point"]);
    expect(Array.from(styleGeometryFamilies(["symbol"]))).toEqual([]);
  });
});

describe("targetAttributeNames", () => {
  it("returns null for missing geostats and names for a valid layer", () => {
    expect(targetAttributeNames(null)).toBeNull();
    expect(targetAttributeNames(undefined)).toBeNull();
    expect(targetAttributeNames({ bands: [] })).toBeNull();
    expect(targetAttributeNames(polygonLayer)).toEqual(["class", "year"]);
  });
});

describe("assessStylePaste", () => {
  it("blocks vector-to-raster and raster-to-vector", () => {
    expect(
      assessStylePaste({
        styles: simpleFill,
        copiedKind: "vector",
        targetKind: "raster",
        geostats: undefined,
      })
    ).toEqual([
      {
        kind: "style-kind-mismatch",
        copiedKind: "vector",
        targetKind: "raster",
      },
    ]);
  });

  it("is silent for the same-schema mangrove case", () => {
    expect(
      assessStylePaste({
        styles: simpleFill,
        copiedKind: "vector",
        targetKind: "vector",
        geostats: polygonLayer,
      })
    ).toEqual([]);
  });

  it("warns when get expressions reference missing properties", () => {
    expect(
      assessStylePaste({
        styles: classifiedFill,
        copiedKind: "vector",
        targetKind: "vector",
        geostats: pointLayer,
      })
    ).toEqual(
      expect.arrayContaining([
        { kind: "missing-properties", properties: ["class", "year"] },
        expect.objectContaining({ kind: "geometry-mismatch" }),
      ])
    );
  });

  it("does not warn about missing properties when geostats are absent", () => {
    expect(
      assessStylePaste({
        styles: classifiedFill,
        copiedKind: "vector",
        targetKind: "vector",
        geostats: undefined,
      })
    ).toEqual([]);
  });

  it("warns when a fill style is pasted onto point data", () => {
    expect(
      assessStylePaste({
        styles: simpleFill,
        copiedKind: "vector",
        targetKind: "vector",
        geostats: pointLayer,
      })
    ).toEqual([
      expect.objectContaining({
        kind: "geometry-mismatch",
        targetGeometry: "Point",
      }),
    ]);
  });
});
