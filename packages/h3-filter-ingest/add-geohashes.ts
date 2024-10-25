// index.ts
import * as DuckDB from "duckdb";
// @ts-ignore
import * as tileCover from "@mapbox/tile-cover";
import * as h3 from "h3-js";
// @ts-ignore
import yargs from "yargs";
import * as cliProgress from "cli-progress";
import { stops, Stop } from "./src/stops";
const tilebelt = require("@mapbox/tilebelt");

const BATCH_SIZE = 50_000; // Define the batch size for processing
const zoomLevel = 7;
// const limits = { min_zoom: zoomLevel, max_zoom: zoomLevel };

// Define the CLI options
const argv = yargs(process.argv.slice(2))
  .option("db", {
    alias: "d",
    description: "Path to the DuckDB database file",
    type: "string",
    demandOption: true,
  })
  .help()
  .alias("help", "h").argv;

const dbPath: string = argv.db;

// Connect to DuckDB
const db = new DuckDB.Database(dbPath);
const connection = db.connect();

interface GeohashEntry {
  geohash: string;
  id: string;
  resolution: number;
  zoom: number;
}

// Function to process a batch of rows
async function processBatch(
  stop: Stop,
  offset: number
): Promise<number | false> {
  try {
    // Query to extract a batch of geometries and H3 ids
    const result: { id: string; geojson: string }[] = await all(
      `
      with ids as (
        SELECT 
          distinct(h3_h3_to_string(r${stop.h3Resolution}_id)) as id 
        FROM 
          cells
        order by id LIMIT ${BATCH_SIZE} OFFSET ${offset}
      )
      select
        id,
        st_asgeojson(h3_id_to_simple_polygon(id)) as geojson
      from ids`
    );

    if (result.length === 0) {
      return false; // No more rows to process
    }

    const valuesStatements: string[] = [];
    // Process each geometry in the batch
    for (const row of result) {
      const geohashes: string[] = tileCover.indexes(JSON.parse(row.geojson), {
        min_zoom: stop.zoomLevel,
        max_zoom: stop.zoomLevel,
      });

      // console.log("\n");

      // console.log(JSON.stringify(JSON.parse(row.geojson), null, 2));
      // console.log(geohashes);
      // console.log(
      //   geohashes.map((hash) =>
      //     JSON.stringify(tilebelt.tileToGeoJSON(tilebelt.quadkeyToTile(hash)))
      //   )
      // );

      // process.exit();

      geohashes.forEach((geohash) => {
        valuesStatements.push(
          `(${stop.h3Resolution}, h3_string_to_h3('${row.id}'), '${geohash}', ${stop.zoomLevel})`
        );
      });
    }

    await run(
      `insert into geohashes (resolution, id, geohash, zoom) values ${valuesStatements.join(
        ", "
      )}`,
      []
    );
    return result.length;
  } catch (err) {
    console.error("Error processing batch:", err);
    return false;
  }
}

// Function to incrementally process all rows
async function processAllRows(stop: Stop): Promise<void> {
  console.log(stop);
  try {
    // Get the total count of rows to process
    const countResult: { count: number }[] = await all(
      `SELECT count(distinct(h3_h3_to_string(r${stop.h3Resolution}_id)))::int AS count FROM cells`
    );
    const totalRows = countResult[0].count;

    // Initialize the progress bar
    const progressBar = new cliProgress.SingleBar(
      {},
      cliProgress.Presets.shades_classic
    );
    progressBar.start(totalRows, 0);

    let offset = 0;
    let moreRows = true;

    await run("begin transaction");
    // Process batches until there are no more rows
    while (moreRows) {
      const processedCount = await processBatch(stop, offset);
      if (processedCount === false) {
        moreRows = false;
      } else {
        offset += BATCH_SIZE; // Move to the next batch
        progressBar.increment(processedCount);
      }
    }
    await run("commit");

    progressBar.stop();
    console.log("Processing complete.");
  } catch (err) {
    console.error("Error processing all rows:", err);
  }
}

async function prepare() {
  await run(`load h3`);
  await run(`load spatial`);
  await run(`drop table if exists geohashes`);
  // Create the target table if it doesn't exist
  await run(`
    DROP TABLE IF EXISTS geohashes;
    CREATE TABLE if not exists geohashes (
      geohash varchar not null,
      id uint64 not null,
      resolution int not null,
      zoom int not null
    )
  `);
}

(async () => {
  await prepare();
  const steps = stops.reverse().slice(0, stops.length - 1);
  for (const stop of steps) {
    await processAllRows(stop);
  }
  connection.close();
  process.exit();
})();

function all<T>(query: string, values: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    connection.all(query, ...values, (err: any, data: any) => {
      if (err) {
        reject(err);
      } else if (data) {
        resolve(data as T[]);
      } else {
        reject(new Error("No data returned from query"));
      }
    });
  });
}

function run(query: string, values: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    connection.run(query, ...values, (err: any, data: any) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}
