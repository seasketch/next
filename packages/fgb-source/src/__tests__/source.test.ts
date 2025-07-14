/// <reference types="vitest" />
import { createSource, FlatGeobufSource } from "../source";
import { Feature, GeoJsonProperties } from "geojson";
// Vitest provides describe, it, expect, beforeAll globally

const TEST_URL = "https://flatgeobuf.org/test/data/UScounties.fgb";

let source: FlatGeobufSource;

beforeAll(async () => {
  source = await createSource(TEST_URL);
});

describe("Initialization", async () => {
  it("should initialize the source", async () => {
    expect(source).toBeDefined();
    expect(source.bounds.maxX).toBeGreaterThan(0);
  });

  it("should use a custom range fetching function when provided", async () => {
    let fetchCalled = false;
    const customFetchRangeFn = (
      key: string,
      range: [number, number | null]
    ) => {
      fetchCalled = true;
      return fetch(TEST_URL, {
        headers: { Range: `bytes=${range[0]}-${range[1] ? range[1] : ""}` },
      }).then((response) => response.arrayBuffer());
    };

    const customSource = await createSource(TEST_URL, {
      fetchRangeFn: customFetchRangeFn,
    });
    const bbox = {
      minX: -124.5,
      minY: 32.5,
      maxX: -114.1,
      maxY: 42.0,
    };

    const features: Feature[] = [];
    for await (const feature of customSource.getFeaturesAsync(bbox)) {
      features.push(feature);
    }

    expect(fetchCalled).toBe(true);
    expect(features.length).toBeGreaterThan(0);
  });

  it("should accept string-based byte sizes for options", async () => {
    let fetchCount = 0;
    const customFetchRangeFn = (
      key: string,
      range: [number, number | null]
    ) => {
      fetchCount++;
      return fetch(TEST_URL, {
        headers: { Range: `bytes=${range[0]}-${range[1] ? range[1] : ""}` },
      }).then((response) => response.arrayBuffer());
    };

    const customSource = await createSource(TEST_URL, {
      fetchRangeFn: customFetchRangeFn,
      initialHeaderRequestLength: "5MB",
      overfetchBytes: "5MB",
    });
    const bbox = {
      minX: -124.5,
      minY: 32.5,
      maxX: -114.1,
      maxY: 42.0,
    };

    const features: Feature[] = [];
    for await (const feature of customSource.getFeaturesAsync(bbox)) {
      features.push(feature);
    }

    expect(fetchCount).toBe(2);
    expect(features.length).toBeGreaterThan(0);
  });

  it("should accept mixed number and string byte sizes", async () => {
    let fetchCount = 0;
    const customFetchRangeFn = (
      key: string,
      range: [number, number | null]
    ) => {
      fetchCount++;
      return fetch(TEST_URL, {
        headers: { Range: `bytes=${range[0]}-${range[1] ? range[1] : ""}` },
      }).then((response) => response.arrayBuffer());
    };

    const customSource = await createSource(TEST_URL, {
      fetchRangeFn: customFetchRangeFn,
      initialHeaderRequestLength: 5 * 1024 * 1024, // 5MB as number
      overfetchBytes: "5MB", // 5MB as string
    });
    const bbox = {
      minX: -124.5,
      minY: 32.5,
      maxX: -114.1,
      maxY: 42.0,
    };

    const features: Feature[] = [];
    for await (const feature of customSource.getFeaturesAsync(bbox)) {
      features.push(feature);
    }

    expect(fetchCount).toBe(2);
    expect(features.length).toBeGreaterThan(0);
  });
});

describe("Caching", () => {
  it("should not fetch new data for repeated queries with the same bbox", async () => {
    let fetchCount = 0;
    const customFetchRangeFn = (
      key: string,
      range: [number, number | null]
    ) => {
      fetchCount++;
      return fetch(TEST_URL, {
        headers: { Range: `bytes=${range[0]}-${range[1] ? range[1] : ""}` },
      }).then((response) => response.arrayBuffer());
    };

    const customSource = await createSource(TEST_URL, {
      fetchRangeFn: customFetchRangeFn,
    });
    const bbox = {
      minX: -124.5,
      minY: 32.5,
      maxX: -114.1,
      maxY: 42.0,
    };

    // First query
    const features1: Feature[] = [];
    for await (const feature of customSource.getFeaturesAsync(bbox)) {
      features1.push(feature);
    }

    const firstFetchCount = fetchCount;

    // Second query with the same bbox
    const features2: Feature[] = [];
    for await (const feature of customSource.getFeaturesAsync(bbox)) {
      features2.push(feature);
    }

    expect(fetchCount).toBe(firstFetchCount);
    expect(features1.length).toBeGreaterThan(0);
    expect(features2.length).toBeGreaterThan(0);
  });
});

describe("Query Planner", () => {
  it("should make a reasonable number of range requests for a bounding box query", async () => {
    let fetchCount = 0;
    const customFetchRangeFn = (
      key: string,
      range: [number, number | null]
    ) => {
      fetchCount++;
      return fetch(TEST_URL, {
        headers: { Range: `bytes=${range[0]}-${range[1] ? range[1] : ""}` },
      }).then((response) => response.arrayBuffer());
    };

    const customSource = await createSource(TEST_URL, {
      fetchRangeFn: customFetchRangeFn,
    });
    const bbox = {
      minX: -124.5,
      minY: 32.5,
      maxX: -114.1,
      maxY: 42.0,
    };

    const features: Feature[] = [];
    for await (const feature of customSource.getFeaturesAsync(bbox)) {
      features.push(feature);
    }

    expect(fetchCount).toBe(4);
    expect(features.length).toBeGreaterThan(0);
  });

  it("should make fewer requests when using a larger initial header request", async () => {
    let fetchCount = 0;
    const customFetchRangeFn = (
      key: string,
      range: [number, number | null]
    ) => {
      fetchCount++;
      return fetch(TEST_URL, {
        headers: { Range: `bytes=${range[0]}-${range[1] ? range[1] : ""}` },
      }).then((response) => response.arrayBuffer());
    };

    const customSource = await createSource(TEST_URL, {
      fetchRangeFn: customFetchRangeFn,
      initialHeaderRequestLength: "5MB",
    });
    const bbox = {
      minX: -124.5,
      minY: 32.5,
      maxX: -114.1,
      maxY: 42.0,
    };

    const features: Feature[] = [];
    for await (const feature of customSource.getFeaturesAsync(bbox)) {
      features.push(feature);
    }

    expect(fetchCount).toBe(3);
    expect(features.length).toBeGreaterThan(0);
  });

  it("should make minimal requests when using both large initial header and overfetch bytes", async () => {
    let fetchCount = 0;
    const customFetchRangeFn = (
      key: string,
      range: [number, number | null]
    ) => {
      fetchCount++;
      return fetch(TEST_URL, {
        headers: { Range: `bytes=${range[0]}-${range[1] ? range[1] : ""}` },
      }).then((response) => response.arrayBuffer());
    };

    const customSource = await createSource(TEST_URL, {
      fetchRangeFn: customFetchRangeFn,
      initialHeaderRequestLength: "5MB",
      overfetchBytes: "5MB",
    });
    const bbox = {
      minX: -124.5,
      minY: 32.5,
      maxX: -114.1,
      maxY: 42.0,
    };

    const features: Feature[] = [];
    for await (const feature of customSource.getFeaturesAsync(bbox)) {
      features.push(feature);
    }

    expect(fetchCount).toBe(2);
    expect(features.length).toBeGreaterThan(0);
  });
});

describe("scanAllFeatures", () => {
  it("should yield all features in the dataset", async () => {
    let firstFeature: Feature | null = null;
    let featureCount = 0;
    for await (const feature of source.scanAllFeatures()) {
      if (!firstFeature) {
        firstFeature = feature;
      }
      featureCount++;
    }

    // US counties dataset should have features
    expect(featureCount).toBe(3221);

    // Each feature should have the expected structure
    expect(firstFeature).not.toBeNull();
    expect(firstFeature!.type).toBe("Feature");
    expect(firstFeature!.geometry).toBeDefined();
    expect(firstFeature!.properties).toBeDefined();

    // Properties should include county information
    const properties = firstFeature!.properties;
    expect(properties).not.toBeNull();
    if (properties) {
      expect(properties).toHaveProperty("NAME");
      expect(properties).toHaveProperty("STATE");
      expect(properties).toHaveProperty("FIPS");
    }
  });

  it("should include metadata in feature properties", async () => {
    const features: Feature[] = [];
    for await (const feature of source.scanAllFeatures()) {
      features.push(feature);
    }

    const firstFeature = features[0];
    const properties = firstFeature.properties;
    expect(properties).not.toBeNull();
    if (properties) {
      expect(properties).toHaveProperty("__byteLength");
      expect(properties).toHaveProperty("__offset");
      expect(typeof properties.__byteLength).toBe("number");
      expect(typeof properties.__offset).toBe("number");
    }
  });

  it("should yield all features in the dataset with correct structure", async () => {
    const features: Feature[] = [];
    for await (const feature of source.scanAllFeatures()) {
      features.push(feature);
    }

    expect(features.length).toBe(3221);

    for (const feature of features) {
      expect(feature.type).toBe("Feature");
      expect(feature.geometry).toBeDefined();
      expect(feature.properties).toBeDefined();
      const properties = feature.properties;
      expect(properties).not.toBeNull();
      if (properties) {
        expect(properties).toHaveProperty("NAME");
        expect(properties).toHaveProperty("STATE");
        expect(properties).toHaveProperty("FIPS");
      }
    }
  });

  it("should yield feature properties without geometry data", async () => {
    const propertiesList: GeoJsonProperties[] = [];
    for await (const { properties } of source.getFeatureProperties()) {
      propertiesList.push(properties);
    }

    expect(propertiesList.length).toBe(3221);

    for (const properties of propertiesList) {
      expect(properties).not.toBeNull();
      expect(properties).toHaveProperty("NAME");
      expect(properties).toHaveProperty("STATE");
      expect(properties).toHaveProperty("FIPS");
      expect(properties).not.toHaveProperty("geometry");
    }
  });

  it("should return features with geometry data from getFeaturesAsync", async () => {
    const bbox = {
      minX: -124.5,
      minY: 32.5,
      maxX: -114.1,
      maxY: 42.0,
    };
    const features: Feature[] = [];
    for await (const feature of source.getFeaturesAsync(bbox)) {
      features.push(feature);
    }
    expect(features.length).toBeGreaterThan(0);
    for (const feature of features) {
      expect(feature.geometry).toBeDefined();
    }
  });

  it("should return features with geometry data from scanAllFeatures", async () => {
    const features: Feature[] = [];
    for await (const feature of source.scanAllFeatures()) {
      features.push(feature);
    }
    expect(features.length).toBe(3221);
    for (const feature of features) {
      expect(feature.geometry).toBeDefined();
    }
  });
});

describe("getFeaturesAsync", () => {
  it("should yield features within a bounding box", async () => {
    // Query for features in California (rough bounding box)
    const bbox = {
      minX: -123.10186828984092,
      minY: 37.28678715552242,
      maxX: -121.53985299178396,
      maxY: 38.77258370653095,
    };

    const features: Feature[] = [];
    for await (const feature of source.getFeaturesAsync(bbox)) {
      features.push(feature);
    }

    // Should find some California counties
    expect(features.length).toBeGreaterThan(1);

    // All features should be within the bounding box
    for (const feature of features) {
      const properties = feature.properties;
      expect(properties).not.toBeNull();
      if (properties) {
        expect(["CA"]).toContain(properties.STATE);
      }
    }
  });

  it("should yield only Hawaii county for Hawaii bounding box", async () => {
    const bbox = {
      minX: -156.1,
      minY: 18.8,
      maxX: -154.7,
      maxY: 20.3,
    };
    const features: Feature[] = [];
    for await (const feature of source.getFeaturesAsync(bbox)) {
      features.push(feature);
    }
    expect(features.length).toBe(1);
    const properties = features[0].properties;
    expect(properties).not.toBeNull();
    if (properties) {
      expect(properties.STATE).toBe("HI");
      expect(properties.NAME).toBe("Hawaii");
    }
  });

  it("should return no features for an empty bounding box", async () => {
    const bbox = {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
    };
    const features: Feature[] = [];
    for await (const feature of source.getFeaturesAsync(bbox)) {
      features.push(feature);
    }
    expect(features.length).toBe(0);
  });

  it("should handle multiple bounding boxes", async () => {
    // Query for features in both California and Nevada
    const bboxes = [
      {
        minX: -122.07530834974841,
        minY: 35.29748383610807,
        maxX: -119.24500815558116,
        maxY: 36.925162160671576,
      },
      {
        minX: -118.30110289147521,
        minY: 43.78424386996534,
        maxX: -115.58949984236023,
        maxY: 45.14023083106471,
      },
    ];

    const features: Feature[] = [];
    for await (const feature of source.getFeaturesAsync(bboxes)) {
      features.push(feature);
    }

    // Should find some features
    expect(features.length).toBeGreaterThan(0);

    // All features should be from either California or Nevada
    for (const feature of features) {
      const properties = feature.properties;
      expect(properties).not.toBeNull();
      if (properties) {
        expect(["CA", "OR", "NV", "ID"]).toContain(properties.STATE);
      }
    }
  });
});
