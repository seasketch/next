import { readFileSync, existsSync } from "node:fs";
import * as sqlite from "sqlite3";
import * as h3 from "h3-js";
import * as gdal from "gdal-async";
import * as cliProgress from "cli-progress";

const SKIP_EXISTING = true;

const driver = gdal.drivers.get("FlatGeobuf");

// argument 1 should be an attributes.json file
const attrsPath = process.argv[2];
// ensure the file exists
const data = readFileSync(attrsPath, "utf8");
// parse the json
const attributes = JSON.parse(data);
// third argument should be a path to the output database
const dbPath = process.argv[3];
// ensure argument is passed
if (!dbPath) {
  console.error(
    "Please provide a path to the output database.\nUsage: npx ts-node build-cell-id-table.ts path/to/attributes.json path/to/output.sqlite"
  );
  process.exit(1);
}

const sortedValues: { [attribute: string]: string[] } = {};
for (const field of attributes.filter(
  (a: any) => a.type === "string" && a.values
)) {
  sortedValues[field.attribute] = Object.keys(field.values).sort();
}

const MIN_RESOLUTION = 6;
const ORIGINAL_CELL_IDS = new Set<string>();

const db = new sqlite.Database(dbPath);

function run(statement: string, values: any[]) {
  return new Promise((resolve, reject) => {
    db.run(statement, values, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(true);
      }
    });
  });
}

// create cells table if not exists
const createTable = `CREATE TABLE IF NOT EXISTS downsampled_cells (
  id TEXT NOT NULL PRIMARY KEY,
  resolution INTEGER NOT NULL
)`;

run(createTable, []).then(async () => {
  function all(statement: string, values: any[]) {
    return new Promise<any[]>((resolve, reject) => {
      db.all(statement, values, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
  function each(statement: string, values: any[], forEach: (row: any) => void) {
    return new Promise<void>((resolve, reject) => {
      db.each(
        statement,
        values,
        (err: Error, row: any) => {
          if (err) {
            reject(err);
          } else {
            forEach(row);
          }
        },
        resolve
      );
    });
  }

  const d = await all("SELECT id FROM cells limit 1", []);
  const id = d[0].id;
  if (!id) {
    console.error("No cells found in database");
    process.exit(1);
  }
  const MAX_RESOLUTION = h3.getResolution(id);
  // collect all max resolution cells to begin
  await each("SELECT id FROM cells", [], (row) => {
    ORIGINAL_CELL_IDS.add(row.id);
  });
  let resolution = MAX_RESOLUTION;

  function get(sql: string, bindings: any[]) {
    return new Promise<any>((resolve, reject) => {
      db.get(sql, bindings, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }
  // for each resolution, insert cells
  while (resolution >= MIN_RESOLUTION) {
    const idSet =
      resolution === MAX_RESOLUTION ? ORIGINAL_CELL_IDS : new Set<string>();
    if (resolution < h3.getResolution(id)) {
      console.log(`Calculating parent cells at resolution ${resolution}`);
      for (const id of Array.from(ORIGINAL_CELL_IDS)) {
        idSet.add(h3.cellToParent(id, resolution));
      }
    }

    // First, check if the output fgb file already exists, and skip if it does
    if (SKIP_EXISTING && existsSync(`output/cells-${resolution}.fgb`)) {
      console.log(
        `Skipping resolution ${resolution} because output file already exists`
      );
      resolution--;
      continue;
    }

    console.log(
      `Create FGB with ${idSet.size} cell ids at resolution ${resolution}`
    );
    const ds = driver.create(`output/cells-${resolution}.fgb`);
    const layer = ds.layers.create(
      "cells",
      gdal.SpatialReference.fromEPSG(4326),
      gdal.wkbPolygon
    );

    let i = 0;
    layer.fields.add(new gdal.FieldDefn("id", gdal.OFTReal));
    layer.fields.add(new gdal.FieldDefn("index", gdal.OFTString));

    for (const field of attributes) {
      if (field.attribute === "id") {
        continue;
      }
      if (field.type === "number") {
        layer.fields.add(
          new gdal.FieldDefn(field.attribute + "_min", gdal.OFTReal)
        );
        layer.fields.add(
          new gdal.FieldDefn(field.attribute + "_max", gdal.OFTReal)
        );
      } else if (field.type === "boolean") {
        layer.fields.add(new gdal.FieldDefn(field.attribute, gdal.OFTReal));
      } else if (field.type === "string") {
        if (!field.values) {
          console.warn(`Skipping ${field.attribute} due to missing values`);
          continue;
        } else if (Object.keys(field.values).length > 16) {
          console.warn(`Skipping ${field.attribute} due to too many values`);
          continue;
        } else {
          layer.fields.add(new gdal.FieldDefn(field.attribute, gdal.OFTReal));
        }
      }
    }

    const progressBar = new cliProgress.SingleBar(
      {
        format: `resolution ${resolution} | {bar} | {percentage}% | {eta}s || {value}/{total} cells processed`,
      },
      cliProgress.Presets.shades_classic
    );
    progressBar.start(idSet.size, 0);
    for (const id of Array.from(idSet)) {
      if (resolution === MAX_RESOLUTION) {
        const data = await get(
          `
        select id, ${attributes
          .filter((attr: any) => attr.attribute !== "id")
          .map((attr: any) => attr.attribute)
          .join(", ")} from cells where id = ?
      `,
          [id]
        );
        // console.log(data);
        const feature = new gdal.Feature(layer);
        const polygon = h3.cellsToMultiPolygon([id], true)[0];
        feature.setGeometry(
          gdal.Geometry.fromGeoJson({
            type: "Polygon",
            coordinates: polygon,
          })
        );
        feature.fields.set("id", i);
        feature.fields.set("index", id);
        for (const field of attributes) {
          if (field.attribute === "id") {
            continue;
          }
          if (field.type === "number") {
            feature.fields.set(field.attribute + "_min", data[field.attribute]);
            feature.fields.set(field.attribute + "_max", data[field.attribute]);
          } else if (field.type === "boolean") {
            const value = data[field.attribute];
            if (value === null) {
              feature.fields.set(field.attribute, null);
            } else if (value) {
              feature.fields.set(field.attribute, 1);
            } else {
              feature.fields.set(field.attribute, 0);
            }
          } else if (field.type === "string") {
            if (!field.values) {
              // console.warn(`Skipping ${field.attribute} due to missing values`);
              continue;
            } else if (Object.keys(field.values).length > 16) {
              // console.warn(`Skipping ${field.attribute} due to too many values`);
              continue;
            } else {
              feature.fields.set(
                field.attribute,
                encodeArray(
                  [data[field.attribute]],
                  sortedValues[field.attribute]
                )
              );
            }
          }
        }
        layer.features.add(feature);
      } else {
        const childIds = h3.cellToChildren(id, MAX_RESOLUTION);
        const data = await get(
          `
          select ${attributes
            .filter((attr: any) => attr.attribute !== "id")
            .map((attr: any) => {
              if (attr.type === "number") {
                return `min(${attr.attribute}) as ${attr.attribute}_min, max(${attr.attribute}) as ${attr.attribute}_max`;
              } else if (attr.type === "boolean") {
                return `json_group_array(distinct(${attr.attribute})) as ${attr.attribute}`;
              } else if (attr.type === "string") {
                return `json_group_array(distinct(${attr.attribute})) as ${attr.attribute}`;
              }
            })
            .join(", ")} from cells where id in (${childIds
            .map(() => "?")
            .join(",")})
          `,
          childIds
        );
        const feature = new gdal.Feature(layer);
        const polygon = h3.cellsToMultiPolygon([id], true)[0];
        feature.setGeometry(
          gdal.Geometry.fromGeoJson({
            type: "Polygon",
            coordinates: polygon,
          })
        );
        feature.fields.set("id", i);
        feature.fields.set("index", id);
        for (const field of attributes) {
          if (field.attribute === "id") {
            continue;
          }
          if (field.type === "number") {
            feature.fields.set(
              field.attribute + "_min",
              data[field.attribute + "_min"]
            );
            feature.fields.set(
              field.attribute + "_max",
              data[field.attribute + "_max"]
            );
          } else if (field.type === "boolean") {
            const values = JSON.parse(data[field.attribute]).filter(
              (v: any) => typeof v === "number"
            );
            // should be a set of 0, 1, and/or null
            if (values.length === 1 && values[0] === 1) {
              feature.fields.set(field.attribute, 1);
            } else if (values.length === 1 && values[0] === 0) {
              feature.fields.set(field.attribute, 0);
            } else if (values.length === 2) {
              feature.fields.set(field.attribute, 2);
            } else {
              feature.fields.set(field.attribute, null);
            }
          } else if (field.type === "string") {
            const strings = JSON.parse(data[field.attribute]);
            feature.fields.set(
              field.attribute,
              encodeArray(strings, sortedValues[field.attribute])
            );
          }
        }
        layer.features.add(feature);
      }
      i++;
      progressBar.update(i);
    }
    ds.close();
    progressBar.update(idSet.size);
    progressBar.stop();
    resolution--;
  }
});

function encodeArray(arr: string[], sortedStrings: string[]): number {
  let encoded = 0;
  arr.forEach((str) => {
    const index = sortedStrings.indexOf(str);
    if (index !== -1) {
      encoded |= 1 << index;
    }
  });
  return encoded;
}

// Decode function
function decodeInteger(encoded: number, sortedStrings: string[]): string[] {
  return sortedStrings.filter((_, index) => (encoded & (1 << index)) !== 0);
}
