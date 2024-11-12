/**
 * Calculates geostats or rasterInfo for a given dataset. For debugging
 * Usage:
 *
 * ts-node bin/geostats.ts <path-to-spatial-data> [output-file]
 */
import { rasterInfoForBands } from "../src/rasterInfoForBands";
import { geostatsForVectorLayers } from "../src/geostatsForVectorLayer";
import * as fs from "fs";

const filePath = process.argv[2];
const outputFile = process.argv[3];

if (!filePath) {
  console.error(
    "Usage: ts-node bin/geostats.ts <path-to-spatial-data> [output-file]"
  );
  process.exit(1);
}

async function run() {
  let stats;
  if (
    filePath.endsWith(".shp") ||
    filePath.endsWith(".geojson") ||
    filePath.endsWith(".json") ||
    filePath.endsWith(".fgb")
  ) {
    stats = await geostatsForVectorLayers(filePath);
  } else if (filePath.endsWith(".tif") || filePath.endsWith(".nc")) {
    stats = await rasterInfoForBands(filePath);
  } else {
    console.error("Unsupported file type");
    process.exit(1);
  }

  const statsJson = JSON.stringify(stats, null, 2);
  if (outputFile) {
    fs.writeFileSync(outputFile, statsJson);
    console.log(`Stats written to ${outputFile}`);
  } else {
    console.log(statsJson);
  }
}

run();
