// Takes an input cell csv file and downsamples it to multiple h3resolutions based on the Stop configuration, ultimately creating a pmtiles archive that can be used to base filtering visualizations on.
import * as h3 from "h3-js";
import * as gdal from "gdal-async";
import { createReadStream, readdirSync, readFileSync } from "node:fs";
import * as cliProgress from "cli-progress";
import { stops } from "./src/stops";
import { execSync } from "node:child_process";

const MIN_ZOOM = 0;

const usage = `
npx ts-node build-cell-pmtiles.ts <path-to-cells.csv> <path-to-output.pmtiles>
`;

const filePath = process.argv[2];
if (!filePath) {
  console.error("Missing path to cells csv");
  console.error(usage);
  process.exit(1);
}

const outputPath = process.argv[3];
if (!outputPath) {
  console.error("Missing path to output pmtiles");
  console.error(usage);
  process.exit(1);
}

const MIN_RESOLUTION = 6;

(async () => {
  // First, for each stop build a flatgeobuf file
  const cells = new Set<string>();
  for (const stop of stops) {
    const parents = new Set<string>();
    const isFirstStop = stops.indexOf(stop) === 0;
    if (isFirstStop) {
      console.log("First stop, reading cells from input file");
      // read the input file line-by-line. There are no columns so we
      // don't need a csv parser
      const stream = createReadStream(filePath);
      for await (const line of stream) {
        const ids = line
          .toString()
          .trim()
          .split("\n")
          .map((id: string) => id.trim());
        for (const id of ids) {
          cells.add(id);
        }
      }
      console.log(
        `Starting processing with ${cells.size.toLocaleString()} cells`
      );
    }
    const driver = gdal.drivers.get("FlatGeobuf");
    const ds = driver.create(`output/cells-${stop.h3Resolution}.fgb`);
    const layer = ds.layers.create(
      "cells",
      gdal.SpatialReference.fromEPSG(4326),
      gdal.wkbPolygon
    );
    layer.fields.add(new gdal.FieldDefn("id", gdal.OFTString));
    layer.fields.add(new gdal.FieldDefn("r0_id", gdal.OFTString));
    layer.fields.add(new gdal.FieldDefn("r1_id", gdal.OFTString));
    layer.fields.add(new gdal.FieldDefn("r2_id", gdal.OFTString));
    layer.fields.add(new gdal.FieldDefn("r3_id", gdal.OFTString));
    layer.fields.add(new gdal.FieldDefn("r4_id", gdal.OFTString));
    layer.fields.add(new gdal.FieldDefn("r5_id", gdal.OFTString));
    layer.fields.add(new gdal.FieldDefn("r6_id", gdal.OFTString));
    layer.fields.add(new gdal.FieldDefn("r7_id", gdal.OFTString));
    layer.fields.add(new gdal.FieldDefn("r8_id", gdal.OFTString));
    layer.fields.add(new gdal.FieldDefn("r9_id", gdal.OFTString));
    layer.fields.add(new gdal.FieldDefn("r10_id", gdal.OFTString));
    const progressBar = new cliProgress.SingleBar(
      {
        format: `cells-${stop.h3Resolution}.fgb | {bar} | {percentage}% | {eta}s || {value}/{total} cells processed`,
      },
      cliProgress.Presets.shades_classic
    );
    progressBar.start(cells.size, 0);
    cells.forEach((cell) => {
      const id = cell;
      try {
        const parent_id = h3.cellToParent(id, stop.h3Resolution - 1);
        const multipolygon = h3.cellsToMultiPolygon([id], true);
        const feature = new gdal.Feature(layer);
        feature.setGeometry(
          gdal.Geometry.fromGeoJson({
            type: "Polygon",
            coordinates: multipolygon[0],
          })
        );
        feature.fields.set("id", id);
        for (const r of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
          if (r < stop.h3Resolution) {
            feature.fields.set(`r${r}_id`, h3.cellToParent(id, r));
          }
        }
        parents.add(parent_id);
        layer.features.add(feature);
        progressBar.increment();
      } catch (e: any) {
        console.log(id, stop.h3Resolution);
        throw new Error(`Error processing cell ${id}: ${e.message}`);
      }
    });
    ds.close();
    progressBar.stop();
    cells.clear();
    parents.forEach((parent) => cells.add(parent));
    console.log(`create tiles for r${stop.h3Resolution}, z${stop.zoomLevel}`);
    const maxZoom = stop.zoomLevel;
    let minZoom = maxZoom;
    const nextStop = stops[stops.indexOf(stop) + 1];
    if (nextStop) {
      minZoom = nextStop.zoomLevel + 1;
    } else {
      minZoom = MIN_ZOOM;
    }
    const resolution = stop.h3Resolution;

    execSync(
      `tippecanoe --force -l cells -z ${maxZoom} -Z ${minZoom} -o output/cells-${resolution}-z${minZoom}-z${maxZoom}.pmtiles output/cells-${resolution}.fgb`
    );
  }
})();
