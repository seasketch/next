/**
 * Side-by-side captures of the demo chart and openenc.com (Njord, an
 * open-source S-57 renderer on MapLibre) at the same camera, plus a count of
 * the rendered features by S-57 class in each. Not for navigation.
 *
 *   npm run demo --workspace @seasketch/s57      (in another terminal)
 *   npm run compare --workspace @seasketch/s57 -- [outDir] [viewFilter]
 */
import { chromium, Page } from "@playwright/test";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { COMPARE_VIEWS, CompareView } from "./compareViews";

const OURS = process.env.S57_DEMO_URL || "http://localhost:4173";
const NJORD = "https://openenc.com";
const WIDTH = 1100;
const HEIGHT = 760;

type ClassCounts = Record<string, number>;

/** Njord builds its MapLibre map inside WebAssembly. Keep a handle on it. */
const CAPTURE_NJORD_MAP = `
// tsx keeps function names with a __name helper inside page.evaluate bodies.
window.__name = (fn) => fn;
(() => {
  let real;
  Object.defineProperty(window, "maplibregl", {
    configurable: true,
    get() { return real; },
    set(value) {
      const Base = value.Map;
      value.Map = class extends Base {
        constructor(options) { super(options); window.__compareMap = this; }
      };
      real = value;
    },
  });
})();
`;

async function settle(page: Page, view: CompareView): Promise<void> {
  await page.waitForFunction(() => {
    const map = (window as unknown as { __compareMap?: { loaded(): boolean } }).__compareMap;
    return !!map && map.loaded();
  }, undefined, { timeout: 60000 });
  await page.evaluate(
    ([lng, lat, zoom]) =>
      new Promise<void>((resolve) => {
        const map = (window as unknown as { __compareMap: any }).__compareMap;
        map.jumpTo({ center: [lng, lat], zoom, bearing: 0, pitch: 0 });
        const done = () => resolve();
        map.once("idle", done);
        setTimeout(done, 30000);
      }),
    [view.lng, view.lat, view.zoom] as const
  );
  await page.waitForTimeout(400);
}

async function countClasses(page: Page, classOf: "obj" | "sourceLayer"): Promise<ClassCounts> {
  return page.evaluate((key) => {
    const map = (window as unknown as { __compareMap: any }).__compareMap;
    const seen = new Set<string>();
    const counts: Record<string, number> = {};
    for (const feature of map.queryRenderedFeatures()) {
      const props = feature.properties || {};
      const name = key === "obj" ? props.obj : feature.sourceLayer;
      if (typeof name !== "string" || !/^[A-Z_]{4,8}$/.test(name)) continue;
      const identity = `${name}|${feature.id ?? ""}|${JSON.stringify(props)}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      counts[name] = (counts[name] || 0) + 1;
    }
    return counts;
  }, classOf);
}

function slug(view: CompareView): string {
  return `${view.name}-z${view.zoom}`;
}

async function main() {
  const outDir = path.resolve(process.argv[2] || "/tmp/s57-compare");
  const filter = process.argv[3];
  const views = COMPARE_VIEWS.filter((view) => !filter || view.name.includes(filter));
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT } });
  await context.addInitScript(CAPTURE_NJORD_MAP);
  const ours = await context.newPage();
  const njord = await context.newPage();
  await ours.goto(`${OURS}/`);
  await ours.waitForFunction(() => !!(window as unknown as { map?: unknown }).map);
  await ours.evaluate(() => {
    const w = window as unknown as { map: unknown; __compareMap: unknown };
    w.__compareMap = w.map;
  });
  await njord.goto(`${NJORD}/about`);
  // Metres, so soundings and contours read the same in both captures.
  await njord.evaluate(() => localStorage.setItem("Depth", JSON.stringify("meters")));
  await njord.goto(`${NJORD}/enc?lat=${views[0].lat}&lng=${views[0].lng}&z=${views[0].zoom}`);

  const report: Array<{ view: CompareView; ours: ClassCounts; njord: ClassCounts }> = [];
  const sheet = await context.newPage();
  for (const view of views) {
    await settle(ours, view);
    await settle(njord, view);
    const oursPng = await ours.locator("#map").screenshot();
    const njordPng = await njord.locator("canvas.maplibregl-canvas").screenshot();
    const counts = {
      view,
      ours: await countClasses(ours, "obj"),
      njord: await countClasses(njord, "sourceLayer"),
    };
    report.push(counts);
    const html = `<!doctype html><body style="margin:0;font:13px sans-serif;background:#222;color:#eee">
      <div style="padding:6px 10px">${view.name} · z${view.zoom} · ${view.lat.toFixed(4)}, ${view.lng.toFixed(4)} · ${view.note || ""}</div>
      <div style="display:flex;gap:6px">
        <figure style="margin:0"><figcaption style="padding:2px 6px">SeaSketch s57</figcaption>
          <img style="width:${WIDTH / 2}px" src="data:image/png;base64,${oursPng.toString("base64")}"></figure>
        <figure style="margin:0"><figcaption style="padding:2px 6px">openenc.com (Njord)</figcaption>
          <img style="width:${WIDTH / 2}px" src="data:image/png;base64,${njordPng.toString("base64")}"></figure>
      </div></body>`;
    await sheet.setViewportSize({ width: WIDTH + 6, height: HEIGHT / 2 + 60 });
    await sheet.setContent(html);
    await sheet.screenshot({ path: path.join(outDir, `${slug(view)}.png`), fullPage: true });
    await writeFile(path.join(outDir, `${slug(view)}-ours.png`), oursPng);
    await writeFile(path.join(outDir, `${slug(view)}-njord.png`), njordPng);
    console.log(`${slug(view)}  ours ${Object.keys(counts.ours).length} classes, njord ${Object.keys(counts.njord).length}`);
  }
  await writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
  await writeFile(path.join(outDir, "report.md"), markdown(report));
  await browser.close();
}

function markdown(report: Array<{ view: CompareView; ours: ClassCounts; njord: ClassCounts }>): string {
  const lines = ["# Rendered features by S-57 class", ""];
  const missing: Record<string, string[]> = {};
  for (const { view, ours, njord } of report) {
    lines.push(`## ${slug(view)}`, "", "| class | ours | njord |", "|---|---:|---:|");
    const classes = [...new Set([...Object.keys(ours), ...Object.keys(njord)])].sort();
    for (const name of classes) {
      lines.push(`| ${name} | ${ours[name] || 0} | ${njord[name] || 0} |`);
      if (!ours[name] && njord[name]) (missing[name] ||= []).push(slug(view));
    }
    lines.push("");
  }
  lines.push("## Drawn by Njord, not by us", "", "| class | views |", "|---|---|");
  for (const [name, where] of Object.entries(missing).sort((a, b) => b[1].length - a[1].length)) {
    lines.push(`| ${name} | ${where.length}: ${where.join(", ")} |`);
  }
  return lines.join("\n") + "\n";
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
