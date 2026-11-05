import { copyFile, mkdir, rm, writeFile } from "fs/promises";
import path from "path";
import { processEncFiles } from "../src/process.js";
import { CHANNEL_CLIP, ChartManifest, channelChartDir } from "./channel.js";
import { fetchChannelCells } from "./fetch-chart.js";

async function main(): Promise<void> {
  const cells = await fetchChannelCells();
  const started = Date.now();
  const result = await processEncFiles(cells, {
    clip: CHANNEL_CLIP,
    onProgress: (message) => console.log(`[${Math.round((Date.now() - started) / 1000)}s] ${message}`),
  });
  await rm(channelChartDir, { recursive: true, force: true });
  await mkdir(channelChartDir, { recursive: true });
  const manifest: ChartManifest = [];
  for (const archive of result.archives) {
    const file = `${archive.source}.pmtiles`;
    await copyFile(archive.pmtilesPath, path.join(channelChartDir, file));
    await rm(archive.pmtilesPath, { force: true });
    manifest.push({ source: archive.source, maxzoom: archive.maxzoom, file });
  }
  await writeFile(path.join(channelChartDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(
    JSON.stringify(
      {
        dir: channelChartDir,
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
