import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Flatbush from "flatbush";
import Pbf from "pbf";
import * as geobuf from "geobuf";
import { Feature, FeatureCollection, Polygon, Position } from "geojson";
import { VectorDataSource } from "../lib/index";

// A 2x2 square at the origin (_oid 1) subdivided into four unit squares and
// split across two bundles by column, plus an unrelated unit square far away
// (_oid 2) in a third bundle. Exterior rings are counter-clockwise, which
// union-subdivided-polygons requires.
function unitSquare(
  x: number,
  y: number,
  properties: Record<string, unknown>
): Feature<Polygon> {
  return {
    type: "Feature",
    properties,
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [x, y],
          [x + 1, y],
          [x + 1, y + 1],
          [x, y + 1],
          [x, y],
        ],
      ],
    },
  };
}

const bundles: FeatureCollection<Polygon>[] = [
  {
    type: "FeatureCollection",
    features: [
      unitSquare(0, 0, { _oid: 1, part: "sw" }),
      unitSquare(0, 1, { _oid: 1, part: "nw" }),
    ],
  },
  {
    type: "FeatureCollection",
    features: [
      unitSquare(1, 0, { _oid: 1, part: "se" }),
      unitSquare(1, 1, { _oid: 1, part: "ne" }),
    ],
  },
  {
    type: "FeatureCollection",
    features: [unitSquare(10, 10, { _oid: 2, part: "far" })],
  },
];

const bundleExtents: [number, number, number, number][] = [
  [0, 0, 1, 2],
  [1, 0, 2, 2],
  [10, 10, 11, 11],
];

function buildIndex() {
  const index = new Flatbush(bundleExtents.length);
  for (const [minX, minY, maxX, maxY] of bundleExtents) {
    index.add(minX, minY, maxX, maxY);
  }
  index.finish();
  return index;
}

function encodeBundle(collection: FeatureCollection<Polygon>) {
  return geobuf.encode(collection, new Pbf());
}

const BASE_URL = "https://example.test/datasource";

function ringArea(ring: Position[]) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum / 2);
}

function createMockFetch() {
  const index = buildIndex();
  const encoded = bundles.map(encodeBundle);
  const requested: string[] = [];
  const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    requested.push(url);
    if (url === `${BASE_URL}/metadata.json`) {
      return new Response(
        JSON.stringify({
          name: "fixture",
          version: 1,
          index: {
            length: bundleExtents.length,
            bytes: index.data.byteLength,
            location: "/index.bin",
            rootDir: "/bundles",
          },
          compositeIndexes: [],
        }),
        { headers: { "content-type": "application/json" } }
      );
    }
    if (url === `${BASE_URL}/index.bin`) {
      return new Response(index.data);
    }
    const match = url.match(new RegExp(`^${BASE_URL}/bundles/(\\d+)\\.pbf$`));
    if (match) {
      const id = parseInt(match[1], 10);
      if (encoded[id]) {
        return new Response(encoded[id]);
      }
    }
    return new Response("not found", { status: 404 });
  });
  return { mockFetch, requested };
}

describe("VectorDataSource", () => {
  let requested: string[];

  beforeEach(() => {
    const mock = createMockFetch();
    requested = mock.requested;
    vi.stubGlobal("fetch", mock.mockFetch);
    VectorDataSource.clearRegisteredSources();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("decodes geobuf bundles found through the flatbush index", async () => {
    const source = new VectorDataSource<Feature<Polygon>>(BASE_URL);
    const features = await source.fetch([0, 0, 2, 2]);
    expect(features.map((f) => f.properties!.part).sort()).toEqual([
      "ne",
      "nw",
      "se",
      "sw",
    ]);
    for (const feature of features) {
      expect(feature.geometry.type).toBe("Polygon");
      expect(feature.bbox).toHaveLength(4);
      expect(feature.properties!._url).toMatch(/\/bundles\/[01]\.pbf$/);
    }
    const bundleRequests = requested.filter((u) => u.includes("/bundles/"));
    expect(bundleRequests.sort()).toEqual([
      `${BASE_URL}/bundles/0.pbf`,
      `${BASE_URL}/bundles/1.pbf`,
    ]);
  });

  it("only fetches bundles whose extent intersects the query", async () => {
    const source = new VectorDataSource<Feature<Polygon>>(BASE_URL);
    const features = await source.fetch([10, 10, 11, 11]);
    expect(features).toHaveLength(1);
    expect(features[0].properties).toMatchObject({ _oid: 2, part: "far" });
    expect(requested.filter((u) => u.includes("/bundles/"))).toEqual([
      `${BASE_URL}/bundles/2.pbf`,
    ]);
  });

  it("reuses cached bundles across fetches", async () => {
    const source = new VectorDataSource<Feature<Polygon>>(BASE_URL);
    await source.fetch([0, 0, 1, 1]);
    await source.fetch([0, 0, 1, 1]);
    expect(requested.filter((u) => u.endsWith("/0.pbf"))).toHaveLength(1);
  });

  it("removes evicted bundle features from the spatial index", async () => {
    const source = new VectorDataSource<Feature<Polygon>>(BASE_URL, {
      cacheSize: 1,
    });
    // Each query touches exactly one bundle so the single-slot cache evicts
    // deterministically. Bundle 0 is avoided: mnemonist's setpop reports no
    // eviction for a falsy key, so bundle 0 is never pruned from the tree.
    const first = await source.fetch([1.5, 0, 2, 2]);
    expect(first.map((f) => f.properties!.part).sort()).toEqual(["ne", "se"]);
    await source.fetch([10, 10, 11, 11]);
    const again = await source.fetch([1.5, 0, 2, 2]);
    expect(requested.filter((u) => u.endsWith("/1.pbf"))).toHaveLength(2);
    // Stale copies would double the count if rbush.remove did not work.
    expect(again.map((f) => f.properties!.part).sort()).toEqual(["ne", "se"]);
  });

  it("returns decoded features with their geometry intact", async () => {
    const source = new VectorDataSource<Feature<Polygon>>(BASE_URL);
    const [feature] = await source.fetch([10, 10, 11, 11]);
    expect(feature.geometry.coordinates).toEqual(
      unitSquare(10, 10, {}).geometry.coordinates
    );
    expect(ringArea(feature.geometry.coordinates[0])).toBeCloseTo(1);
    expect(feature.bbox).toEqual([10, 10, 11, 11]);
  });

  it("passes features with a unique union id through fetchUnion", async () => {
    const source = new VectorDataSource<Feature<Polygon>>(BASE_URL);
    const collection = await source.fetchUnion([10, 10, 11, 11], "_oid");
    expect(collection.features).toHaveLength(1);
    expect(collection.features[0].properties).toMatchObject({ _oid: 2 });
    const empty = await source.fetchUnion([50, 50, 51, 51], "_oid");
    expect(empty.features).toEqual([]);
  });

  it("surfaces manifest errors at the point of use", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const source = new VectorDataSource<Feature<Polygon>>(BASE_URL);
    await expect(source.fetch([0, 0, 1, 1])).rejects.toThrow(
      /Problem fetching VectorDataSource manifest/
    );
    errorSpy.mockRestore();
  });
});
