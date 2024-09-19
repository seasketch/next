/**
 * Takes an input cell csv file and downsamples it to multiple h3 resolutions,
 * to a limit. This can be used for creating a tileset at appropriate
 * resolutions for various zoom levels.
 *
 * Outputs new cell csv files in the form of `output/cells-{resolution}.csv`
 */
import * as h3 from "h3-js";
import * as Papa from "papaparse";
import { createReadStream, createWriteStream } from "node:fs";
import cliProgress from "cli-progress";

const MIN_RESOLUTION = 5;

// get file path, which should be the first argument
const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: npx ts-node downsample.ts <path-to-cells.csv>");
  process.exit(1);
}

const processed = new Set<string>();

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
  const readStream = createReadStream(input);
  const output = createReadStream(input);
  const outputCsv = createWriteStream(`output/cells-${resolution}.csv`);
  const totalRows = await countRows(input);
  const progressBar = new cliProgress.SingleBar(
    {},
    cliProgress.Presets.shades_classic
  );
  progressBar.start(totalRows, 0);
  let i = 0;
  return new Promise<string>((resolve, reject) => {
    Papa.parse<{ id: string } & { [key: string]: any }>(readStream, {
      header: true,
      step: (row, parser) => {
        if (i === 0) {
          // write header
          outputCsv.write("id");
          for (const key in row.data) {
            if (key !== "id" && key !== "__parsed_extra") {
              outputCsv.write(",");
              outputCsv.write(key);
            }
          }
          outputCsv.write("\n");
        }
        i++;
        if (i % 1000 === 0) {
          progressBar.update(i);
        }
        const id = row.data.id.toString();
        const parentId = h3.cellToParent(id, resolution);
        if (processed.has(parentId)) {
          return;
        }
        processed.add(parentId);
        outputCsv.write(parentId);
        for (const key in row.data) {
          if (key !== "id" && key !== "__parsed_extra") {
            outputCsv.write(",");
            outputCsv.write(row.data[key].toString());
          }
        }
        outputCsv.write("\n");
      },
      complete: () => {
        progressBar.update(totalRows); // Set it to 100% completion
        progressBar.stop();
        outputCsv.end();
        console.log(
          `Wrote ${i.toLocaleString()} cells to output/cells-${resolution}.csv`
        );
        resolve(`output/cells-${resolution}.csv`);
      },
      error: (err) => {
        reject(err);
      },
    });
  });
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
    console.log("input resolution", INPUT_RESOLUTION);
    let resolution = INPUT_RESOLUTION - 1;
    let input = filePath;
    while (resolution >= MIN_RESOLUTION) {
      console.log(`Downsampling to resolution ${resolution}`);
      input = await downsample(input, resolution);
      resolution--;
    }
  },
  error: (err) => {
    console.error(err);
    process.exit(1);
  },
});
