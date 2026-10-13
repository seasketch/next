import fs from "fs";
import path from "path";
import { Feature, LineString, Polygon, Position } from "geojson";
import { createSource, FlatGeobufSource } from "fgb-source";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import distance from "@turf/distance";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import {
  DEFAULT_WATER_PATH_DISTANCE_KM,
  DEFAULT_WATER_PATH_MAX_RESULTS,
} from "../../src/h3/waterPathNearest";
import { searchWaterPathByHierarchy } from "../../src/h3/waterPathHierarchy";
import {
  bboxToEnvelope,
  splitBBoxAntimeridian,
} from "../../src/utils/bboxUtils";
import { landUrl, portsUrl } from "../constants";

const portTest = require("./sketches/port-test.geojson.json") as Feature;
const outputDir = path.join(__dirname, "output-hierarchy");

function wrapLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

function square(name: string, lng: number, lat: number, delta = 0.03): Feature<Polygon> {
  return {
    type: "Feature",
    properties: { name },
    geometry: {
      type: "Polygon",
      coordinates: [[
        [lng - delta, lat - delta],
        [lng + delta, lat - delta],
        [lng + delta, lat + delta],
        [lng - delta, lat + delta],
        [lng - delta, lat - delta],
      ]],
    },
  };
}

const gullIsland: Feature<Polygon> = {
  type: "Feature",
  properties: { name: "gull-island" },
  geometry: {
    type: "Polygon",
    coordinates: [[
      [-119.84345985838848, 33.9536708361406],
      [-119.81547511262983, 33.9536708361406],
      [-119.81547511262983, 33.938194061214645],
      [-119.84345985838848, 33.938194061214645],
      [-119.84345985838848, 33.9536708361406],
    ]],
  },
};

const cases: Array<{ feature: Feature; expectDetour?: boolean; portName?: string }> = [
  { feature: { ...portTest, properties: { name: "port-test" } }, expectDetour: true },
  { feature: square("west-of-dateline", 179.2, -17.15) },
  { feature: square("east-of-dateline", -179.85, -16.75) },
  { feature: square("straddle-antimeridian", 180, -17.05, 0.08) },
  { feature: square("natewa-bay", 179.72, -16.58, 0.02), expectDetour: true },
  { feature: square("wallis", -176.3, -13.5, 0.04), portName: "MATA-UTU" },
  { feature: gullIsland, expectDetour: true, portName: "PRISONERS" },
  { feature: square("golden-gate", -122.58, 37.82, 0.02), portName: "SAN FRANCISCO" },
];

function ringsOf(feature: Feature): Position[][] {
  const geometry = feature.geometry;
  if (!geometry) return [];
  if (geometry.type === "Polygon") return geometry.coordinates;
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat();
  if (geometry.type === "LineString") return [geometry.coordinates];
  return [];
}

function boundaryDistanceMeters(subject: Feature, point: Position): number {
  let best = Infinity;
  for (const ring of ringsOf(subject)) {
    if (ring.length < 2) continue;
    const line: Feature<LineString> = {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: ring },
    };
    for (const shift of [0, 360, -360]) {
      const snapped = nearestPointOnLine(line as never, {
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: [point[0] + shift, point[1]] },
      } as never, { units: "meters" }) as Feature & { properties: { dist?: number } };
      const dist = snapped.properties?.dist;
      if (typeof dist === "number" && dist < best) best = dist;
    }
  }
  return best;
}

function samplesAlong(coords: Position[], step: number, skipStart: number, skipEnd: number): Position[] {
  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const len = distance(coords[i - 1]!, coords[i]!, { units: "meters" });
    lengths.push(len);
    total += len;
  }
  if (total <= skipStart + skipEnd) return [];
  const out: Position[] = [];
  for (let d = skipStart; d < total - skipEnd; d += step) {
    let remain = d;
    for (let i = 0; i < lengths.length; i++) {
      const seg = lengths[i]!;
      if (remain <= seg || i === lengths.length - 1) {
        const t = seg === 0 ? 0 : Math.min(1, remain / seg);
        const a = coords[i]!;
        const b = coords[i + 1]!;
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        break;
      }
      remain -= seg;
    }
  }
  return out;
}

async function landNear(land: FlatGeobufSource<Feature>, coords: Position[]): Promise<Feature[]> {
  const lngs = coords.map(([lng]) => wrapLng(lng));
  const lats = coords.map(([, lat]) => lat);
  const minLat = Math.min(...lats) - 0.15;
  const maxLat = Math.max(...lats) + 0.15;
  const bbox: [number, number, number, number] = [
    Math.min(...lngs) - 0.2,
    minLat,
    Math.max(...lngs) + 0.2,
    maxLat,
  ];
  const found: Feature[] = [];
  const seen = new Set<number>();
  for (const part of splitBBoxAntimeridian(bbox)) {
    const env = bboxToEnvelope(part);
    for await (const feature of land.getFeaturesAsync(env as never)) {
      const offset = (feature.properties as { __offset?: unknown } | null)?.__offset;
      if (typeof offset === "number") {
        if (seen.has(offset)) continue;
        seen.add(offset);
      }
      found.push(feature);
    }
  }
  return found;
}

describe("hierarchical water path", () => {
  // The suite shares the runner with the other overlay tests. A quiet run
  // finishes in about three minutes; a busy runner has gone past five.
  vi.setConfig({ testTimeout: 600_000, hookTimeout: 600_000 });
  let ports: FlatGeobufSource<Feature>;
  let land: FlatGeobufSource<Feature>;
  const subjects: Feature[] = [];
  const routes: Feature[] = [];

  beforeAll(async () => {
    const sourceOptions = { pageSize: "1MB", maxCacheSize: "256MB" };
    ports = await createSource(portsUrl, sourceOptions);
    land = await createSource(landUrl, sourceOptions);
  });

  afterAll(() => {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(
      path.join(outputDir, "subjects.geojson"),
      JSON.stringify({ type: "FeatureCollection", features: subjects })
    );
    fs.writeFileSync(
      path.join(outputDir, "routes.geojson"),
      JSON.stringify({ type: "FeatureCollection", features: routes })
    );
  });

  it("routes each sketch offshore, from the boundary, within the default limit", async () => {
    for (const testCase of cases) {
      const name = String(testCase.feature.properties?.name);
      const started = Date.now();
      const cpu = process.cpuUsage();
      const result = await searchWaterPathByHierarchy(testCase.feature, ports, land, {
        maxDistanceKm: DEFAULT_WATER_PATH_DISTANCE_KM,
        maxResults: DEFAULT_WATER_PATH_MAX_RESULTS,
      });
      const cpuMs = (process.cpuUsage(cpu).user + process.cpuUsage(cpu).system) / 1000;
      expect(result.features.length, name).toBeGreaterThan(0);
      expect(result.features.length).toBeLessThanOrEqual(DEFAULT_WATER_PATH_MAX_RESULTS);
      for (let index = 0; index < result.features.length; index++) {
        const hit = result.features[index]!;
        const coords = hit.geojsonLine.geometry.coordinates;
        const origin = coords[0]!;
        const port = coords[coords.length - 1]!;
        const portName = String(hit.properties.PORT_NAME ?? "");
        const geodesic = distance(origin, port, { units: "meters" });
        const landFeatures = await landNear(land, coords);
        const interior = samplesAlong(coords, 80, 2000, 2500);
        const landHits = interior.filter(([lng, lat]) =>
          landFeatures.some((feature) =>
            booleanPointInPolygon([wrapLng(lng), lat], feature as never)
          )
        );
        const onBoundary = boundaryDistanceMeters(testCase.feature, origin);
        console.log(
          `${name}${index ? "#" + (index + 1) : ""}: ${portName} water=${Math.round(hit.meters)}m geodesic=${Math.round(geodesic)}m vertices=${coords.length} boundary=${Math.round(onBoundary)}m interiorLandHits=${landHits.length} wall=${Date.now() - started}ms cpu=${Math.round(cpuMs)}ms`
        );
        const routeName = index === 0 ? name : `${name}#${index + 1}`;
        routes.push({
          type: "Feature",
          properties: {
            name: routeName,
            port: portName,
            meters: Math.round(hit.meters),
            vertices: coords.length,
            interiorLandHits: landHits.length,
          },
          geometry: hit.geojsonLine.geometry,
        });
        if (index === 0) {
          subjects.push({
            ...testCase.feature,
            properties: { ...(testCase.feature.properties ?? {}), name, port: portName },
          });
        }
        expect(landHits, `${routeName} crosses land`).toEqual([]);
        expect(onBoundary, `${routeName} should start on the polygon edge`).toBeLessThan(30);
        expect(coords.length, `${routeName} is still a hex zigzag`).toBeLessThan(
          Math.max(8, Math.ceil(hit.meters / 2500))
        );
        expect(hit.meters).toBeGreaterThan(0);
        expect(hit.meters).toBeLessThan(DEFAULT_WATER_PATH_DISTANCE_KM * 1000);
        expect(hit.meters).toBeGreaterThanOrEqual(geodesic * 0.98);
        if (index === 0 && testCase.portName) expect(portName).toBe(testCase.portName);
        if (index === 0 && testCase.expectDetour) {
          expect(hit.meters).toBeGreaterThan(geodesic * 1.05);
        }
      }
    }
  });
});
