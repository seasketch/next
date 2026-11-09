import { PMTiles } from "pmtiles";

// Replaced at build time with { regionId: { sourceId: "content-hash" } }.
const charts = __CHARTS__;

const archives = new Map();

// A host that ignores Range and returns the whole archive. The bytes stay in
// this worker so later tiles do not download the file again.
class BufferSource {
  constructor(buffer, key) {
    this.buffer = buffer;
    this.keyName = key;
  }
  getKey() {
    return this.keyName;
  }
  async getBytes(offset, length) {
    return { data: this.buffer.slice(offset, offset + length) };
  }
}

async function openArchive(url) {
  // One small range read tells us whether the host can serve pieces of the
  // archive. A server that ignores Range returns the whole file; keep those
  // bytes instead of downloading it again for every tile.
  const probe = await fetch(url, { headers: { range: "bytes=0-15" } });
  if (!probe.ok && probe.status !== 206) {
    throw new Error(`Archive download failed (${probe.status})`);
  }
  if (probe.status === 206) {
    await probe.arrayBuffer();
    return new PMTiles(url);
  }
  return new PMTiles(new BufferSource(await probe.arrayBuffer(), url));
}

function archiveFor(region, source) {
  const hash = charts[region] && charts[region][source];
  if (!hash) return null;
  const key = `${region}/${source}`;
  let archive = archives.get(key);
  if (!archive) {
    const url = new URL(`/charts/${region}/${source}.pmtiles?v=${hash}`, self.location.origin);
    archive = openArchive(url.href);
    archives.set(key, archive);
  }
  return archive;
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const match = new URL(event.request.url).pathname.match(
    /^\/tiles\/([a-z0-9-]+)\/([a-z0-9-]+)\/(\d+)\/(\d+)\/(\d+)\.mvt$/
  );
  if (!match) return;
  const region = match[1];
  const source = match[2];
  const z = Number(match[3]);
  const x = Number(match[4]);
  const y = Number(match[5]);
  event.respondWith(tileResponse(region, source, z, x, y));
});

async function tileResponse(region, source, z, x, y) {
  const pending = archiveFor(region, source);
  if (!pending) return new Response(null, { status: 404 });
  try {
    const archive = await pending;
    const tile = await archive.getZxy(z, x, y);
    if (!tile) return new Response(null, { status: 204 });
    return new Response(tile.data, {
      headers: {
        "content-type": "application/vnd.mapbox-vector-tile",
        "cache-control": "public, max-age=86400",
      },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "tile failed", {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}
