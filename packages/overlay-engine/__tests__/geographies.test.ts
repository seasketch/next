import { Feature, MultiPolygon, Polygon } from "geojson";
import {
  clipToGeography,
  clipSketchToPolygons,
  ClippingFn,
  ClippingLayerOption,
  clipToGeographies,
} from "../src/geographies";
import { SourceCache } from "fgb-source";
import { prepareSketch } from "../src/utils/prepareSketch";
import { describe, it, expect, beforeAll } from "vitest";
import { hawaiiTestFeatures } from "./test-features";
import { GeographySettings, SketchFragment } from "../src/fragments";
import { saveOutput, readOutput, compareFragments } from "./test-helpers";
import { eezUrl, landUrl, territorialSeaUrl } from "./constants";

// Geography configurations
const hawaiiTerritorialSea: ClippingLayerOption[] = [
  {
    source: territorialSeaUrl,
    op: "INTERSECT",
    cql2Query: { op: "=", args: [{ property: "UNION" }, "Hawaii"] },
  },
  {
    source: landUrl,
    op: "DIFFERENCE",
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

const hawaiiEEZ: ClippingLayerOption[] = [
  {
    source: eezUrl,
    op: "INTERSECT",
    cql2Query: { op: "=", args: [{ property: "UNION" }, "Hawaii"] },
  },
];

const hawaiiGeographies: GeographySettings[] = [
  // EEZ
  {
    id: 1,
    clippingLayers: hawaiiEEZ,
  },
  // Nearshore
  {
    id: 2,
    clippingLayers: hawaiiTerritorialSea,
  },
  // Offshore
  {
    id: 3,
    clippingLayers: hawaiiOffshore,
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

describe("clipToGeographies", () => {
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

  it("should clip to Hawaii Territorial Sea and generate fragments for both territorial sea and EEZ", async () => {
    const preparedSketch = prepareSketch(
      hawaiiTestFeatures.clipToTerritorialSea
    );

    // Use the Hawaii geographies configuration
    const geographies = hawaiiGeographies;

    // Clip to territorial sea (geography ID 2)
    const geographiesForClipping = [2];

    // No existing fragments
    const existingSketchFragments: SketchFragment[] = [];

    const result = await clipToGeographies(
      preparedSketch,
      geographies,
      geographiesForClipping,
      existingSketchFragments,
      null,
      clippingFn
    );

    // Save the fragments for debugging
    // saveOutput("hawaii-territorial-sea-fragments", result.fragments);
    // saveOutput("hawaii-territorial-sea-clipped", result.clipped);

    // Verify that we got a clipped result
    expect(result.clipped).not.toBeNull();
    expect(result.clipped?.geometry.type).toBe("MultiPolygon");

    // Verify that fragments were generated
    expect(result.fragments.length).toBe(1);
    const fragment = result.fragments[0];
    expect(fragment.properties.__geographyIds).toEqual([1, 2]);
    expect(fragment.properties.__sketchIds).toEqual([0]);
    expect(fragment.geometry.type).toBe("Polygon");

    // Compare with reference output
    const referenceFragments = readOutput("hawaii-territorial-sea-fragments");
    expect(compareFragments(result.fragments, referenceFragments)).toBe(true);
  });

  it("should pick the largest overlap and generate fragments for that geography", async () => {
    const preparedSketch = prepareSketch(
      hawaiiTestFeatures.clipToTerritorialSea
    );

    // Clip to territorial sea (geography ID 2)
    const geographiesForClipping = [2, 3];

    // No existing fragments
    const existingSketchFragments: SketchFragment[] = [];

    const result = await clipToGeographies(
      preparedSketch,
      hawaiiGeographies,
      geographiesForClipping,
      existingSketchFragments,
      null,
      clippingFn
    );

    // Verify that we got a clipped result
    expect(result.clipped).not.toBeNull();
    expect(result.clipped?.geometry.type).toBe("MultiPolygon");

    // Verify that fragments were generated
    expect(result.fragments.length).toBe(1);
    const fragment = result.fragments[0];
    expect(fragment.properties.__geographyIds).toEqual([1, 2]);
    expect(fragment.properties.__sketchIds).toEqual([0]);
    expect(fragment.geometry.type).toBe("Polygon");
  });

  it("Should generate multiple fragments for overlapping, non-clipping geographies", async () => {
    const preparedSketch = prepareSketch(
      hawaiiTestFeatures.clipToTerritorialSea
    );

    // Just clip to the EEZ. Don't even exclude land. This means there will be
    // 3 fragments, offshore, territorial sea, and the bit of land that still
    // falls within the "EEZ"
    const geographiesForClipping = [1];

    const result = await clipToGeographies(
      preparedSketch,
      hawaiiGeographies,
      geographiesForClipping,
      [],
      null,
      clippingFn
    );

    // saveOutput("hawaii-eez-fragments", result.fragments);
    // saveOutput("hawaii-eez-clipped", result.clipped);

    expect(result.fragments.length).toBe(3);

    const territorialSeaFragment = result.fragments.find((f) =>
      f.properties.__geographyIds.includes(2)
    );
    expect(territorialSeaFragment).not.toBeNull();
    expect(territorialSeaFragment?.geometry.type).toBe("Polygon");
    expect(territorialSeaFragment?.properties.__geographyIds).toEqual([1, 2]);

    const offshoreFragment = result.fragments.find((f) =>
      f.properties.__geographyIds.includes(3)
    );
    expect(offshoreFragment).not.toBeNull();
    expect(offshoreFragment?.geometry.type).toBe("Polygon");
    expect(offshoreFragment?.properties.__geographyIds).toEqual([1, 3]);

    const landFragment = result.fragments.find(
      (f) =>
        f.properties.__geographyIds.includes(1) &&
        f.properties.__geographyIds.length === 1
    );
    expect(landFragment).not.toBeNull();
    expect(landFragment?.geometry.type).toBe("Polygon");
    expect(landFragment?.properties.__geographyIds).toEqual([1]);

    // Compare with reference output
    const referenceFragments = readOutput("hawaii-eez-fragments");
    expect(compareFragments(result.fragments, referenceFragments)).toBe(true);
  });

  it("Should generate new fragments for overlapping sketches in the same collection", async () => {
    const existingSketch = prepareSketch(hawaiiTestFeatures.overlappingSketch);

    // Clip to territorial sea (geography ID 2)
    const geographiesForClipping = [2];

    const { fragments: existingSketchFragments, clipped: existingClipped } =
      await clipToGeographies(
        existingSketch,
        hawaiiGeographies,
        geographiesForClipping,
        [],
        null,
        clippingFn
      );

    const preparedSketch = prepareSketch(
      hawaiiTestFeatures.clipToTerritorialSea
    );

    const result = await clipToGeographies(
      preparedSketch,
      hawaiiGeographies,
      geographiesForClipping,
      existingSketchFragments.map((f) => ({
        ...f,
        properties: {
          ...f.properties,
          __sketchIds: [1],
        },
      })),
      1,
      clippingFn
    );

    // Save the fragments for debugging
    // saveOutput("overlapping-sketches-fragments", result.fragments);
    // saveOutput("overlapping-sketches-clipped", result.clipped);

    // Verify that we got a clipped result
    expect(result.clipped).not.toBeNull();
    expect(result.clipped?.geometry.type).toBe("MultiPolygon");

    // Verify that each fragment was generated
    expect(result.fragments.length).toBe(3);

    // Verify that the existing sketch fragment was generated
    const existingSketchFragment = result.fragments.find(
      (f) =>
        f.properties.__sketchIds.includes(1) &&
        f.properties.__sketchIds.length === 1
    );
    expect(existingSketchFragment).not.toBeNull();
    expect(existingSketchFragment?.properties.__geographyIds).toEqual([1, 2]);

    // Verify that the new sketch fragment was generated
    const newSketchFragment = result.fragments.find(
      (f) =>
        f.properties.__sketchIds.includes(0) &&
        f.properties.__sketchIds.length === 1
    );
    expect(newSketchFragment).not.toBeNull();
    expect(newSketchFragment?.properties.__geographyIds).toEqual([1, 2]);

    // Verify that the area of overlap has a fragment
    const overlapFragment = result.fragments.find(
      (f) =>
        f.properties.__sketchIds.includes(0) &&
        f.properties.__sketchIds.includes(1) &&
        f.properties.__sketchIds.length === 2
    );
    expect(overlapFragment).not.toBeNull();
    expect(overlapFragment?.properties.__geographyIds).toEqual([1, 2]);

    // Compare with reference output
    const referenceFragments = readOutput("overlapping-sketches-fragments");
    expect(compareFragments(result.fragments, referenceFragments)).toBe(true);

    const referenceClipped = readOutput("overlapping-sketches-clipped");
    expect(result.clipped).toEqual(referenceClipped[0]);
  });
});
