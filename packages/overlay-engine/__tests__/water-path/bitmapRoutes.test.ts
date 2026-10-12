import { Feature, LineString, Position } from "geojson";
import { readFileSync } from "fs";
import { join } from "path";
import { createSource, FlatGeobufSource } from "fgb-source";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import distance from "@turf/distance";
import { searchWaterPathNearest } from "../../src/h3/waterPathNearest";
import { waterPathSketches } from "../../viewer/sketches";
import {
  bboxToEnvelope,
  splitBBoxAntimeridian,
} from "../../src/utils/bboxUtils";
import { landUrl } from "../constants";

/** Same World Ports file the viewer used when expected-routes.json was written. */
const portsUrl =
  "https://uploads.seasketch.org/projects/superuser/public/39e4dc3d-894c-4e88-bfb4-beaa5277b676.fgb";

type ExpectedHit = { port: string; km: number };
type ExpectedFile = {
  tolerance: number;
  cases: Record<string, ExpectedHit[]>;
};

const expected = JSON.parse(
  readFileSync(join(__dirname, "../../viewer/expected-routes.json"), "utf8"),
) as ExpectedFile;

function wrapLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

function samplesAlong(coords: Position[], stepMeters: number): Position[] {
  if (coords.length < 2) return [];
  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const len = distance(coords[i - 1]!, coords[i]!, { units: "meters" });
    lengths.push(len);
    total += len;
  }
  // The drawn line may cross filled land where it leaves a harbor. That
  // crossing is at the port end and is capped near 20 km. The ocean section
  // before it must stay off the land polygons.
  const skipStart = 2_000;
  const skipEnd = 25_000;
  if (total <= skipStart + skipEnd) return [];
  const out: Position[] = [];
  for (let d = skipStart; d < total - skipEnd; d += stepMeters) {
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

async function landNear(
  land: FlatGeobufSource<Feature>,
  coords: Position[],
): Promise<Feature[]> {
  const lngs = coords.map(([lng]) => wrapLng(lng));
  const lats = coords.map(([, lat]) => lat);
  const minLat = Math.min(...lats) - 0.05;
  const maxLat = Math.max(...lats) + 0.05;
  const east = lngs.filter((lng) => lng >= 0);
  const west = lngs.filter((lng) => lng < 0);
  const crosses =
    east.some((lng) => lng > 150) && west.some((lng) => lng < -150);
  const bbox: [number, number, number, number] = crosses
    ? [Math.min(...east) - 0.05, minLat, Math.max(...west) + 0.05, maxLat]
    : [Math.min(...lngs) - 0.05, minLat, Math.max(...lngs) + 0.05, maxLat];
  const found: Feature[] = [];
  const seen = new Set<number>();
  for (const part of splitBBoxAntimeridian(bbox)) {
    const env = bboxToEnvelope(part);
    for await (const feature of land.getFeaturesAsync(env as never)) {
      const offset = (feature.properties as { __offset?: unknown } | null)
        ?.__offset;
      if (typeof offset === "number") {
        if (seen.has(offset)) continue;
        seen.add(offset);
      }
      found.push(feature);
    }
  }
  return found;
}

function pointOnLand(lng: number, lat: number, features: Feature[]): boolean {
  const wrapped = wrapLng(lng);
  const candidates: Position[] = [
    [wrapped, lat],
    [wrapped + 360, lat],
    [wrapped - 360, lat],
  ];
  return features.some((feature) =>
    candidates.some((candidate) =>
      booleanPointInPolygon(candidate, feature as never),
    ),
  );
}

describe("ocean bitmap routes", () => {
  let ports: FlatGeobufSource<Feature>;
  let land: FlatGeobufSource<Feature>;

  beforeAll(async () => {
    const sourceOptions = { pageSize: "1MB" as const, maxCacheSize: "256MB" as const };
    ports = await createSource(portsUrl, sourceOptions);
    land = await createSource(landUrl, sourceOptions);
  }, 120_000);

  for (const [sketchId, hits] of Object.entries(expected.cases)) {
    it.concurrent(
      sketchId,
      async () => {
        const feature = waterPathSketches[sketchId];
        expect(feature, sketchId).toBeTruthy();
        const result = await searchWaterPathNearest(feature!, ports, land, {
          maxResults: 6,
          maxDistanceKm: 200,
          resolution: "high",
          includedColumns: ["PORT_NAME", "COUNTRY"],
        });
        const names = result.features.map((hit) => hit.properties.PORT_NAME);
        expect(new Set(names)).toEqual(new Set(hits.map((hit) => hit.port)));
        // Nearest first. Two ports inside the distance tolerance can swap
        // order between runs, so the expected list is matched by name.
        const expectedKm = new Map(hits.map((hit) => [hit.port, hit.km]));
        let previousKm = -Infinity;
        for (const hit of result.features) {
          const km = hit.meters / 1000;
          expect(km).toBeGreaterThanOrEqual(previousKm - 1e-6);
          previousKm = km;
          const want = expectedKm.get(String(hit.properties.PORT_NAME));
          expect(want).toBeDefined();
          expect(Math.abs(km - want!)).toBeLessThanOrEqual(
            Math.abs(want!) * expected.tolerance + 1e-6,
          );
        }
        await Promise.all(
          result.features.map(async (hit) => {
            const line = hit.geojsonLine as Feature<LineString>;
            const samples = samplesAlong(line.geometry.coordinates, 800);
            if (samples.length === 0) return;
            const polygons = await landNear(land, samples);
            const onLand = samples.filter(([lng, lat]) =>
              pointOnLand(lng, lat, polygons),
            );
            expect(
              onLand.length,
              `${sketchId} ${String(hit.properties.PORT_NAME)} crosses land at ${JSON.stringify(onLand.slice(0, 3))}`,
            ).toBeLessThan(4);
          }),
        );
      },
      180_000,
    );
  }
});
