/**
 * Takes an input cell csv file and downsamples it to multiple h3 resolutions,
 * to a limit. This can be used for creating a tileset at appropriate
 * resolutions for various zoom levels.
 *
 * Outputs new cell csv files in the form of `output/cells-{resolution}.csv`
 */
import * as h3 from "h3-js";
import * as Papa from "papaparse";
import { createReadStream, createWriteStream, readFileSync } from "node:fs";
import cliProgress from "cli-progress";
import * as sqlite from "sqlite3";
import { GeostatsAttribute } from "@seasketch/geostats-types";

const MIN_RESOLUTION = 5;

const usage =
  "Usage: npx ts-node downsample.ts <path-to-cells.csv> <path-to-attributes.json> <path-to-db.sqlite>";
// get file path, which should be the first argument
const filePath = process.argv[2];
if (!filePath) {
  console.error(usage);
  process.exit(1);
}
const attrPath = process.argv[3];
if (!attrPath) {
  console.error(usage);
  process.exit(1);
}
const dbPath = process.argv[4];
if (!dbPath) {
  console.error(usage);
  process.exit(1);
}

// Function to count the total number of rows by counting newlines
function countRows(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let lineCount = 0;
    const stream = createReadStream(filePath);

    stream.on("data", (chunk) => {
      for (let i = 0; i < chunk.length; ++i) {
        if (chunk[i] === 10) {
          // 10 is the ASCII code for newline (\n)
          lineCount++;
        }
      }
    });

    stream.on("end", () => resolve(lineCount));
    stream.on("error", reject);
  });
}

async function downsample(input: string, resolution: number) {
  const db = new sqlite.Database(dbPath);
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
  const cellIds = await getCellIds(input, resolution);
  const outputCsv = createWriteStream(`output/cells-${resolution}.csv`);
  const totalRows = await countRows(input);
  const progressBar = new cliProgress.SingleBar(
    {},
    cliProgress.Presets.shades_classic
  );
  progressBar.start(totalRows, 0);
  let i = 0;
  // write the header, based on attributes.json
  const attributes = JSON.parse(readFileSync(attrPath, "utf-8"));
  outputCsv.write("id");
  const columns = attributes.filter(
    (attr: any) => attr.attribute !== "id"
  ) as GeostatsAttribute[];
  for (const column of columns) {
    if (column.type === "boolean" || column.type === "string") {
      outputCsv.write("," + column.attribute);
    } else {
      outputCsv.write(
        "," + column.attribute + "_min," + column.attribute + "_max"
      );
    }
  }
  outputCsv.write("\n");

  for (const cellId of cellIds) {
    if (i % 1000 === 0) {
      progressBar.update(i);
    }
    outputCsv.write(cellId);
    const childIds = h3.cellToChildren(cellId, resolution + 1);
    for (const column of columns) {
      if (column.type === "boolean" || column.type === "string") {
        const data = await all(
          `SELECT distinct(${
            column.attribute
          }) FROM cells WHERE id IN (${childIds.map((id) => "?").join(",")})`,
          childIds
        );
        if (column.type === "boolean") {
          // if single value of 1, set to 1
          if (data.length === 1 && data[0][column.attribute] === 1) {
            outputCsv.write(",1");
          } else if (data.length === 1 && data[0][column.attribute] === 0) {
            outputCsv.write(",0");
          } else if (data.length === 2) {
            outputCsv.write(",2");
          } else {
            outputCsv.write(",");
          }
        } else {
          const sortedKeys = Object.keys(column.values).sort();
          // string type
          const indexes = data.map((d: any) =>
            sortedKeys.indexOf(d[column.attribute])
          );
          outputCsv.write(`,"${indexes.join(",")}"`);
        }
      } else {
        const data = await all(
          `select min(${column.attribute}) as min, max(${
            column.attribute
          }) as max from cells where id in (${childIds
            .map(() => "?")
            .join(",")})`,
          childIds
        );
        if (data.length < 1) {
          throw new Error("No data found");
        } else {
          outputCsv.write(`,${data[0].min},${data[0].max}`);
        }
      }
    }
    if (i % 1000 === 0) {
      progressBar.update(i);
    }
    outputCsv.write("\n");
    i++;
  }
  progressBar.update(totalRows);
  progressBar.stop();
  db.close();
  return `output/cells-${resolution}.csv`;
}

let INPUT_RESOLUTION = 0;
let i = 0;
const stream = createReadStream(filePath);
const data = Papa.parse<{ id: string } & { [key: string]: any }>(stream, {
  header: true,
  dynamicTyping: true,
  step: (row, parser) => {
    const id = row.data.id.toString();
    if (i === 0) {
      INPUT_RESOLUTION = h3.getResolution(id);
    }
    parser.abort();
    i++;
  },
  complete: async () => {
    let resolution = INPUT_RESOLUTION - 1;
    let input = filePath;
    while (resolution >= MIN_RESOLUTION) {
      console.log(
        `Downsampling from resolution ${resolution + 1} > ${resolution}`
      );
      input = await downsample(input, resolution);
      resolution--;
    }
  },
  error: (err) => {
    console.error(err);
    process.exit(1);
  },
});

async function getCellIds(inputPath: string, resolution: number) {
  console.log("Getting cell ids");
  const totalRows = await countRows(inputPath);
  const progressBar = new cliProgress.SingleBar(
    {},
    cliProgress.Presets.shades_classic
  );
  progressBar.start(totalRows, 0);
  const readStream = createReadStream(inputPath);
  const cellIds = new Set<string>();
  let i = 0;
  return new Promise<Set<string>>((resolve, reject) => {
    Papa.parse<{ id: string }>(readStream, {
      header: true,
      step: (row, parser) => {
        const id = row.data.id.toString();
        cellIds.add(h3.cellToParent(id, resolution));
        if (i % 1000 === 0) {
          progressBar.update(i);
        }
        i++;
      },
      complete: () => {
        progressBar.update(totalRows);
        progressBar.stop();
        resolve(cellIds);
      },
      error: (err) => {
        reject(err);
      },
    });
  });
}
