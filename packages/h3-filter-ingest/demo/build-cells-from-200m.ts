import { readFileSync, createWriteStream } from "node:fs";
import * as h3 from "h3-js";
import * as gdal from "gdal-async";

const RESOLUTION = 9;

const ds = gdal.open("./input/200m-grid.fgb");

const layer = ds.layers.get(0);

const output = createWriteStream("./output/200m-cells.csv");

output.write("id");
layer.fields.forEach((field) => {
  output.write(",");
  output.write(field.name);
});

output.write("\n");

layer.features.forEach((feature) => {
  const geom = feature.getGeometry();
  const centroid = geom.centroid();
  const cell = h3.latLngToCell(centroid.y, centroid.x, RESOLUTION);
  output.write(cell);
  layer.fields.forEach((field) => {
    output.write(",");
    let value = feature.fields.get(field.name).toString();
    if (value === "Y") {
      value = "TRUE";
    } else if (value === "N") {
      value = "FALSE";
    } else if (value === "-999") {
      value = "";
    }
    output.write(value);
  });
  output.write("\n");
});
output.end();

console.log(
  `Wrote ${layer.features
    .count()
    .toLocaleString()} cells to output/200m-cells.csv`
);
