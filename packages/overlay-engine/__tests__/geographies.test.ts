import { Feature, MultiPolygon, Polygon } from "geojson";
import {
  clipToGeography,
  clipSketchToPolygons,
  ClippingFn,
  ClippingLayerOption,
} from "../src/geographies";
import { SourceCache } from "fgb-source";
import { prepareSketch } from "../src/utils/prepareSketch";
import { describe, it, expect, beforeAll } from "vitest";

const eezUrl = "https://uploads.seasketch.org/eez-land-joined.fgb";
const territorialSeaUrl =
  "https://uploads.seasketch.org/territorial-sea-land-joined.fgb";

// Geography configurations
const hawaiiTerritorialSea: ClippingLayerOption[] = [
  {
    source: territorialSeaUrl,
    op: "INTERSECT",
    cql2Query: { op: "=", args: [{ property: "UNION" }, "Hawaii"] },
  },
];

const hawaiiOffshore: ClippingLayerOption[] = [
  {
    source: eezUrl,
    op: "INTERSECT",
    cql2Query: { op: "=", args: [{ property: "UNION" }, "Hawaii"] },
  },
  {
    source: territorialSeaUrl,
    op: "DIFFERENCE",
  },
];

const testFeatures = {
  insideTerritorialSea: {
    type: "Feature",
    properties: {
      name: "inside-territorial-sea",
    },
    geometry: {
      coordinates: [
        [
          [-155.9329909339407, 20.05340354712547],
          [-155.9329909339407, 19.99526059321815],
          [-155.86160332129435, 19.99526059321815],
          [-155.86160332129435, 20.05340354712547],
          [-155.9329909339407, 20.05340354712547],
        ],
      ],
      type: "Polygon",
    },
  } as Feature<Polygon>,
  outsideTerritorialSea: {
    type: "Feature",
    properties: {
      name: "outside-territorial-sea",
    },
    geometry: {
      coordinates: [
        [
          [-156.42322353934478, 20.216509485630354],
          [-156.42322353934478, 20.145031951265466],
          [-156.33755182189554, 20.145031951265466],
          [-156.33755182189554, 20.216509485630354],
          [-156.42322353934478, 20.216509485630354],
        ],
      ],
      type: "Polygon",
    },
  } as Feature<Polygon>,
  clipToTerritorialSea: {
    type: "Feature",
    properties: {},
    geometry: {
      coordinates: [
        [
          [-155.65605257087174, 18.979783831211208],
          [-155.86439746281968, 18.979783831211208],
          [-155.86439746281968, 18.76203491605979],
          [-155.65605257087174, 18.76203491605979],
          [-155.65605257087174, 18.979783831211208],
        ],
      ],
      type: "Polygon",
    },
  } as Feature<Polygon>,
  clipToEez: {
    type: "Feature",
    properties: {
      name: "clip-to-eez",
    },
    geometry: {
      coordinates: [
        [
          [-155.93118434950043, 18.049041813607715],
          [-155.9577711091476, 14.331741198369656],
          [-153.4961990343199, 14.43479876822633],
          [-154.02433773248887, 18.049041813607715],
          [-155.93118434950043, 18.049041813607715],
        ],
      ],
      type: "Polygon",
    },
  } as Feature<Polygon>,
  outsideEez: {
    type: "Feature",
    properties: {
      name: "outside-eez",
    },
    geometry: {
      coordinates: [
        [
          [-158.80305635227188, 13.039376190126717],
          [-158.80305635227188, 12.314678077326093],
          [-157.8201452290751, 12.314678077326093],
          [-157.8201452290751, 13.039376190126717],
          [-158.80305635227188, 13.039376190126717],
        ],
      ],
      type: "Polygon",
    },
  } as Feature<Polygon>,
};

function countCoordinates(geom: MultiPolygon | Polygon) {
  if (geom.type === "Polygon") {
    return geom.coordinates.reduce((sum, ring) => sum + ring.length, 0);
  } else {
    // MultiPolygon
    return geom.coordinates.reduce(
      (sum, poly) => sum + poly.reduce((s, ring) => s + ring.length, 0),
      0
    );
  }
}

describe("clipToGeography", () => {
  let sourceCache: SourceCache;
  let clippingFn: ClippingFn;

  beforeAll(() => {
    sourceCache = new SourceCache("128mb");
    clippingFn = async (sketch, source, op, query) => {
      const fgbSource = await sourceCache.get<Feature<MultiPolygon | Polygon>>(
        source
      );
      const overlappingFeatures = fgbSource.getFeaturesAsync(sketch.envelopes);
      return clipSketchToPolygons(sketch, op, query, overlappingFeatures);
    };
  });

  it("should clip to nearshore geography (territorial sea)", async () => {
    const preparedSketch = prepareSketch(testFeatures.clipToTerritorialSea);
    const originalCoordinates = countCoordinates(
      preparedSketch.feature.geometry
    );

    const result = await clipToGeography(
      preparedSketch,
      hawaiiTerritorialSea,
      clippingFn
    );

    expect(result).not.toBeNull();
    expect(result?.geometry.type).toBe("MultiPolygon");
    // The result should be the intersection of the sketch with Hawaii's territorial sea
    expect(
      countCoordinates(result?.geometry as MultiPolygon | Polygon)
    ).toBeGreaterThan(originalCoordinates);
    // Verify the geometry was actually clipped by checking that it's different from the original
    expect(result?.geometry).not.toEqual(preparedSketch.feature.geometry);
  });

  it("should clip to offshore geography (EEZ minus territorial sea)", async () => {
    const preparedSketch = prepareSketch(testFeatures.clipToEez);
    const originalCoordinates = countCoordinates(
      preparedSketch.feature.geometry
    );

    const result = await clipToGeography(
      preparedSketch,
      hawaiiOffshore,
      clippingFn
    );

    expect(result).not.toBeNull();
    expect(result?.geometry.type).toBe("MultiPolygon");
    // The result should be the intersection of the sketch with Hawaii's EEZ minus its territorial sea
    expect(
      countCoordinates(result?.geometry as MultiPolygon | Polygon)
    ).toBeGreaterThan(originalCoordinates);
    // Verify the geometry was actually clipped by checking that it's different from the original
    expect(result?.geometry).not.toEqual(preparedSketch.feature.geometry);
  });

  it("should return null when sketch is outside territorial sea", async () => {
    const preparedSketch = prepareSketch(testFeatures.outsideTerritorialSea);
    const result = await clipToGeography(
      preparedSketch,
      hawaiiTerritorialSea,
      clippingFn
    );

    expect(result).toBeNull();
  });

  it("should return null when sketch is outside EEZ", async () => {
    const preparedSketch = prepareSketch(testFeatures.outsideEez);
    const result = await clipToGeography(
      preparedSketch,
      hawaiiOffshore,
      clippingFn
    );

    expect(result).toBeNull();
  });

  it("should throw error when no INTERSECT layers are provided", async () => {
    const preparedSketch = prepareSketch(testFeatures.insideTerritorialSea);

    await expect(
      clipToGeography(
        preparedSketch,
        [
          {
            source: territorialSeaUrl,
            op: "DIFFERENCE",
          },
        ],
        clippingFn
      )
    ).rejects.toThrow("At least one INTERSECT layer is required");
  });
});
