import { createReadStream, existsSync, readFileSync, statSync } from "fs";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { extname, join, normalize, relative, resolve } from "path";
import { readdirSync } from "fs";

const ROOT = resolve(__dirname);
const TILES = join(ROOT, "tiles");
const PORT = Number(process.env.PORT || 8765);

function loadMapboxToken(): string {
  if (process.env.MAPBOX_ACCESS_TOKEN) return process.env.MAPBOX_ACCESS_TOKEN;
  if (process.env.REACT_APP_MAPBOX_ACCESS_TOKEN) {
    return process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;
  }
  const candidates = [
    resolve(ROOT, "../../client/.env"),
    resolve(ROOT, "../../api/.env"),
  ];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const text = readFileSync(file, "utf8");
    const match =
      text.match(/^REACT_APP_MAPBOX_ACCESS_TOKEN=(.*)$/m) ||
      text.match(/^MAPBOX_ACCESS_TOKEN=(.*)$/m);
    if (match) {
      return match[1]!.trim().replace(/^["']|["']$/g, "");
    }
  }
  throw new Error(
    "No Mapbox token found. Set MAPBOX_ACCESS_TOKEN or add it to packages/client/.env",
  );
}

const TOKEN = loadMapboxToken();

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mrt": "application/octet-stream",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function send(res: ServerResponse, status: number, body: string | Buffer, type: string) {
  res.writeHead(status, {
    "Content-Type": type,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges, Content-Length",
    "Cache-Control": type.includes("octet-stream") ? "public, max-age=3600" : "no-cache",
  });
  res.end(body);
}

function listTilesets() {
  if (!existsSync(TILES)) return [];
  return readdirSync(TILES, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(TILES, d.name, "tilejson.json")))
    .map((d) => {
      const json = JSON.parse(readFileSync(join(TILES, d.name, "tilejson.json"), "utf8"));
      return {
        id: d.name,
        name: json.name,
        bounds: json.bounds,
        minzoom: json.minzoom,
        maxzoom: json.maxzoom,
        bands: json.raster_layers?.[0]?.fields?.bands ?? [],
        layer: json.raster_layers?.[0]?.id,
        tilejson: `/tiles/${d.name}/tilejson.json`,
      };
    });
}

function rewriteTileJson(id: string, host: string) {
  const path = join(TILES, id, "tilejson.json");
  const json = JSON.parse(readFileSync(path, "utf8"));
  const origin = `http://${host}`;
  json.tiles = [`${origin}/tiles/${id}/{z}/{x}/{y}.mrt`];
  json.format = "mrt";
  json.scheme = json.scheme || "xyz";
  json.rasterLayers = json.raster_layers;
  return json;
}

function sendRange(req: IncomingMessage, res: ServerResponse, filePath: string, type: string) {
  const stat = statSync(filePath);
  const range = req.headers.range;
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length");
  res.setHeader("Content-Type", type);
  res.setHeader("Cache-Control", "public, max-age=3600");
  if (!range) {
    res.setHeader("Content-Length", stat.size);
    res.writeHead(200);
    createReadStream(filePath).pipe(res);
    return;
  }
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  if (!m) {
    res.writeHead(416);
    res.end();
    return;
  }
  // RFC 9110: last-byte-pos past EOF is clamped, not 416. Mapbox GL JS probes
  // MRT headers with Range: bytes=0-${fetchLength-1}; that window can exceed
  // a small .mrt file.
  const start = m[1] ? Number(m[1]) : 0;
  const end = m[2] ? Math.min(Number(m[2]), stat.size - 1) : stat.size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= stat.size || start > end) {
    res.setHeader("Content-Range", `bytes */${stat.size}`);
    res.writeHead(416);
    res.end();
    return;
  }
  res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
  res.setHeader("Content-Length", end - start + 1);
  res.writeHead(206);
  createReadStream(filePath, { start, end }).pipe(res);
}

function safeJoin(root: string, urlPath: string): string | null {
  const decoded = decodeURIComponent(urlPath.split("?")[0] ?? "");
  const resolved = resolve(root, "." + decoded);
  const rel = relative(root, resolved);
  if (rel.startsWith("..") || normalize(rel).startsWith("..")) return null;
  return resolved;
}

const server = createServer((req, res) => {
  const host = req.headers.host || `127.0.0.1:${PORT}`;
  const url = new URL(req.url || "/", `http://${host}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Range, Content-Type",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    });
    res.end();
    return;
  }

  if (url.pathname === "/config.js") {
    send(
      res,
      200,
      `window.MAPBOX_TOKEN = ${JSON.stringify(TOKEN)};\n`,
      "text/javascript; charset=utf-8",
    );
    return;
  }

  if (url.pathname === "/tilesets") {
    send(res, 200, JSON.stringify(listTilesets(), null, 2), "application/json; charset=utf-8");
    return;
  }

  const tilejsonMatch = url.pathname.match(/^\/tiles\/([^/]+)\/tilejson\.json$/);
  if (tilejsonMatch) {
    const id = tilejsonMatch[1]!;
    if (!existsSync(join(TILES, id, "tilejson.json"))) {
      send(res, 404, "tileset not found", "text/plain");
      return;
    }
    send(
      res,
      200,
      JSON.stringify(rewriteTileJson(id, host)),
      "application/json; charset=utf-8",
    );
    return;
  }

  const mrtMatch = url.pathname.match(/^\/tiles\/([^/]+)\/(\d+)\/(\d+)\/(\d+)\.mrt$/);
  if (mrtMatch) {
    const filePath = join(TILES, mrtMatch[1]!, mrtMatch[2]!, mrtMatch[3]!, `${mrtMatch[4]}.mrt`);
    if (!existsSync(filePath)) {
      send(res, 404, "tile not found", "text/plain");
      return;
    }
    sendRange(req, res, filePath, "application/octet-stream");
    return;
  }

  let pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = safeJoin(ROOT, pathname);
  if (!filePath || !existsSync(filePath)) {
    send(res, 404, "not found", "text/plain");
    return;
  }
  const type = MIME[extname(filePath)] || "application/octet-stream";
  send(res, 200, readFileSync(filePath), type);
});

server.listen(PORT, () => {
  const tilesets = listTilesets();
  console.log(`raster-array demos → http://127.0.0.1:${PORT}`);
  console.log(`tilesets: ${tilesets.length ? tilesets.map((t) => t.id).join(", ") : "(none yet — run npm run fixtures)"}`);
});
