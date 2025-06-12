import { Feature, MultiPolygon, Polygon } from "geojson";
import {
  ClippingFn,
  ClippingLayerOption,
  clipSketchToPolygons,
} from "../src/geographies";
import { SourceCache } from "fgb-source";
import { prepareSketch } from "../src/utils/prepareSketch";
import { createFragments, GeographySettings } from "../src/fragments";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { fijiSketchAntimeridianCrossing } from "./test-features";
import {
  saveOutput,
  readOutput,
  compareFragments,
  normalizeGeometry,
} from "./test-helpers";

const eezUrl = "https://uploads.seasketch.org/eez-land-joined.fgb";
const territorialSeaUrl =
  "https://uploads.seasketch.org/territorial-sea-land-joined.fgb";

// Geography configurations
const fijiGeographies: GeographySettings[] = [
  // EEZ
  {
    id: 1,
    clippingLayers: [
      {
        source: eezUrl,
        op: "INTERSECT",
        cql2Query: { op: "=", args: [{ property: "UNION" }, "Fiji"] },
      },
    ],
  },
  // Offshore
  {
    id: 2,
    clippingLayers: [
      {
        source: eezUrl,
        op: "INTERSECT",
        cql2Query: { op: "=", args: [{ property: "UNION" }, "Fiji"] },
      },
      {
        source: territorialSeaUrl,
        op: "DIFFERENCE",
        cql2Query: { op: "=", args: [{ property: "UNION" }, "Fiji"] },
      },
    ],
  },
  // Nearshore
  {
    id: 3,
    clippingLayers: [
      {
        source: territorialSeaUrl,
        op: "INTERSECT",
        cql2Query: { op: "=", args: [{ property: "UNION" }, "Fiji"] },
      },
      {
        source: eezUrl,
        op: "DIFFERENCE",
      },
    ],
  },
];

describe("createFragments", () => {
  let sourceCache: SourceCache;
  let clippingFn: ClippingFn;

  beforeAll(() => {
    sourceCache = new SourceCache("256mb");
    clippingFn = async (sketch, source, op, query) => {
      const fgbSource = await sourceCache.get<Feature<MultiPolygon | Polygon>>(
        source
      );
      const overlappingFeatures = fgbSource.getFeaturesAsync(sketch.envelopes);
      return clipSketchToPolygons(sketch, op, query, overlappingFeatures);
    };
  });

  // In this scenario, the sketch spans both offshore and nearshore geographies,
  // the EEZ geography (which covers both offshore and nearshore), and it is
  // split down the antimeridian.
  //
  // The result should be 4 fragments:
  // - 2 fragments associated with both EEZ and Offshore
  // - 2 fragments associated with both EEZ and Nearshore
  it("should create fragments for Fiji sketch crossing antimeridian", async () => {
    const preparedSketch = prepareSketch(fijiSketchAntimeridianCrossing);
    const fragments = await createFragments(
      preparedSketch,
      fijiGeographies,
      clippingFn
    );

    // Uncomment to save new reference output
    // saveOutput("fiji-antimeridian-fragments", fragments);

    // Load reference output and compare geometries
    const referenceFragments = readOutput("fiji-antimeridian-fragments");

    expect(compareFragments(fragments, referenceFragments)).toBe(true);

    // Should create 4 fragments total
    expect(fragments).toHaveLength(4);

    // Two fragments should be associated with both EEZ and Offshore
    const eezOffshoreFragments = fragments.filter(
      (f) =>
        f.properties.__geographyIds.includes(1) &&
        f.properties.__geographyIds.includes(2)
    );
    expect(eezOffshoreFragments).toHaveLength(2);

    // Two fragments should be associated with both EEZ and Nearshore
    const eezNearshoreFragments = fragments.filter(
      (f) =>
        f.properties.__geographyIds.includes(1) &&
        f.properties.__geographyIds.includes(3)
    );
    expect(eezNearshoreFragments).toHaveLength(2);

    // Each fragment should be a valid polygon
    fragments.forEach((fragment) => {
      expect(fragment.geometry.type).toBe("Polygon");
      expect(fragment.properties.__geographyIds).toBeDefined();
      expect(Array.isArray(fragment.properties.__geographyIds)).toBe(true);
    });
  });
});
