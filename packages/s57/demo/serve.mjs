/**
 * Serves the chart demo and its archives as raw Mapbox vector tiles. Takes a
 * chart directory (one archive per scale and a manifest.json), or a single
 * archive from before charts were split by scale.
 *
 *   node demo/serve.mjs [chart-dir | chart.pmtiles] [port]
 */
import { createReadStream, existsSync, readFileSync, statSync } from "fs";
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
const archive = process.argv[2] || path.join(root, ".data/enc-fixtures/channel");
const port = Number(process.argv[3] || 4173);
if (!existsSync(archive)) {
  console.error(`No chart archive at ${archive}. Run npm run chart --workspace @seasketch/s57`);
  process.exit(1);
}

class FileBytes {
  constructor(file) {
    this.file = file;
  }
  getKey() {
    return this.file;
  }
  async getBytes(offset, length) {
    const { openSync, readSync } = await import("fs");
    const fd = openSync(this.file, "r");
    try {
      const buffer = Buffer.alloc(length);
      const read = readSync(fd, buffer, 0, length, offset);
      return { data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + read) };
    } finally {
      const { closeSync } = await import("fs");
      closeSync(fd);
    }
  }
}

const entries = statSync(archive).isDirectory()
  ? JSON.parse(readFileSync(path.join(archive, "manifest.json"), "utf8")).map((entry) => ({
      ...entry,
      file: path.join(archive, entry.file),
    }))
  : [{ source: "", file: archive }];
const archives = new Map();
for (const entry of entries) {
  const tiles = new PMTiles(new FileBytes(entry.file));
  archives.set(entry.source, { tiles, header: await tiles.getHeader() });
}
const headers = [...archives.values()].map((entry) => entry.header);
const header = {
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

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  if (url.pathname === "/style.json") {
    const origin = `http://${req.headers.host}`;
    const sourceFor = (id, h) => ({
      tiles: [`${origin}/tiles/${id ? `${id}/` : ""}{z}/{x}/{y}.mvt`],
      bounds: [h.minLon, h.minLat, h.maxLon, h.maxLat],
      minzoom: h.minZoom,
      maxzoom: h.maxZoom,
    });
    const set = [...archives.entries()].map(([id, entry]) => ({ id, source: sourceFor(id, entry.header) }));
    const style = buildS57Style(
      set.length === 1 && !set[0].id ? set[0].source : set,
      // Mapbox only accepts a sprite URL with a scheme. A root-relative path throws.
      { sprite: `${origin}/s57/sprite` }
    );
    send(res, 200, JSON.stringify(style), "application/json");
    return;
  }
  if (url.pathname === "/chart.json") {
    send(
      res,
      200,
      JSON.stringify({
        bounds: [header.minLon, header.minLat, header.maxLon, header.maxLat],
        minzoom: header.minZoom,
        maxzoom: header.maxZoom,
        center: [header.centerLon, header.centerLat, header.centerZoom],
      }),
      "application/json"
    );
    return;
  }
  const tileMatch = url.pathname.match(/^\/tiles\/(?:([a-z]+)\/)?(\d+)\/(\d+)\/(\d+)\.mvt$/);
  if (tileMatch && archives.has(tileMatch[1] || "")) {
    const z = Number(tileMatch[2]);
    const x = Number(tileMatch[3]);
    const y = Number(tileMatch[4]);
    const tile = await archives.get(tileMatch[1] || "").tiles.getZxy(z, x, y);
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
  console.log(`S-57 demo http://localhost:${port}  (${archive})`);
});
