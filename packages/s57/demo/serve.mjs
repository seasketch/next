/**
 * Serves the chart demo and its archives as raw Mapbox vector tiles.
 *
 *   node demo/serve.mjs [chart-dir | chart.pmtiles] [port]
 *
 * With no chart path, every built region is served and the page can switch
 * among them. A path serves that one chart, which is how the channel compare
 * harness has always loaded tiles.
 */
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from "fs";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { PMTiles } from "pmtiles";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const require = createRequire(import.meta.url);
const { buildS57Style } = require(path.join(here, "../dist/style.js"));
// SeaSketch pins mapbox-gl 3.4 on the client. The demo uses that same build.
const mapboxDir = path.join(root, "packages/client/node_modules/mapbox-gl");
const port = Number(process.argv[3] || 4173);

const CHANNEL_VIEWS = [
  { name: "Channel", zoom: 9, lon: -119.9, lat: 34.2 },
  { name: "Santa Barbara", zoom: 13, lon: -119.69, lat: 34.406 },
  { name: "Ventura", zoom: 14, lon: -119.265, lat: 34.248 },
  { name: "Santa Cruz", zoom: 11, lon: -119.72, lat: 34.02 },
  { name: "Santa Rosa", zoom: 12, lon: -120.15, lat: 33.97 },
  { name: "San Miguel", zoom: 12, lon: -120.36, lat: 34.04 },
  { name: "Anacapa", zoom: 13, lon: -119.4, lat: 34.01 },
];

class FileBytes {
  constructor(file) {
    this.file = file;
  }
  getKey() {
    return this.file;
  }
  async getBytes(offset, length) {
    const { openSync, readSync, closeSync } = await import("fs");
    const fd = openSync(this.file, "r");
    try {
      const buffer = Buffer.alloc(length);
      const read = readSync(fd, buffer, 0, length, offset);
      return { data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + read) };
    } finally {
      closeSync(fd);
    }
  }
}

async function openArchives(entries) {
  const archives = new Map();
  for (const entry of entries) {
    const tiles = new PMTiles(new FileBytes(entry.file));
    archives.set(entry.source, { tiles, header: await tiles.getHeader(), maxzoom: entry.maxzoom });
  }
  return archives;
}

function chartBounds(archives) {
  const headers = [...archives.values()].map((entry) => entry.header);
  return {
    minLon: Math.min(...headers.map((h) => h.minLon)),
    minLat: Math.min(...headers.map((h) => h.minLat)),
    maxLon: Math.max(...headers.map((h) => h.maxLon)),
    maxLat: Math.max(...headers.map((h) => h.maxLat)),
    minZoom: Math.min(...headers.map((h) => h.minZoom)),
    maxZoom: Math.max(...headers.map((h) => h.maxZoom)),
    centerLon: headers[headers.length - 1].centerLon,
    centerLat: headers[headers.length - 1].centerLat,
    centerZoom: headers[headers.length - 1].centerZoom,
  };
}

async function loadDirectory(dir, fallbackId) {
  const manifest = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8"));
  const metaPath = path.join(dir, "region.json");
  const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, "utf8")) : {};
  const id = meta.id || fallbackId;
  const archives = await openArchives(
    manifest.map((entry) => ({ ...entry, file: path.join(dir, entry.file) }))
  );
  return {
    id,
    title: meta.title || (id === "channel" ? "Channel" : id),
    note: meta.note || (id === "channel" ? "Santa Barbara Channel, San Miguel to Oxnard" : ""),
    views: meta.views || (id === "channel" ? CHANNEL_VIEWS : []),
    archives,
    bounds: chartBounds(archives),
    dir,
  };
}

async function loadSingleFile(file) {
  const archives = await openArchives([{ source: "", file, maxzoom: undefined }]);
  return {
    id: "chart",
    title: "Chart",
    note: "",
    views: [],
    archives,
    bounds: chartBounds(archives),
    dir: file,
  };
}

const asked = process.argv[2];
const charts = [];
if (asked) {
  if (!existsSync(asked)) {
    console.error(`No chart archive at ${asked}. Run npm run chart --workspace @seasketch/s57`);
    process.exit(1);
  }
  charts.push(statSync(asked).isDirectory() ? await loadDirectory(asked, "channel") : await loadSingleFile(asked));
} else {
  const regionsRoot = path.join(root, ".data/enc-fixtures/regions");
  if (existsSync(regionsRoot)) {
    for (const name of readdirSync(regionsRoot).sort()) {
      const dir = path.join(regionsRoot, name);
      if (existsSync(path.join(dir, "manifest.json"))) charts.push(await loadDirectory(dir, name));
    }
  }
  const legacy = path.join(root, ".data/enc-fixtures/channel");
  if (existsSync(path.join(legacy, "manifest.json")) && !charts.some((chart) => chart.id === "channel")) {
    charts.push(await loadDirectory(legacy, "channel"));
  }
  const order = ["california", "hawaii", "florida-east", "channel"];
  charts.sort((a, b) => {
    const ai = order.indexOf(a.id);
    const bi = order.indexOf(b.id);
    return (ai === -1 ? order.length : ai) - (bi === -1 ? order.length : bi);
  });
}
if (charts.length === 0) {
  console.error("No chart archive. Run npm run chart --workspace @seasketch/s57 -- california");
  process.exit(1);
}
const byId = new Map(charts.map((chart) => [chart.id, chart]));
const single = Boolean(asked);

const assetDir = path.join(here, "../public/s57");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json",
  ".json": "application/json",
  ".png": "image/png",
  ".pbf": "application/x-protobuf",
};

function send(res, status, body, type) {
  res.writeHead(status, {
    "content-type": type,
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
  });
  res.end(body);
}

function chartFrom(url) {
  const id = url.searchParams.get("region");
  return (id && byId.get(id)) || charts[0];
}

function tileTemplate(origin, chart, sourceId) {
  if (single || !sourceId) {
    return `${origin}/tiles/${sourceId ? `${sourceId}/` : ""}{z}/{x}/{y}.mvt`;
  }
  return `${origin}/tiles/${chart.id}/${sourceId}/{z}/{x}/{y}.mvt`;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  const chart = chartFrom(url);
  if (url.pathname === "/regions.json") {
    send(
      res,
      200,
      JSON.stringify(
        charts.map((entry) => ({
          id: entry.id,
          title: entry.title,
          note: entry.note,
          views: entry.views,
        }))
      ),
      "application/json"
    );
    return;
  }
  if (url.pathname === "/style.json") {
    const origin = `http://${req.headers.host}`;
    const set = [...chart.archives.entries()].map(([id, entry]) => ({
      id,
      source: {
        tiles: [tileTemplate(origin, chart, id)],
        bounds: [entry.header.minLon, entry.header.minLat, entry.header.maxLon, entry.header.maxLat],
        minzoom: entry.header.minZoom,
        maxzoom: entry.maxzoom || entry.header.maxZoom,
      },
    }));
    const style = buildS57Style(
      set.length === 1 && !set[0].id ? set[0].source : set,
      // Mapbox only accepts a sprite URL with a scheme. A root-relative path throws.
      { sprite: `${origin}/s57/sprite` }
    );
    send(res, 200, JSON.stringify(style), "application/json");
    return;
  }
  if (url.pathname === "/chart.json") {
    const header = chart.bounds;
    send(
      res,
      200,
      JSON.stringify({
        id: chart.id,
        title: chart.title,
        note: chart.note,
        bounds: [header.minLon, header.minLat, header.maxLon, header.maxLat],
        minzoom: header.minZoom,
        maxzoom: header.maxZoom,
        center: [header.centerLon, header.centerLat, header.centerZoom],
        views: chart.views,
      }),
      "application/json"
    );
    return;
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] === "tiles") {
    let regionId = chart.id;
    let source = "";
    let z;
    let x;
    let y;
    const tail = parts.slice(1);
    const numbered = tail.filter((part) => /^\d+$/.test(part.replace(/\.mvt$/, "")));
    if (numbered.length === 3 && tail.length === 3) {
      [z, x, y] = tail.map((part) => Number(part.replace(/\.mvt$/, "")));
    } else if (numbered.length === 3 && tail.length === 4) {
      const head = tail[0];
      if (byId.has(head)) regionId = head;
      else source = head;
      [z, x, y] = tail.slice(1).map((part) => Number(part.replace(/\.mvt$/, "")));
    } else if (numbered.length === 3 && tail.length === 5) {
      regionId = tail[0];
      source = tail[1];
      [z, x, y] = tail.slice(2).map((part) => Number(part.replace(/\.mvt$/, "")));
    }
    const chosen = byId.get(regionId);
    const archive = chosen && chosen.archives.get(source);
    if (archive && z != null) {
      const tile = await archive.tiles.getZxy(z, x, y);
      if (!tile) {
        res.writeHead(204);
        res.end();
        return;
      }
      res.writeHead(200, {
        "content-type": "application/vnd.mapbox-vector-tile",
        "access-control-allow-origin": "*",
        "cache-control": "public, max-age=60",
      });
      res.end(Buffer.from(tile.data));
      return;
    }
  }
  let filePath;
  if (url.pathname.startsWith("/s57/")) {
    const rel = path.normalize(decodeURIComponent(url.pathname.slice("/s57/".length)));
    filePath = path.resolve(assetDir, rel);
    if (!filePath.startsWith(assetDir)) {
      send(res, 404, "not found", "text/plain");
      return;
    }
  } else if (url.pathname.startsWith("/vendor/")) {
    const name = path.basename(url.pathname);
    filePath = path.join(mapboxDir, "dist", name);
  } else if (url.pathname === "/" || url.pathname === "/index.html") {
    filePath = path.join(here, "index.html");
  } else {
    send(res, 404, "not found", "text/plain");
    return;
  }
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    send(res, 404, "not found", "text/plain");
    return;
  }
  const ext = path.extname(filePath);
  res.writeHead(200, {
    "content-type": types[ext] || "application/octet-stream",
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
  });
  createReadStream(filePath).pipe(res);
});

server.listen(port, () => {
  const names = charts.map((chart) => chart.id).join(", ");
  console.log(`S-57 demo http://localhost:${port}  (${names})`);
});
