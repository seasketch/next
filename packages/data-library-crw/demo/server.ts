import { existsSync, readFileSync, statSync } from "fs";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { extname, join, resolve } from "path";
import { openPmtiles } from "../../raster-array/src/pmtiles/read";
import {
  PRODUCT_IDS,
  PRODUCTS,
  archiveFilename,
  requireProduct,
} from "../src/products";

const ROOT = resolve(__dirname);
const PORT = Number(process.env.PORT || 8767);
const DIST = join(ROOT, "..", "work", "dist");

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

type OpenArchive = {
  archive: ReturnType<typeof openPmtiles>;
  bytes: number;
  path: string;
};

const archives = new Map<string, OpenArchive>();
for (const id of PRODUCT_IDS) {
  const path = join(DIST, archiveFilename(requireProduct(id)));
  if (!existsSync(path)) continue;
  archives.set(id, {
    archive: openPmtiles(path),
    bytes: statSync(path).size,
    path,
  });
}

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

function tileJson(host: string, productId: string) {
  const opened = archives.get(productId);
  if (!opened) throw new Error(`local archive is not available for ${productId}`);
  const meta = opened.archive.metadata as {
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
    // Archive size as a version param: rebuilt archives get new tile URLs so
    // the demo service worker's in-memory bodies can never go stale.
    tiles: [`${origin}/tiles/${productId}/{z}/{x}/{y}.mrt?v=${opened.bytes}`],
    format: "mrt",
    scheme: "xyz",
    minzoom: meta.minzoom ?? opened.archive.header.minZoom,
    maxzoom: meta.maxzoom ?? opened.archive.header.maxZoom,
    raster_layers: meta.raster_layers ?? meta.rasterLayers,
    rasterLayers: meta.raster_layers ?? meta.rasterLayers,
    _bytes: opened.bytes,
    _archive: archiveFilename(requireProduct(productId)),
  };
}

function sendRangeBuffer(
  req: IncomingMessage,
  res: ServerResponse,
  buf: Buffer,
  type: string,
  etag?: string,
) {
  const range = req.headers.range;
  if (etag) {
    res.setHeader("ETag", etag);
    if (!range && req.headers["if-none-match"] === etag) {
      res.writeHead(304);
      res.end();
      return;
    }
  }
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
  // Honor ranges exactly (partial mode). Serving the whole tile on the byte-0
  // header probe flips GL JS into `entireBuffer` mode, which front-loads every
  // band of every visible tile — ~200 MB for a z3 viewport of daily DHW. With
  // 30-day blocks the pay-as-you-scrub partial mode is the right trade.
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
    const catalog = PRODUCT_IDS.map((id) => ({
      id,
      title: PRODUCTS[id].title,
      shortTitle: PRODUCTS[id].shortTitle,
      cadence: PRODUCTS[id].cadence,
    }));
    send(
      res,
      200,
      `window.MAPBOX_TOKEN = ${JSON.stringify(TOKEN)};\n` +
        `window.CRW = ${JSON.stringify({
          products: catalog,
          localProducts: [...archives.keys()],
        })};\n`,
      "text/javascript; charset=utf-8",
    );
    return;
  }

  const tilejsonMatch = url.pathname.match(/^\/tiles\/([a-z0-9-]+)\/tilejson\.json$/);
  if (tilejsonMatch) {
    const productId = tilejsonMatch[1]!;
    if (!archives.has(productId)) {
      send(
        res,
        404,
        `Local crw-${productId}-v1.pmtiles not found. Open ?src=remote or run npm run pack.`,
        "text/plain",
      );
      return;
    }
    send(res, 200, JSON.stringify(tileJson(host, productId)), "application/json; charset=utf-8");
    return;
  }

  const mrtMatch = url.pathname.match(
    /^\/tiles\/([a-z0-9-]+)\/(\d+)\/(\d+)\/(\d+)\.mrt$/,
  );
  if (mrtMatch) {
    const opened = archives.get(mrtMatch[1]!);
    if (!opened) {
      send(res, 404, "tile not found", "text/plain");
      return;
    }
    const tile = opened.archive.getTile(
      Number(mrtMatch[2]),
      Number(mrtMatch[3]),
      Number(mrtMatch[4]),
    );
    if (!tile) {
      send(res, 404, "tile not found", "text/plain");
      return;
    }
    // A validator lets Chrome satisfy Mapbox's Range requests from a
    // prefetched full-body cache entry instead of hitting the network.
    const etag = `"${opened.bytes}-${mrtMatch[2]}-${mrtMatch[3]}-${mrtMatch[4]}-${tile.length}"`;
    sendRangeBuffer(req, res, tile, "application/octet-stream", etag);
    return;
  }

  let pathname = url.pathname;
  if (pathname === "/" || pathname === "/index.html") {
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
  const local = [...archives.keys()];
  console.log(`CRW demo → http://127.0.0.1:${PORT}/`);
  if (local.length) {
    console.log(`local archives: ${local.join(", ")}`);
  } else {
    console.log("no local archives; use ?src=remote after upload");
  }
});
