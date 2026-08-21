import { existsSync, readFileSync, statSync } from "fs";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { extname, join, resolve } from "path";
import { openPmtiles } from "../../raster-array/src/pmtiles/read";

const ROOT = resolve(__dirname);
const PORT = Number(process.env.PORT || 8765);
const ARCHIVE =
  process.env.GMW_PMTILES ??
  join(ROOT, "..", "work", "dist", "gmw-global.pmtiles");

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

if (!existsSync(ARCHIVE)) {
  throw new Error(
    `Local GMW archive not found:\n  ${ARCHIVE}\nRun npm run pack in packages/data-library-gmw.`,
  );
}

const TOKEN = loadMapboxToken();
const archive = openPmtiles(ARCHIVE);
const archiveBytes = statSync(ARCHIVE).size;

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function send(
  res: ServerResponse,
  status: number,
  body: string | Buffer,
  type: string,
) {
  res.writeHead(status, {
    "Content-Type": type,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges, Content-Length",
    "Cache-Control": type.includes("octet-stream") ? "public, max-age=3600" : "no-cache",
  });
  res.end(body);
}

function tileJson(host: string) {
  const meta = archive.metadata as {
    name?: string;
    bounds?: number[];
    minzoom?: number;
    maxzoom?: number;
    raster_layers?: unknown;
    rasterLayers?: unknown;
  };
  const origin = `http://${host}`;
  return {
    ...meta,
    tiles: [`${origin}/tiles/display/{z}/{x}/{y}.mrt`],
    format: "mrt",
    scheme: "xyz",
    minzoom: meta.minzoom ?? archive.header.minZoom,
    maxzoom: meta.maxzoom ?? archive.header.maxZoom,
    raster_layers: meta.raster_layers ?? meta.rasterLayers,
    rasterLayers: meta.raster_layers ?? meta.rasterLayers,
    _bytes: archiveBytes,
    _archive: "gmw-global.pmtiles",
  };
}

function sendRangeBuffer(
  req: IncomingMessage,
  res: ServerResponse,
  buf: Buffer,
  type: string,
) {
  const range = req.headers.range;
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Content-Range, Accept-Ranges, Content-Length",
  );
  res.setHeader("Content-Type", type);
  res.setHeader("Cache-Control", "public, max-age=3600");
  if (!range) {
    res.setHeader("Content-Length", buf.length);
    res.writeHead(200);
    res.end(buf);
    return;
  }
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  if (!m) {
    res.writeHead(416);
    res.end();
    return;
  }
  const start = m[1] ? Number(m[1]) : 0;
  const end = m[2] ? Math.min(Number(m[2]), buf.length - 1) : buf.length - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= buf.length || start > end) {
    res.setHeader("Content-Range", `bytes */${buf.length}`);
    res.writeHead(416);
    res.end();
    return;
  }
  res.setHeader("Content-Range", `bytes ${start}-${end}/${buf.length}`);
  res.setHeader("Content-Length", end - start + 1);
  res.writeHead(206);
  res.end(buf.subarray(start, end + 1));
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

  if (url.pathname === "/tiles/display/tilejson.json") {
    send(res, 200, JSON.stringify(tileJson(host)), "application/json; charset=utf-8");
    return;
  }

  const mrtMatch = url.pathname.match(
    /^\/tiles\/display\/(\d+)\/(\d+)\/(\d+)\.mrt$/,
  );
  if (mrtMatch) {
    const tile = archive.getTile(
      Number(mrtMatch[1]),
      Number(mrtMatch[2]),
      Number(mrtMatch[3]),
    );
    if (!tile) {
      send(res, 404, "tile not found", "text/plain");
      return;
    }
    sendRangeBuffer(req, res, tile, "application/octet-stream");
    return;
  }

  let pathname = url.pathname;
  if (pathname === "/" || pathname === "/gmw-global.html") {
    pathname = "/index.html";
  }
  const filePath = join(ROOT, pathname.replace(/^\//, ""));
  if (!filePath.startsWith(ROOT) || !existsSync(filePath)) {
    send(res, 404, "not found", "text/plain");
    return;
  }
  const type = MIME[extname(filePath)] || "application/octet-stream";
  send(res, 200, readFileSync(filePath), type);
});

server.listen(PORT, () => {
  console.log(`GMW globe demo → http://127.0.0.1:${PORT}/gmw-global.html`);
  console.log(`archive: ${ARCHIVE} (${(archiveBytes / 1e9).toFixed(2)} GB)`);
});
