/// <reference types="vitest" />
import { SourceCache } from "../sourceCache";
import { FlatGeobufSource } from "../source";
import { Feature } from "geojson";

const TEST_URL1 = "https://flatgeobuf.org/test/data/UScounties.fgb";
const TEST_URL2 = "https://flatgeobuf.org/test/data/countries.fgb";
const TEST_URL3 = "https://flatgeobuf.org/test/data/UScounties.fgb?v=2";

describe("SourceCache", () => {
  let sourceCache: SourceCache;
  let fetchCount: number;
  let fetchRangeFn: (
    key: string,
    range: [number, number | null]
  ) => Promise<ArrayBuffer>;

  beforeEach(() => {
    sourceCache = new SourceCache("64mb");
    fetchCount = 0;
    fetchRangeFn = (key: string, range: [number, number | null]) => {
      fetchCount++;
      return fetch(key, {
        headers: { Range: `bytes=${range[0]}-${range[1] ? range[1] : ""}` },
      }).then((response) => response.arrayBuffer());
    };
  });

  describe("Unique Sources", () => {
    it("should create unique sources for different URLs", async () => {
      const source1 = await sourceCache.get(TEST_URL1);
      const source2 = await sourceCache.get(TEST_URL2);

      expect(source1).toBeDefined();
      expect(source2).toBeDefined();
      expect(source1).not.toBe(source2);
    });

    it("should return the same source instance for the same URL", async () => {
      const source1 = await sourceCache.get(TEST_URL1);
      const source2 = await sourceCache.get(TEST_URL1);

      expect(source1).toBe(source2);
    });
  });

  describe("Fetch Range Function", () => {
    it("should not make new header/index requests when getting a cached source", async () => {
      // First request - should make header/index requests
      const source1 = await sourceCache.get(TEST_URL1, { fetchRangeFn });
      const firstFetchCount = fetchCount;

      // Second request for same URL - should use cached source
      const source2 = await sourceCache.get(TEST_URL1, { fetchRangeFn });
      expect(source1).toBe(source2);
      expect(fetchCount).toBe(firstFetchCount);

      // Verify the source works by querying features
      const bbox = {
        minX: -124.5,
        minY: 32.5,
        maxX: -114.1,
        maxY: 42.0,
      };

      const features: Feature[] = [];
      for await (const feature of source2.getFeaturesAsync(bbox)) {
        features.push(feature);
      }

      expect(features.length).toBeGreaterThan(0);
    });

    it("should handle concurrent requests for the same URL", async () => {
      const promises = [
        sourceCache.get(TEST_URL1, { fetchRangeFn }),
        sourceCache.get(TEST_URL1, { fetchRangeFn }),
        sourceCache.get(TEST_URL1, { fetchRangeFn }),
      ];

      const [source1, source2, source3] = await Promise.all(promises);

      expect(source1).toBe(source2);
      expect(source2).toBe(source3);
      expect(fetchCount).toBeLessThan(3); // Should reuse the same source
    });
  });

  describe("Default Options", () => {
    it("should use default fetchRangeFn when no options are provided to get()", async () => {
      let defaultFetchCalled = false;
      const defaultFetchRangeFn = async (
        key: string,
        range: [number, number | null]
      ) => {
        defaultFetchCalled = true;
        return fetch(key, {
          headers: { Range: `bytes=${range[0]}-${range[1] ? range[1] : ""}` },
        }).then((response) => response.arrayBuffer());
      };

      const cacheWithDefaults = new SourceCache("64mb", {
        fetchRangeFn: defaultFetchRangeFn,
      });

      const source = await cacheWithDefaults.get(TEST_URL1);
      expect(source).toBeDefined();
      expect(defaultFetchCalled).toBe(true);

      // Verify the source works
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
    });

    it("should merge default options with provided options, with provided options taking precedence", async () => {
      let defaultFetchCalled = false;
      let providedFetchCalled = false;

      const defaultFetchRangeFn = async (
        key: string,
        range: [number, number | null]
      ) => {
        defaultFetchCalled = true;
        return fetch(key, {
          headers: { Range: `bytes=${range[0]}-${range[1] ? range[1] : ""}` },
        }).then((response) => response.arrayBuffer());
      };

      const providedFetchRangeFn = async (
        key: string,
        range: [number, number | null]
      ) => {
        providedFetchCalled = true;
        return fetch(key, {
          headers: { Range: `bytes=${range[0]}-${range[1] ? range[1] : ""}` },
        }).then((response) => response.arrayBuffer());
      };

      const cacheWithDefaults = new SourceCache("64mb", {
        fetchRangeFn: defaultFetchRangeFn,
        maxCacheSize: "1MB",
      });

      // Should use provided fetchRangeFn, not default
      const source = await cacheWithDefaults.get(TEST_URL1, {
        fetchRangeFn: providedFetchRangeFn,
        maxCacheSize: "2MB", // Should override default
      });

      expect(source).toBeDefined();
      expect(defaultFetchCalled).toBe(false);
      expect(providedFetchCalled).toBe(true);

      // Verify the source works
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
    });

    it("should use default options when no options are provided to get()", async () => {
      const cacheWithDefaults = new SourceCache("64mb", {
        maxCacheSize: "1MB",
        initialHeaderRequestLength: "100KB",
        overfetchBytes: "50KB",
      });

      const source = await cacheWithDefaults.get(TEST_URL1);
      expect(source).toBeDefined();

      // Verify the source works
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
    });

    it("should work with custom default fetchRangeFn for R2-like scenarios", async () => {
      let customFetchCalled = false;
      const customFetchRangeFn = async (
        key: string,
        range: [number, number | null]
      ) => {
        customFetchCalled = true;
        // Simulate R2 bucket access by using the test URL but with custom headers
        const response = await fetch(key, {
          headers: range
            ? new Headers({
                Range: `bytes=${range[0]}-${range[1] ? range[1] : ""}`,
                "X-Custom-Source": "r2-bucket", // Add custom header to simulate R2
              })
            : undefined,
        });
        return response.arrayBuffer();
      };

      const cacheWithDefaults = new SourceCache("64mb", {
        fetchRangeFn: customFetchRangeFn,
      });

      const source = await cacheWithDefaults.get(TEST_URL1);
      expect(source).toBeDefined();
      expect(customFetchCalled).toBe(true);

      // Verify the source works
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
    });
  });

  describe("Cache Size Limiting", () => {
    it("should evict sources when cache size limit is exceeded", async () => {
      const evictions: { key: string; reason: string }[] = [];
      const smallCache = new SourceCache("6mb", {
        onEvict: (key, source, reason) => {
          evictions.push({ key, reason });
        },
      });

      // Load first source
      const source1 = await smallCache.get(TEST_URL1, { fetchRangeFn });
      const firstFetchCount = fetchCount;

      // Load second source, which should evict the first
      const source2 = await smallCache.get(TEST_URL2, { fetchRangeFn });

      // Try to get the first source again - should trigger a new fetch
      const source1Again = await smallCache.get(TEST_URL1, { fetchRangeFn });

      // Verify that source1 was evicted and re-fetched
      expect(source1).not.toBe(source1Again);
      expect(fetchCount).toBeGreaterThan(firstFetchCount);

      // Verify both sources work
      const bbox = {
        minX: -124.5,
        minY: 32.5,
        maxX: -114.1,
        maxY: 42.0,
      };

      const features1: Feature[] = [];
      for await (const feature of source1Again.getFeaturesAsync(bbox)) {
        features1.push(feature);
      }
      expect(features1.length).toBeGreaterThan(0);

      const features2: Feature[] = [];
      for await (const feature of source2.getFeaturesAsync(bbox)) {
        features2.push(feature);
      }
      expect(features2.length).toBeGreaterThan(0);

      // After test, check that at least one eviction occurred
      expect(evictions.length).toBeGreaterThan(0);
      expect(evictions[0].key).toBe(TEST_URL1);
      expect(typeof evictions[0].reason).toBe("string");
    });

    it("should maintain LRU order when cache size limit is reached", async () => {
      // Create a new cache with a size limit that can hold two sources but not three
      const smallCache = new SourceCache("12mb");

      // Load first source
      const source1 = await smallCache.get(TEST_URL1, { fetchRangeFn });
      const firstFetchCount = fetchCount;

      // Load second source
      const source2 = await smallCache.get(TEST_URL2, { fetchRangeFn });

      // Access source2 again to make it most recently used
      await smallCache.get(TEST_URL2, { fetchRangeFn });

      // Load a third source, which should evict source1 (not source2)
      const source3 = await smallCache.get(TEST_URL3, { fetchRangeFn });

      // Try to get source2 again - should still be cached
      const source2Again = await smallCache.get(TEST_URL2, { fetchRangeFn });
      expect(source2).toBe(source2Again);

      // Try to get source1 again - should be evicted and re-fetched
      const source1Again = await smallCache.get(TEST_URL1, { fetchRangeFn });
      expect(source1).not.toBe(source1Again);
    });
  });
});
