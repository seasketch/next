import * as gdal from "gdal-async";
import * as h3 from "h3-js";
import { writeFileSync } from "fs";
import * as cliProgress from "cli-progress";

// Reads features (any type) from the given spatial dataset and returns
// only the h3 cell ids.

// Expects three arguments:
// 1. The path to the spatial dataset.
// 2. The output csv file path.
// 3. (Optional) the attribute name to use as the h3 cell id

const usage = `Usage: npx ts-node build-cell-ids.ts path/to/spatial-dataset path/to/output.csv [attributeName]`;

const filePath = process.argv[2];
if (!filePath) {
  console.error("Please provide a file path");
  console.error(usage);
  process.exit(1);
}

const outputFilePath = process.argv[3] || "output/cell-ids.csv";
if (!outputFilePath) {
  console.error("Please provide an output file path");
  console.error(usage);
  process.exit(1);
}

const attributeName = process.argv[4] || "GRID_ID";

const ds = gdal.openAsync(filePath).then((ds) => {
  const layer = ds.layers.get(0);
  const featureCount = layer.features.count();
  const progress = new cliProgress.SingleBar(
    {},
    cliProgress.Presets.shades_classic
  );
  progress.setTotal(featureCount);
  progress.start(featureCount, 0);
  const cellIds = layer.features.map((feature) => {
    progress.increment();
    const cellId = feature.fields.get(attributeName);
    // check if it is a valid h3 cell id
    if (!h3.isValidCell(cellId)) {
      console.error(
        `Invalid h3 cell id: ${cellId}. Using attribute name: ${attributeName}`
      );
      process.exit(1);
    }
    return cellId;
  });

  progress.stop();

  const csv = cellIds.join("\n");

  writeFileSync(outputFilePath, csv);
  console.log(`Cell ids written to ${outputFilePath}`);
});
