import { copyFile, mkdir, rm, writeFile } from "fs/promises";
import path from "path";
import { processEncFiles } from "../src/process.js";
import { ChartManifest } from "./channel.js";
import { fetchRegionCells } from "./fetch-chart.js";
import { chartRegion, regionChartDir } from "./regions.js";

async function main(): Promise<void> {
  const region = chartRegion(process.argv[2]);
  const cells = await fetchRegionCells(region);
  const started = Date.now();
  const result = await processEncFiles(cells, {
    clip: region.clip,
    onProgress: (message) => console.log(`[${Math.round((Date.now() - started) / 1000)}s] ${message}`),
  });
  const chartDir = regionChartDir(region.id);
  await rm(chartDir, { recursive: true, force: true });
  await mkdir(chartDir, { recursive: true });
  const manifest: ChartManifest = [];
  for (const archive of result.archives) {
    const file = `${archive.source}.pmtiles`;
    await copyFile(archive.pmtilesPath, path.join(chartDir, file));
    await rm(archive.pmtilesPath, { force: true });
    manifest.push({ source: archive.source, maxzoom: archive.maxzoom, file });
  }
  await writeFile(path.join(chartDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  await writeFile(
    path.join(chartDir, "region.json"),
    JSON.stringify(
      { id: region.id, title: region.title, note: region.note, clip: region.clip, views: region.views },
      null,
      2
    )
  );
  console.log(
    JSON.stringify(
      {
        region: region.id,
        dir: chartDir,
        archives: manifest,
        features: result.featureCount,
        bounds: result.bounds,
        cells: result.cells.map((cell) => cell.cell),
      },
      null,
      2
    )
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
