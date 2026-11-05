import { copyFile } from "fs/promises";
import { processEncFiles } from "../src/process.js";
import { CHANNEL_CLIP, channelArchivePath } from "./channel.js";
import { fetchChannelCells } from "./fetch-chart.js";

async function main(): Promise<void> {
  const cells = await fetchChannelCells();
  const result = await processEncFiles(cells, { clip: CHANNEL_CLIP });
  await copyFile(result.pmtilesPath, channelArchivePath);
  console.log(
    JSON.stringify(
      {
        path: channelArchivePath,
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
