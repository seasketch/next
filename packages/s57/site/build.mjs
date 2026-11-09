/**
 * Assemble the static chart site into dist/.
 *
 * Tile archives live in charts/<region>/. When a local `npm run chart` has
 * written a newer copy under the repo's .data directory, that copy replaces
 * the committed one before the site is packed. The published host has no
 * .data directory, so it ships the archives committed next to this script.
 *
 * Mapbox GL 3.4 has no addProtocol, so a service worker reads each PMTiles
 * archive and answers the style's ordinary /tiles/.../*.mvt requests.
 */
import { execFile } from "child_process";
import { createHash } from "crypto";
import { createReadStream, existsSync, readdirSync, statSync } from "fs";
import { copyFile, mkdir, open, readdir, readFile, rename, rm, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { build } from "esbuild";
import { PMTiles } from "pmtiles";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const dist = path.join(here, "dist");
const chartsDir = path.join(here, "charts");
const REGION_ORDER = ["california", "hawaii", "florida-east", "channel"];

// The hosted pack has to stay under 50 MB. Harbour charts are cut at zoom 14
// and approach charts at zoom 12; the map overzooms the last tile. The local
// demo still builds the full zoom range.
const HOSTED_MAXZOOM = { approach: 13, harbour: 14 };

function run(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(new Error(`${command} ${args.join(" ")} failed: ${stderr || error.message}`));
      else resolve(stdout);
    });
  });
}

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

/** Pull archives from a local chart build when one is present. */
async function syncLocalCharts() {
  const found = [];
  const channel = path.join(repoRoot, ".data/enc-fixtures/channel");
  if (existsSync(path.join(channel, "manifest.json"))) found.push(["channel", channel]);
  const regionsRoot = path.join(repoRoot, ".data/enc-fixtures/regions");
  if (existsSync(regionsRoot)) {
    for (const name of readdirSync(regionsRoot)) {
      const dir = path.join(regionsRoot, name);
      if (existsSync(path.join(dir, "manifest.json"))) found.push([name, dir]);
    }
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

/** Drop zoom levels the hosted pack cannot carry. Archives already within the cap are left alone. */
async function capHostedArchives() {
  let names = [];
  try {
    names = (await readdir(chartsDir)).filter((name) => existsSync(path.join(chartsDir, name, "manifest.json")));
  } catch {
    return;
  }
  for (const id of names) {
    const dir = path.join(chartsDir, id);
    const manifest = JSON.parse(await readFile(path.join(dir, "manifest.json"), "utf8"));
    let changed = false;
    for (const entry of manifest) {
      const cap = HOSTED_MAXZOOM[entry.source];
      if (cap == null) continue;
      const file = path.join(dir, entry.file);
      const header = await new PMTiles(new NodeSource(file)).getHeader();
      if (header.maxZoom <= cap) continue;
      // The extension selects the format. Anything else is written as MBTiles.
      const tmp = `${file}.capped.pmtiles`;
      await run("tile-join", [
        "--force",
        "--quiet",
        "--no-tile-size-limit",
        `--maximum-zoom=${cap}`,
        "-o",
        tmp,
        file,
      ]);
      await rename(tmp, file);
      entry.maxzoom = cap;
      changed = true;
      console.log(`capped ${id}/${entry.source} at zoom ${cap}`);
    }
    if (changed) await writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  }
}

async function loadStyleBuilder() {
  const bundled = path.join(here, ".style-bundle.mjs");
  await build({
    entryPoints: [path.join(here, "../src/style.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: bundled,
    logLevel: "silent",
  });
  return import(`${pathToFileURL(bundled).href}?t=${Date.now()}`);
}

async function main() {
  await syncLocalCharts();
  await capHostedArchives();
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

  const assetDir = path.join(here, "../public/s57");
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
