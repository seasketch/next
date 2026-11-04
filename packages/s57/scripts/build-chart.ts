import { copyFile, readdir } from "fs/promises";
import path from "path";
import { processEncFiles } from "../src/process.js";

/**
 * Naples to the northern Channel Islands: Anacapa, Santa Cruz, Santa Rosa,
 * and San Miguel, plus the Santa Barbara Channel harbours.
 */
const CLIP: [number, number, number, number] = [-120.55, 33.85, -119.15, 34.48];

const root = path.resolve(__dirname, "../../..");
const cellsDir = path.join(root, ".data/enc-fixtures/sb-channel");
const outPath = path.join(root, ".data/enc-fixtures/channel.pmtiles");

async function main(): Promise<void> {
  const names = (await readdir(cellsDir)).filter((name) => name.endsWith(".zip")).sort();
  if (names.length === 0) {
    throw new Error(`No ENC zips in ${cellsDir}`);
  }
  const result = await processEncFiles(
    names.map((name) => path.join(cellsDir, name)),
    { clip: CLIP }
  );
  await copyFile(result.pmtilesPath, outPath);
  console.log(
    JSON.stringify(
      {
        path: outPath,
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
