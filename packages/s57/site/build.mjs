/**
 * Assemble the static chart site into public/. The host looks for that
 * directory name after the build. vercel.json names it too.
 *
 * The publish host uploads this folder alone and then runs `npm run build`.
 * The style sources in chart-style/ and the sprites in assets/s57 are copies
 * of the package sources, refreshed below when this script can see them.
 * Tile archives live in charts/<region>/. A local chart build under the
 * repo's .data directory replaces the committed copy. The host has neither
 * the package sources nor .data, so it ships what is committed here.
 *
 * Archives are copied whole. California and Florida at full zoom are each
 * larger than the host's 50 MB limit, so the published chart is the Santa
 * Barbara Channel and Hawaii, both through harbour zoom 16. The local demo
 * still builds every region.
 *
 * Mapbox GL 3.4 has no addProtocol, so a service worker reads each PMTiles
 * archive and answers the style's ordinary /tiles/.../*.mvt requests.
 */
import { createHash } from "crypto";
import { createReadStream, existsSync, readdirSync, statSync } from "fs";
import { copyFile, mkdir, open, readdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { build } from "esbuild";
import { PMTiles } from "pmtiles";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const dist = path.join(here, "public");
const chartsDir = path.join(here, "charts");
const REGION_ORDER = ["channel", "hawaii", "california", "florida-east"];

// Complete archives only. Channel is about 6 MB and Hawaii about 21 MB.
// California's harbour archive alone is 48 MB, and Florida's is 43 MB.
const HOSTED_REGIONS = new Set(["channel", "hawaii"]);

class NodeSource {
  constructor(file) {
    this.file = file;
  }
  getKey() {
    return this.file;
  }
  async getBytes(offset, length) {
    const handle = await open(this.file, "r");
    try {
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await handle.read(buffer, 0, length, offset);
      return { data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + bytesRead) };
    } finally {
      await handle.close();
    }
  }
}

function fileHash(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(file)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => resolve(hash.digest("hex").slice(0, 12)))
      .on("error", reject);
  });
}

function sortRegions(ids) {
  return [...ids].sort((a, b) => {
    const ai = REGION_ORDER.indexOf(a);
    const bi = REGION_ORDER.indexOf(b);
    return (ai === -1 ? REGION_ORDER.length : ai) - (bi === -1 ? REGION_ORDER.length : bi);
  });
}

/** Pull the hosted region's archives from a local chart build when one is present. */
async function syncLocalCharts() {
  const found = [];
  const channel = path.join(repoRoot, ".data/enc-fixtures/channel");
  if (HOSTED_REGIONS.has("channel") && existsSync(path.join(channel, "manifest.json"))) {
    found.push(["channel", channel]);
  }
  const regionsRoot = path.join(repoRoot, ".data/enc-fixtures/regions");
  if (existsSync(regionsRoot)) {
    for (const name of readdirSync(regionsRoot)) {
      if (!HOSTED_REGIONS.has(name)) continue;
      const dir = path.join(regionsRoot, name);
      if (existsSync(path.join(dir, "manifest.json"))) found.push([name, dir]);
    }
  }
  let names = [];
  try {
    names = await readdir(chartsDir);
  } catch {
    names = [];
  }
  for (const name of names) {
    if (!HOSTED_REGIONS.has(name)) await rm(path.join(chartsDir, name), { recursive: true, force: true });
  }
  for (const [id, dir] of found) {
    const dest = path.join(chartsDir, id);
    await rm(dest, { recursive: true, force: true });
    await mkdir(dest, { recursive: true });
    for (const name of readdirSync(dir)) {
      const from = path.join(dir, name);
      if (!statSync(from).isFile()) continue;
      await copyFile(from, path.join(dest, name));
    }
    console.log(`synced ${id} from ${dir}`);
  }
}

/** Copy the style and sprites into this folder when the package sources are present. */
async function refreshVendoredSources() {
  const styleSrc = path.join(here, "../src/style.ts");
  const revealSrc = path.join(here, "../src/reveal.ts");
  if (existsSync(styleSrc) && existsSync(revealSrc)) {
    const chartStyle = path.join(here, "chart-style");
    await mkdir(chartStyle, { recursive: true });
    await copyFile(styleSrc, path.join(chartStyle, "style.ts"));
    await copyFile(revealSrc, path.join(chartStyle, "reveal.ts"));
  }
  const publicS57 = path.join(here, "../public/s57");
  if (existsSync(publicS57)) {
    const assets = path.join(here, "assets/s57");
    await rm(assets, { recursive: true, force: true });
    await copyTree(publicS57, assets);
  }
}

async function loadStyleBuilder() {
  const entry = path.join(here, "chart-style/style.ts");
  if (!existsSync(entry)) {
    throw new Error("packages/s57/site/chart-style/style.ts is missing. Build the site from the repo once so the style is copied in.");
  }
  const bundled = path.join(here, ".style-bundle.mjs");
  await build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: bundled,
    logLevel: "silent",
  });
  return import(`${pathToFileURL(bundled).href}?t=${Date.now()}`);
}

async function main() {
  await refreshVendoredSources();
  await syncLocalCharts();
  let names;
  try {
    names = (await readdir(chartsDir)).filter((name) => existsSync(path.join(chartsDir, name, "manifest.json")));
  } catch {
    names = [];
  }
  if (names.length === 0) {
    throw new Error(
      "No chart archives in packages/s57/site/charts. Run npm run chart --workspace @seasketch/s57 first."
    );
  }

  const { buildS57Style } = await loadStyleBuilder();
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });

  const mapboxDir = path.join(here, "node_modules/mapbox-gl/dist");
  await mkdir(path.join(dist, "vendor"), { recursive: true });
  await copyFile(path.join(mapboxDir, "mapbox-gl.js"), path.join(dist, "vendor/mapbox-gl.js"));
  await copyFile(path.join(mapboxDir, "mapbox-gl.css"), path.join(dist, "vendor/mapbox-gl.css"));

  const assetDir = path.join(here, "assets/s57");
  if (!existsSync(assetDir)) {
    throw new Error("packages/s57/site/assets/s57 is missing. Build the site from the repo once so the sprites are copied in.");
  }
  await copyTree(assetDir, path.join(dist, "s57"));

  const listed = [];
  const swCharts = {};
  for (const id of sortRegions(names)) {
    const dir = path.join(chartsDir, id);
    const manifest = JSON.parse(await readFile(path.join(dir, "manifest.json"), "utf8"));
    const meta = JSON.parse(await readFile(path.join(dir, "region.json"), "utf8"));
    const archives = [];
    let west = Infinity;
    let south = Infinity;
    let east = -Infinity;
    let north = -Infinity;
    let minZoom = Infinity;
    let maxZoom = 0;
    swCharts[id] = {};
    const outDir = path.join(dist, "charts", id);
    await mkdir(outDir, { recursive: true });
    for (const entry of manifest) {
      const file = path.join(dir, entry.file);
      const archive = new PMTiles(new NodeSource(file));
      const header = await archive.getHeader();
      if (header.tileType !== 1) throw new Error(`${id}/${entry.file} is not a vector archive`);
      west = Math.min(west, header.minLon);
      south = Math.min(south, header.minLat);
      east = Math.max(east, header.maxLon);
      north = Math.max(north, header.maxLat);
      minZoom = Math.min(minZoom, header.minZoom);
      maxZoom = Math.max(maxZoom, header.maxZoom);
      swCharts[id][entry.source] = await fileHash(file);
      await copyFile(file, path.join(outDir, entry.file));
      archives.push({
        id: entry.source,
        source: {
          tiles: [`/tiles/${id}/${entry.source}/{z}/{x}/{y}.mvt`],
          bounds: [header.minLon, header.minLat, header.maxLon, header.maxLat],
          minzoom: header.minZoom,
          maxzoom: header.maxZoom,
        },
      });
    }
    const style = buildS57Style(archives, {
      sprite: "https://charts.invalid/s57/sprite",
      glyphs: "https://charts.invalid/s57/font/{fontstack}/{range}.pbf",
    });
    await writeFile(path.join(outDir, "style.json"), JSON.stringify(style));
    const chart = {
      id,
      title: meta.title || id,
      note: meta.note || "",
      bounds: [west, south, east, north],
      minzoom: minZoom,
      maxzoom: maxZoom,
      views: meta.views || [],
    };
    await writeFile(path.join(outDir, "chart.json"), JSON.stringify(chart));
    listed.push({ id, title: chart.title, note: chart.note, views: chart.views });
    console.log(`${id}: ${archives.length} archives, zoom ${minZoom}-${maxZoom}`);
  }
  await writeFile(path.join(dist, "regions.json"), JSON.stringify(listed));

  await build({
    entryPoints: [path.join(here, "sw.js")],
    bundle: true,
    format: "iife",
    platform: "browser",
    outfile: path.join(dist, "sw.js"),
    define: { __CHARTS__: JSON.stringify(swCharts) },
    logLevel: "silent",
  });
  const swVersion = await fileHash(path.join(dist, "sw.js"));
  const app = (await readFile(path.join(here, "app.js"), "utf8")).replaceAll("__SW_VERSION__", swVersion);
  await writeFile(path.join(dist, "app.js"), app);
  const appVersion = await fileHash(path.join(dist, "app.js"));
  const html = (await readFile(path.join(here, "index.html"), "utf8")).replaceAll("__APP_VERSION__", appVersion);
  await writeFile(path.join(dist, "index.html"), html);
  console.log(`site ready in ${dist}`);
}

async function copyTree(from, to) {
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) await copyTree(source, dest);
    else if (entry.isFile()) await copyFile(source, dest);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
