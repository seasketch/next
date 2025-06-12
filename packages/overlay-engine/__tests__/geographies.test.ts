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
import { hawaiiTestFeatures } from "./test-features";

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
      return clipSketchToPolygons(
        sketch,
        op,
        query,
        fgbSource.getFeaturesAsync(sketch.envelopes)
      );
    };
  });

  it("should clip to nearshore geography (territorial sea)", async () => {
    const preparedSketch = prepareSketch(
      hawaiiTestFeatures.clipToTerritorialSea
    );
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
    const preparedSketch = prepareSketch(hawaiiTestFeatures.clipToEez);
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
    const preparedSketch = prepareSketch(
      hawaiiTestFeatures.outsideTerritorialSea
    );
    const result = await clipToGeography(
      preparedSketch,
      hawaiiTerritorialSea,
      clippingFn
    );

    expect(result).toBeNull();
  });

  it("should return null when sketch is outside EEZ", async () => {
    const preparedSketch = prepareSketch(hawaiiTestFeatures.outsideEez);
    const result = await clipToGeography(
      preparedSketch,
      hawaiiOffshore,
      clippingFn
    );

    expect(result).toBeNull();
  });

  it("should throw error when no INTERSECT layers are provided", async () => {
    const preparedSketch = prepareSketch(
      hawaiiTestFeatures.insideTerritorialSea
    );

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
