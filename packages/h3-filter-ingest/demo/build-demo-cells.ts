import { readFileSync, createWriteStream } from "node:fs";
import * as h3 from "h3-js";

const RESOLUTION = 11;

// Note that the number of cells is likely limited to 16,777,217 due to
// limitations in Node.js
const allCells = new Set<string>();

const data = JSON.parse(readFileSync("./input/footprint-singlepart.geojson", "utf-8"));
for (const feature of data.features) {
  const cells = h3.polygonToCells(feature.geometry.coordinates[0], RESOLUTION, true);
  cells.forEach(cell => allCells.add(cell));
}

// for each cell, stream out id to a newline delimited file
const output = createWriteStream("./output/cells.csv");
Array.from(allCells).forEach(cell => output.write(cell + "\n"));
output.end();

console.log(`Wrote ${allCells.size.toLocaleString()} cells to output/cells.csv`);
