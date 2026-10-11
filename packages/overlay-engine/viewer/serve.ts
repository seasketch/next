/**
 * Local map for the occupancy water-path search.
 *
 *   npm run water-path-viewer
 *
 * Serves viewer/index.html and POST /api/route. The page draws the route,
 * the cells the search read, and the World Ports PMTiles from the data library.
 *
 * /astar is the client-side H3 A* page. Its script, viewer/astar.ts, is
 * bundled on each request so edits show up on refresh. GET /api/ports returns
 * the ports near a point for that page's goal list.
 *
 * /tangent runs the tangent router and returns the visibility-graph walk so
 * the page can play it back.
 *
 * /raster is the ocean-bitmap A* page. viewer/raster.ts is bundled on request.
 */
import { createServer, IncomingMessage, ServerResponse } from "http";
import { readFileSync } from "fs";
import { join } from "path";
import { buildSync } from "esbuild";
import { Feature, Polygon, Position } from "geojson";
import { createSource, FlatGeobufSource } from "fgb-source";
import { cellToBoundary, cellToLatLng, getResolution } from "h3-js";
import { searchWaterPathByOccupancy } from "../src/h3/waterPathOccupancy";
import { searchWaterPathByTangent } from "../src/h3/waterPathTangent";
import {
  DEFAULT_WATER_PATH_DISTANCE_KM,
  DEFAULT_WATER_PATH_MAX_RESULTS,
} from "../src/h3/waterPathNearestH3";
import { bboxToEnvelope, cleanBBox, splitBBoxAntimeridian } from "../src/utils/bboxUtils";
import { waterPathSketches } from "./sketches";

const PORT = 8766;
const LAND_URL = "https://uploads.seasketch.org/land-big-2.fgb";
const PORTS_FGB =
  "https://uploads.seasketch.org/projects/superuser/public/39e4dc3d-894c-4e88-bfb4-beaa5277b676.fgb";
const ARCHIVES: Record<string, string> = {
  "8": "https://tiles.seasketch.org/h3-land/v1/land-res8.h3ld",
  "9": "https://tiles.seasketch.org/h3-land/v1/land-res9.h3ld",
};

const sketches = waterPathSketches;

function boundaryRing(cell: string): Position[] {
  const raw = cellToBoundary(cell, true);
  const centerLat = cellToLatLng(cell)[0];
  const ring: Position[] = [[raw[0]![0], raw[0]![1]]];
  for (let i = 1; i < raw.length; i++) {
    let lng = raw[i]![0];
    const prev = ring[ring.length - 1]![0];
    while (lng - prev > 180) lng -= 360;
    while (prev - lng > 180) lng += 360;
    ring.push([lng, raw[i]![1]]);
  }
  let closeLng = ring[0]![0];
  const prev = ring[ring.length - 1]![0];
  while (closeLng - prev > 180) closeLng -= 360;
  while (prev - closeLng > 180) closeLng += 360;
  if (Math.abs(closeLng - ring[0]![0]) > 180) {
    const pole = centerLat >= 0 ? 89.999999 : -89.999999;
    ring.push([closeLng, raw[0]![1]]);
    ring.push([closeLng, pole]);
    ring.push([ring[0]![0], pole]);
  }
  ring.push(ring[0]!);
  return ring;
}

function unwrapLine(coords: Position[]): Position[] {
  if (coords.length === 0) return [];
  const out: Position[] = [[coords[0]![0], coords[0]![1]]];
  for (let i = 1; i < coords.length; i++) {
    let lng = coords[i]![0];
    const prev = out[out.length - 1]![0];
    while (lng - prev > 180) lng -= 360;
    while (prev - lng > 180) lng += 360;
    out.push([lng, coords[i]![1]]);
  }
  return out;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk as Buffer));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(json),
  });
  res.end(json);
}

function bundleBrowser(file: string, globalName?: string): string {
  const built = buildSync({
    entryPoints: [join(__dirname, file)],
    bundle: true,
    platform: "browser",
    format: "iife",
    globalName,
    target: "es2020",
    write: false,
    sourcemap: "inline",
    logLevel: "silent",
  });
  return built.outputFiles[0]!.text;
}

type PortPoint = { name: string; country: string; lng: number; lat: number };

/** Ports within about `km` of a point, split across the antimeridian. */
async function portsNear(
  ports: FlatGeobufSource<Feature>,
  lng: number,
  lat: number,
  km: number
): Promise<PortPoint[]> {
  const latPad = km / 111.32;
  const cos = Math.cos((lat * Math.PI) / 180);
  const lngPad = cos < 0.05 ? 180 : Math.min(180, km / (111.32 * cos));
  const south = Math.max(-90, lat - latPad);
  const north = Math.min(90, lat + latPad);
  const boxes =
    lngPad >= 180
      ? [[-180, south, 180, north]]
      : splitBBoxAntimeridian(
          cleanBBox([lng - lngPad, south, lng + lngPad, north]) as [number, number, number, number]
        );
  const found: PortPoint[] = [];
  const seen = new Set<string>();
  for (const box of boxes) {
    for await (const feature of ports.getFeaturesAsync(bboxToEnvelope(box) as never)) {
      const geometry = feature.geometry;
      const positions: Position[] =
        geometry.type === "Point"
          ? [geometry.coordinates]
          : geometry.type === "MultiPoint"
            ? geometry.coordinates
            : [];
      const props = (feature.properties ?? {}) as Record<string, unknown>;
      for (const [x, y] of positions) {
        const key = `${x},${y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        found.push({
          name: String(props.PORT_NAME ?? ""),
          country: String(props.COUNTRY ?? ""),
          lng: x!,
          lat: y!,
        });
      }
    }
  }
  return found;
}

async function main() {
  const sourceOptions = { pageSize: "1MB" as const, maxCacheSize: "256MB" as const };
  console.log("opening land and the World Ports FlatGeobuf…");
  const land = await createSource(LAND_URL, sourceOptions);
  const ports = (await createSource(PORTS_FGB, sourceOptions)) as FlatGeobufSource<Feature>;

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://localhost");
      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(readFileSync(join(__dirname, "index.html")));
        return;
      }
      if (req.method === "GET" && url.pathname === "/tangent") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(readFileSync(join(__dirname, "tangent.html")));
        return;
      }
      if (req.method === "GET" && url.pathname === "/raster") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(readFileSync(join(__dirname, "raster.html")));
        return;
      }
      if (req.method === "GET" && url.pathname === "/astar") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(readFileSync(join(__dirname, "astar.html")));
        return;
      }
      if (req.method === "GET" && url.pathname === "/astar.js") {
        res.writeHead(200, {
          "content-type": "text/javascript; charset=utf-8",
          "cache-control": "no-store",
        });
        res.end(bundleBrowser("astar.ts"));
        return;
      }
      if (req.method === "GET" && url.pathname === "/expected-routes.json") {
        res.writeHead(200, {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        });
        res.end(readFileSync(join(__dirname, "expected-routes.json")));
        return;
      }
      if (req.method === "GET" && url.pathname === "/frame.css") {
        res.writeHead(200, {
          "content-type": "text/css; charset=utf-8",
          "cache-control": "no-store",
        });
        res.end(readFileSync(join(__dirname, "frame.css")));
        return;
      }
      if (req.method === "GET" && url.pathname === "/frame.js") {
        res.writeHead(200, {
          "content-type": "text/javascript; charset=utf-8",
          "cache-control": "no-store",
        });
        res.end(bundleBrowser("frame.ts", "WaterPath"));
        return;
      }
      if (req.method === "GET" && url.pathname === "/raster.js") {
        res.writeHead(200, {
          "content-type": "text/javascript; charset=utf-8",
          "cache-control": "no-store",
        });
        res.end(bundleBrowser("raster.ts"));
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/ports") {
        const lng = Number(url.searchParams.get("lng"));
        const lat = Number(url.searchParams.get("lat"));
        const km = Math.min(3000, Math.max(1, Number(url.searchParams.get("km")) || 400));
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
          send(res, 400, { error: "lng and lat are required" });
          return;
        }
        send(res, 200, await portsNear(ports, lng, lat, km));
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/sketches") {
        send(
          res,
          200,
          Object.entries(sketches).map(([id, feature]) => ({ id, feature }))
        );
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/tangent") {
        const payload = JSON.parse(await readBody(req)) as {
          sketch?: string;
          maxResults?: number;
          maxDistanceKm?: number;
          trace?: boolean;
        };
        const feature = payload.sketch ? sketches[payload.sketch] : undefined;
        if (!feature) {
          send(res, 400, { error: "unknown sketch" });
          return;
        }
        const started = Date.now();
        const result = await searchWaterPathByTangent(feature, ports, land, {
          maxResults: payload.maxResults,
          maxDistanceKm: payload.maxDistanceKm,
          trace: payload.trace === true,
        });
        send(res, 200, {
          ms: Date.now() - started,
          exceededLimit: result.exceededLimit,
          routes: result.features.map((hit, index) => {
            const located = hit as typeof hit & { catalog?: Position; goal?: Position };
            return {
              rank: index + 1,
              port: String(hit.properties.PORT_NAME ?? ""),
              country: String(hit.properties.COUNTRY ?? ""),
              meters: Math.round(hit.meters),
              coordinates: unwrapLine(hit.geojsonLine.geometry.coordinates),
              catalog: located.catalog ?? null,
              goal: located.goal ?? null,
            };
          }),
          candidates: result.candidates.slice(0, 24).map((candidate) => ({
            port: String(candidate.properties.PORT_NAME ?? ""),
            country: String(candidate.properties.COUNTRY ?? ""),
            geodesicMeters: Math.round(candidate.geodesicMeters),
            meters: candidate.meters != null ? Math.round(candidate.meters) : null,
            position: candidate.position,
          })),
          traces: result.traces ?? null,
        });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/route") {
        const payload = JSON.parse(await readBody(req)) as {
          sketch?: string;
          archive?: string;
        };
        const feature = payload.sketch ? sketches[payload.sketch] : undefined;
        const archiveUrl = payload.archive ? ARCHIVES[payload.archive] : undefined;
        if (!feature || !archiveUrl) {
          send(res, 400, { error: "unknown sketch or archive" });
          return;
        }
        const started = Date.now();
        const result = await searchWaterPathByOccupancy(feature, ports, land, {
          maxDistanceKm: DEFAULT_WATER_PATH_DISTANCE_KM,
          maxResults: DEFAULT_WATER_PATH_MAX_RESULTS,
          archiveUrl,
          trace: true,
        });
        const trace = result.trace;
        const counts = { water: 0, mixed: 0, land: 0 };
        const features: Feature[] = [
          {
            ...feature,
            properties: { ...(feature.properties ?? {}), layer: "sketch" },
          },
        ];
        result.features.forEach((hit, index) => {
          features.push({
            type: "Feature",
            properties: {
              layer: "route",
              rank: index + 1,
              port: String(hit.properties.PORT_NAME ?? ""),
              country: String(hit.properties.COUNTRY ?? ""),
              meters: Math.round(hit.meters),
            },
            geometry: {
              type: "LineString",
              coordinates: unwrapLine(hit.geojsonLine.geometry.coordinates),
            },
          });
        });
        for (const cell of trace?.cells ?? []) {
          if (cell.state === "water") counts.water++;
          else if (cell.state === "mixed") counts.mixed++;
          else counts.land++;
          features.push({
            type: "Feature",
            properties: {
              layer: "cell",
              state: cell.state,
              resolution: getResolution(cell.cell),
              cell: cell.cell,
            },
            geometry: { type: "Polygon", coordinates: [boundaryRing(cell.cell)] },
          });
        }
        send(res, 200, {
          ms: Date.now() - started,
          fine: trace?.fine ?? null,
          expansions: trace?.expansions ?? 0,
          requests: trace?.requests ?? 0,
          bytes: trace?.bytes ?? 0,
          counts,
          routes: result.features.map((hit, index) => ({
            rank: index + 1,
            port: String(hit.properties.PORT_NAME ?? ""),
            country: String(hit.properties.COUNTRY ?? ""),
            meters: Math.round(hit.meters),
          })),
          candidates: result.candidates.slice(0, 24).map((candidate) => ({
            port: String(candidate.properties.PORT_NAME ?? ""),
            country: String(candidate.properties.COUNTRY ?? ""),
            geodesicMeters: Math.round(candidate.geodesicMeters),
            meters: candidate.meters != null ? Math.round(candidate.meters) : null,
            position: candidate.position,
          })),
          geojson: { type: "FeatureCollection", features },
        });
        return;
      }
      res.writeHead(404);
      res.end();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
      if (!res.headersSent) send(res, 500, { error: message });
    }
  });

  server.listen(PORT, () => {
    console.log(`water-path viewer at http://localhost:${PORT}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
