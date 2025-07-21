import { Feature, MultiPolygon, Polygon } from "geojson";
import {
  ClippingFn,
  ClippingLayerOption,
  clipSketchToPolygons,
} from "../src/geographies";
import { SourceCache } from "fgb-source";
import { prepareSketch } from "../src/utils/prepareSketch";
import {
  createFragments,
  eliminateOverlap,
  FragmentResult,
  GeographySettings,
  mergeTouchingFragments,
  PendingFragmentResult,
} from "../src/fragments";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  caPescaderoFeature,
  fijiShape2,
  fijiSketchAntimeridianCrossing,
  fsmTestFeatures,
} from "./test-features";
import { readOutput, compareFragments, saveOutput } from "./test-helpers";

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

// set test timeout to 10 seconds
vi.setConfig({ testTimeout: 10000 });

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

  test("Fiji test with 3 fragments", async () => {
    const preparedSketch = prepareSketch(fijiShape2);
    // saveOutput("fiji-shape2-prepared", preparedSketch.feature);
    const fragments = await createFragments(
      preparedSketch,
      fijiGeographies,
      clippingFn
    );
    // saveOutput("fiji-shape2-fragments", fragments);
    expect(fragments).toHaveLength(3);
  });
});

const fsmGeographies: GeographySettings[] = [
  {
    id: 1,
    clippingLayers: [
      {
        source: "https://uploads.seasketch.org/fsm-state-waters.fgb",
        op: "INTERSECT",
        cql2Query: { op: "=", args: [{ property: "NAME" }, "Kosrae"] },
      },
      {
        source: "https://uploads.seasketch.org/land-big-2.fgb",
        op: "DIFFERENCE",
      },
    ],
  },
  {
    id: 2,
    clippingLayers: [
      {
        source: "https://uploads.seasketch.org/fsm-state-waters.fgb",
        op: "INTERSECT",
        cql2Query: { op: "=", args: [{ property: "NAME" }, "Pohnpei"] },
      },
      {
        source: "https://uploads.seasketch.org/land-big-2.fgb",
        op: "DIFFERENCE",
      },
    ],
  },
  {
    id: 3,
    clippingLayers: [
      {
        source: "https://uploads.seasketch.org/fsm-state-waters.fgb",
        op: "INTERSECT",
        cql2Query: { op: "=", args: [{ property: "NAME" }, "Chuuk"] },
      },
      {
        source: "https://uploads.seasketch.org/land-big-2.fgb",
        op: "DIFFERENCE",
      },
    ],
  },
  {
    id: 4,
    clippingLayers: [
      {
        source: "https://uploads.seasketch.org/fsm-state-waters.fgb",
        op: "INTERSECT",
        cql2Query: { op: "=", args: [{ property: "NAME" }, "Yap"] },
      },
      {
        source: "https://uploads.seasketch.org/land-big-2.fgb",
        op: "DIFFERENCE",
      },
    ],
  },
];

describe("FSM test features", () => {
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

  it("Clipping to Kosrae geography", async () => {
    const preparedSketch = prepareSketch(
      fsmTestFeatures.features.find((f) => f.properties.name === "Kosrae")!
    );
    const fragments = await createFragments(
      preparedSketch,
      fsmGeographies,
      clippingFn
    );
    // saveOutput("fsm-kosrae-fragments", fragments);
    expect(fragments).toHaveLength(1);
    expect(fragments[0].properties.__geographyIds).toHaveLength(1);
    expect(fragments[0].properties.__geographyIds).toContain(1);
    expect(fragments[0].geometry.type).toBe("Polygon");
    expect(
      compareFragments(fragments, readOutput("fsm-kosrae-fragments"))
    ).toBe(true);
  });

  it("Clipping to Pohnpei geography", async () => {
    const preparedSketch = prepareSketch(
      fsmTestFeatures.features.find((f) => f.properties.name === "Pohnpei")!
    );
    const fragments = await createFragments(
      preparedSketch,
      fsmGeographies,
      clippingFn
    );
    // saveOutput("fsm-pohnpei-fragments", fragments);
    expect(fragments).toHaveLength(1);
    expect(fragments[0].properties.__geographyIds).toHaveLength(1);
    expect(fragments[0].properties.__geographyIds).toContain(2);
    expect(fragments[0].geometry.type).toBe("Polygon");
    expect(
      compareFragments(fragments, readOutput("fsm-pohnpei-fragments"))
    ).toBe(true);
  });

  it("Clipping to Chuuk geography", async () => {
    const preparedSketch = prepareSketch(
      fsmTestFeatures.features.find((f) => f.properties.name === "Chuuk")!
    );
    const fragments = await createFragments(
      preparedSketch,
      fsmGeographies,
      clippingFn
    );
    // saveOutput("fsm-chuuk-fragments", fragments);
    expect(fragments).toHaveLength(1);
    expect(fragments[0].properties.__geographyIds).toHaveLength(1);
    expect(fragments[0].properties.__geographyIds).toContain(3);
    expect(fragments[0].geometry.type).toBe("Polygon");
    expect(compareFragments(fragments, readOutput("fsm-chuuk-fragments"))).toBe(
      true
    );
  });
});

const caGeographies: GeographySettings[] = [
  // state waters
  {
    id: 1,
    clippingLayers: [
      {
        source: "https://uploads.seasketch.org/ca-study-regions.fgb",
        op: "INTERSECT",
      },
    ],
  },
  // study regions
  // Central Coast
  {
    id: 2,
    clippingLayers: [
      {
        source: "https://uploads.seasketch.org/ca-study-regions.fgb",
        op: "INTERSECT",
        cql2Query: { op: "=", args: [{ property: "NAME" }, "Central Coast"] },
      },
    ],
  },
  // North Central Coast
  {
    id: 3,
    clippingLayers: [
      {
        source: "https://uploads.seasketch.org/ca-study-regions.fgb",
        op: "INTERSECT",
        cql2Query: {
          op: "=",
          args: [{ property: "NAME" }, "North Central Coast"],
        },
      },
    ],
  },
  // North Coast
  {
    id: 4,
    clippingLayers: [
      {
        source: "https://uploads.seasketch.org/ca-study-regions.fgb",
        op: "INTERSECT",
        cql2Query: { op: "=", args: [{ property: "NAME" }, "North Coast"] },
      },
    ],
  },
  // San Francisco Bay
  {
    id: 5,
    clippingLayers: [
      {
        source: "https://uploads.seasketch.org/ca-study-regions.fgb",
        op: "INTERSECT",
        cql2Query: {
          op: "=",
          args: [{ property: "NAME" }, "San Francisco Bay"],
        },
      },
    ],
  },
  // South Coast
  {
    id: 6,
    clippingLayers: [
      {
        source: "https://uploads.seasketch.org/ca-study-regions.fgb",
        op: "INTERSECT",
        cql2Query: { op: "=", args: [{ property: "NAME" }, "South Coast"] },
      },
    ],
  },
  // Bioregions
  // Central Coast
  {
    id: 7,
    clippingLayers: [
      {
        source: "https://uploads.seasketch.org/ca-bioregions.fgb",
        op: "INTERSECT",
        cql2Query: { op: "=", args: [{ property: "NAME" }, "Central Coast"] },
      },
    ],
  },
  // North Coast
  {
    id: 8,
    clippingLayers: [
      {
        source: "https://uploads.seasketch.org/ca-bioregions.fgb",
        op: "INTERSECT",
        cql2Query: { op: "=", args: [{ property: "NAME" }, "North Coast"] },
      },
    ],
  },
  // South Coast
  {
    id: 9,
    clippingLayers: [
      {
        source: "https://uploads.seasketch.org/ca-bioregions.fgb",
        op: "INTERSECT",
        cql2Query: { op: "=", args: [{ property: "NAME" }, "South Coast"] },
      },
    ],
  },
];

describe("CA use case", () => {
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

  it("Clipping to Pescadero geography", async () => {
    const preparedSketch = prepareSketch(caPescaderoFeature);
    const fragments = await createFragments(
      preparedSketch,
      caGeographies,
      clippingFn
    );
    // saveOutput("ca-pescadero-fragments", fragments);
    expect(fragments).toHaveLength(2);
    expect(
      compareFragments(fragments, readOutput("ca-pescadero-fragments"))
    ).toBe(true);

    // Expect one polygon's geographyIds to be associated with the North Central Coast Study Region, and Central Coast Bioregion. Could be the first or second polygon, so will need to find the one that has the correct geographyIds
    const northCentralCoastStudyRegion = fragments.find((f) =>
      f.properties.__geographyIds.includes(3)
    );
    expect(northCentralCoastStudyRegion).toBeDefined();
    expect(
      northCentralCoastStudyRegion?.properties.__geographyIds
    ).toHaveLength(3);
    expect(northCentralCoastStudyRegion?.properties.__geographyIds).toContain(
      3
    );
    expect(northCentralCoastStudyRegion?.properties.__geographyIds).toContain(
      7
    );
    // The other polygon should be associated with the Central Coast Study Region, Central Coast Bioregion, and State Waters
    const centralCoastStudyRegion = fragments.find((f) =>
      f.properties.__geographyIds.includes(2)
    );
    expect(centralCoastStudyRegion).toBeDefined();
    expect(centralCoastStudyRegion?.properties.__geographyIds).toHaveLength(3);
    expect(centralCoastStudyRegion?.properties.__geographyIds).toContain(2);
    expect(centralCoastStudyRegion?.properties.__geographyIds).toContain(7);
  });
});

describe("eliminateOverlap", () => {
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

  it("Merging fragments with an existing collection", async () => {
    const fijiAntimeridianFragments = readOutput("fiji-antimeridian-fragments");
    expect(fijiAntimeridianFragments).toHaveLength(4);
    const preparedSketch = prepareSketch(fijiShape2);
    // saveOutput("fiji-shape2-prepared", preparedSketch.feature);
    const fragments = await createFragments(
      preparedSketch,
      fijiGeographies,
      clippingFn
    );
    // saveOutput("fiji-shape2-fragments", fragments);
    expect(fragments).toHaveLength(3);
    // now, merge the fragments with the existing fragments
    const sketchFragments = fragments.map((f) => ({
      ...f,
      properties: {
        ...f.properties,
        __sketchIds: [1],
      },
      geometry: f.geometry,
    }));
    const existingFragments = (
      fijiAntimeridianFragments as FragmentResult[]
    ).map((f) => ({
      ...f,
      properties: {
        ...f.properties,
        __sketchIds: [2],
      },
      geometry: f.geometry,
    }));
    const merged = eliminateOverlap(sketchFragments, existingFragments);
    // saveOutput("fiji-shape2-merged", merged);
    expect(merged).toHaveLength(10);
    expect(compareFragments(merged, readOutput("fiji-shape2-merged"))).toBe(
      true
    );
  });
});

describe("mergeTouchingFragments", () => {
  const testData = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          name: "touching-fragment-a",
        },
        geometry: {
          coordinates: [
            [
              [-120.05028595862674, 34.36809509937177],
              [-120.05028595862674, 34.320942318694875],
              [-119.96494301397664, 34.320942318694875],
              [-119.96494301397664, 34.36809509937177],
              [-120.05028595862674, 34.36809509937177],
            ],
          ],
          type: "Polygon",
        },
        id: 0,
      },
      {
        type: "Feature",
        properties: {
          name: "touching-fragment-b",
        },
        geometry: {
          coordinates: [
            [
              [-119.86227480988632, 34.37021370276432],
              [-119.86484151498871, 34.319882380980175],
              [-119.96494301397664, 34.320942318694875],
              [-119.96494301397664, 34.36809509937177],
              [-119.86227480988632, 34.37021370276432],
            ],
          ],
          type: "Polygon",
        },
        id: 1,
      },
      {
        type: "Feature",
        properties: {
          name: "discontiguous-fragment",
        },
        geometry: {
          coordinates: [
            [
              [-119.8186408231478, 34.28489761098619],
              [-119.8186408231478, 34.224435023962485],
              [-119.68517215783048, 34.224435023962485],
              [-119.68517215783048, 34.28489761098619],
              [-119.8186408231478, 34.28489761098619],
            ],
          ],
          type: "Polygon",
        },
        id: 2,
      },
    ],
  };

  it("Touching fragments with the same key properties (__sketchIds, __geographyIds) are merged", () => {
    // Create fragments with the same key properties that are touching
    const fragments: PendingFragmentResult[] = [
      {
        type: "Feature",
        properties: {
          __id: 1,
          __sketchIds: [1, 2],
          __geographyIds: [1, 2],
          name: "touching-fragment-a",
        },
        geometry: testData.features[0].geometry as Polygon,
        bbox: [
          -120.05028595862674, 34.320942318694875, -119.96494301397664,
          34.36809509937177,
        ],
      },
      {
        type: "Feature",
        properties: {
          __id: 2,
          __sketchIds: [1, 2],
          __geographyIds: [1, 2],
          name: "touching-fragment-b",
        },
        geometry: testData.features[1].geometry as Polygon,
        bbox: [
          -119.86227480988632, 34.319882380980175, -119.96494301397664,
          34.37021370276432,
        ],
      },
    ];

    const result = mergeTouchingFragments(fragments, [
      "__sketchIds",
      "__geographyIds",
    ]);

    // Should merge into a single fragment
    expect(result).toHaveLength(1);
    expect(result[0].properties.__sketchIds).toEqual([1, 2]);
    expect(result[0].properties.__geographyIds).toEqual([1, 2]);
    expect(result[0].properties.__id).toBeDefined();
  });

  it("Touching fragments with different key properties (__sketchIds, __geographyIds) are not merged", () => {
    // Create fragments with different key properties that are touching
    const fragments: PendingFragmentResult[] = [
      {
        type: "Feature",
        properties: {
          __id: 1,
          __sketchIds: [1],
          __geographyIds: [1],
          name: "touching-fragment-a",
        },
        geometry: testData.features[0].geometry as Polygon,
        bbox: [
          -120.05028595862674, 34.320942318694875, -119.96494301397664,
          34.36809509937177,
        ],
      },
      {
        type: "Feature",
        properties: {
          __id: 2,
          __sketchIds: [2],
          __geographyIds: [2],
          name: "touching-fragment-b",
        },
        geometry: testData.features[1].geometry as Polygon,
        bbox: [
          -119.86227480988632, 34.319882380980175, -119.96494301397664,
          34.37021370276432,
        ],
      },
    ];

    const result = mergeTouchingFragments(fragments, [
      "__sketchIds",
      "__geographyIds",
    ]);

    // Should not merge - keep as separate fragments
    expect(result).toHaveLength(2);
    expect(result[0].properties.__sketchIds).toEqual([1]);
    expect(result[0].properties.__geographyIds).toEqual([1]);
    expect(result[1].properties.__sketchIds).toEqual([2]);
    expect(result[1].properties.__geographyIds).toEqual([2]);
  });

  it("Discontiguous fragments with the same key properties are not merged", () => {
    // Create fragments with the same key properties that are not touching
    const fragments: PendingFragmentResult[] = [
      {
        type: "Feature",
        properties: {
          __id: 1,
          __sketchIds: [1, 2],
          __geographyIds: [1, 2],
          name: "touching-fragment-a",
        },
        geometry: testData.features[0].geometry as Polygon,
        bbox: [
          -120.05028595862674, 34.320942318694875, -119.96494301397664,
          34.36809509937177,
        ],
      },
      {
        type: "Feature",
        properties: {
          __id: 2,
          __sketchIds: [1, 2],
          __geographyIds: [1, 2],
          name: "discontiguous-fragment",
        },
        geometry: testData.features[2].geometry as Polygon,
        bbox: [
          -119.8186408231478, 34.224435023962485, -119.68517215783048,
          34.28489761098619,
        ],
      },
    ];

    const result = mergeTouchingFragments(fragments, [
      "__sketchIds",
      "__geographyIds",
    ]);

    // Should not merge - keep as separate fragments
    expect(result).toHaveLength(2);
    expect(result[0].properties.__sketchIds).toEqual([1, 2]);
    expect(result[0].properties.__geographyIds).toEqual([1, 2]);
    expect(result[1].properties.__sketchIds).toEqual([1, 2]);
    expect(result[1].properties.__geographyIds).toEqual([1, 2]);
  });

  it("Handles property arrays with different orders correctly", () => {
    // Create fragments with the same key properties but in different orders
    const fragments: PendingFragmentResult[] = [
      {
        type: "Feature",
        properties: {
          __id: 1,
          __sketchIds: [1, 2],
          __geographyIds: [1, 2],
          name: "touching-fragment-a",
        },
        geometry: testData.features[0].geometry as Polygon,
        bbox: [
          -120.05028595862674, 34.320942318694875, -119.96494301397664,
          34.36809509937177,
        ],
      },
      {
        type: "Feature",
        properties: {
          __id: 2,
          __sketchIds: [2, 1], // Different order
          __geographyIds: [2, 1], // Different order
          name: "touching-fragment-b",
        },
        geometry: testData.features[1].geometry as Polygon,
        bbox: [
          -119.86227480988632, 34.319882380980175, -119.96494301397664,
          34.37021370276432,
        ],
      },
    ];

    const result = mergeTouchingFragments(fragments, [
      "__sketchIds",
      "__geographyIds",
    ]);

    // Should merge into a single fragment despite different order
    expect(result).toHaveLength(1);
    expect(result[0].properties.__sketchIds).toEqual([1, 2]);
    expect(result[0].properties.__geographyIds).toEqual([1, 2]);
  });

  test("Handles multiple touching fragments by processing in multiple passes", async () => {
    const fragments: PendingFragmentResult[] = [
      {
        type: "Feature",
        properties: { __geographyIds: [1], __id: 14, __sketchIds: [0, 2] },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-119.960591849, 34.266456205],
              [-119.9466350850291, 34.266456205],
              [-119.9466350850291, 34.30900063176291],
              [-119.960591849, 34.30900063176291],
              [-119.960591849, 34.266456205],
            ],
          ],
        },
        bbox: [
          -120.08289575431301, 34.22710427841557, -119.9466350850291,
          34.30900063176291,
        ],
      },
      {
        type: "Feature",
        properties: { __geographyIds: [1], __id: 17, __sketchIds: [0, 2] },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-120.072084965, 34.234404154],
              [-119.9466350850291, 34.234404154],
              [-119.9466350850291, 34.266456205],
              [-119.960591849, 34.266456205],
              [-119.960591849, 34.30900063176291],
              [-120.05458506, 34.30900063176291],
              [-120.05458506, 34.261512874],
              [-120.072084965, 34.261512874],
              [-120.072084965, 34.234404154],
            ],
          ],
        },
        bbox: [
          -120.08289575431301, 34.22710427841557, -119.9466350850291,
          34.30900063176291,
        ],
      },
      {
        type: "Feature",
        properties: { __geographyIds: [1], __id: 21, __sketchIds: [0, 2] },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-120.072084965, 34.261512874],
              [-120.05458506, 34.261512874],
              [-120.05458506, 34.30900063176291],
              [-120.072084965, 34.30900063176291],
              [-120.072084965, 34.261512874],
            ],
          ],
        },
        bbox: [
          -120.08289575431301, 34.22710427841557, -119.9466350850291,
          34.30900063176291,
        ],
      },
      {
        type: "Feature",
        properties: { __geographyIds: [1], __id: 22, __sketchIds: [0] },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-120.08289575431301, 34.22710427841557],
              [-119.9466350850291, 34.22710427841557],
              [-119.9466350850291, 34.234404154],
              [-120.072084965, 34.234404154],
              [-120.072084965, 34.30900063176291],
              [-120.08289575431301, 34.30900063176291],
              [-120.08289575431301, 34.22710427841557],
            ],
          ],
        },
        bbox: [
          -120.08289575431301, 34.22710427841557, -119.9466350850291,
          34.30900063176291,
        ],
      },
      {
        type: "Feature",
        properties: {
          __hash: "a4f3d6468b81755afea17504b628def8",
          __geographyIds: [1],
          __sketchIds: [2],
          __id: 23,
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-120.072084965, 34.30900063176291],
              [-120.05458506, 34.30900063176291],
              [-120.05458506, 34.312782287],
              [-120.072084965, 34.312782287],
              [-120.072084965, 34.30900063176291],
            ],
          ],
        },
        bbox: [-120.072084965, 34.261512874, -120.05458506, 34.312782287],
      },
      {
        type: "Feature",
        properties: {
          __hash: "5d17be330ce24a26ce8198039ec60427",
          __geographyIds: [1],
          __sketchIds: [2],
          __id: 19,
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-120.05458506, 34.30900063176291],
              [-119.960591849, 34.30900063176291],
              [-119.960591849, 34.312782287],
              [-120.05458506, 34.312782287],
              [-120.05458506, 34.30900063176291],
            ],
          ],
        },
        bbox: [-120.072084965, 34.234404154, -119.941348954, 34.312782287],
      },
      {
        type: "Feature",
        properties: {
          __hash: "5d17be330ce24a26ce8198039ec60427",
          __geographyIds: [1],
          __sketchIds: [2],
          __id: 20,
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-119.9466350850291, 34.234404154],
              [-119.941348954, 34.234404154],
              [-119.941348954, 34.266456205],
              [-119.9466350850291, 34.266456205],
              [-119.9466350850291, 34.234404154],
            ],
          ],
        },
        bbox: [-120.072084965, 34.234404154, -119.941348954, 34.312782287],
      },
      {
        type: "Feature",
        properties: {
          __hash: "99e3e024ce2ee081cb42cece99547ab6",
          __geographyIds: [1],
          __sketchIds: [2],
          __id: 16,
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-119.960591849, 34.30900063176291],
              [-119.9466350850291, 34.30900063176291],
              [-119.9466350850291, 34.266456205],
              [-119.941348954, 34.266456205],
              [-119.941348954, 34.312782287],
              [-119.960591849, 34.312782287],
              [-119.960591849, 34.30900063176291],
            ],
          ],
        },
        bbox: [-119.960591849, 34.266456205, -119.941348954, 34.312782287],
      },
    ];

    const result = mergeTouchingFragments(fragments, [
      "__sketchIds",
      "__geographyIds",
    ]);

    expect(result).toHaveLength(3);
  });
});
