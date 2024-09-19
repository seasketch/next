import * as sqlite from "sqlite3";
import { readFileSync, createReadStream } from "node:fs";
import { GeostatsAttribute } from "@seasketch/geostats-types";
import * as Papa from "papaparse";
import { countLines } from "./src/countLines";
import * as cliProgress from "cli-progress";

// argument 1 should be an attributes.json file
const attrsPath = process.argv[2];
// ensure the file exists
const data = readFileSync(attrsPath, "utf8");
// parse the json
const attributes = JSON.parse(data);

// second argument should be a path to the highest resolution cells.csv file
const cellsPath = process.argv[3];
// ensure argument is passed
if (!cellsPath) {
  console.error(
    "Please provide a path to the highest resolution cells.csv file.\nUsage: npx ts-node build-db.ts path/to/attributes.json path/to/cells.csv path/to/output.db"
  );
  process.exit(1);
}
// third argument should be a path to the output database
const dbPath = process.argv[4];
// ensure argument is passed
if (!dbPath) {
  console.error(
    "Please provide a path to the output database.\nUsage: npx ts-node build-db.ts path/to/attributes.json path/to/cells.csv path/to/output.sqlite"
  );
  process.exit(1);
}

const db = new sqlite.Database(dbPath, sqlite.OPEN_CREATE);

function isAllowedAttribute(attr: GeostatsAttribute) {
  return (
    ["string", "number", "boolean"].includes(attr.type) &&
    (attr.type !== "string" || (attr.countDistinct || 0) < 100)
  );
}

// create the table based on attributes.json
const createTable = `CREATE TABLE cells (
  id TEXT PRIMARY KEY,
  ${attributes
    .filter(
      (attr: GeostatsAttribute) =>
        attr.attribute !== "id" && isAllowedAttribute(attr)
    )
    .map((attr: GeostatsAttribute) => {
      if (attr.type === "number") {
        return `${attr.attribute} REAL`;
      } else if (attr.type === "boolean") {
        return `${attr.attribute} INTEGER`;
      } else {
        return `${attr.attribute} TEXT`;
      }
    })
    .join(",\n")}
);`;

countLines(cellsPath).then(async (rowCount) => {
  await run(createTable, []);
  // Create a progress bar
  const progressBar = new cliProgress.SingleBar(
    {
      format: `{bar} | {percentage}% | {eta}s || {value}/{total} cells inserted`,
    },
    cliProgress.Presets.shades_classic
  );
  progressBar.start(rowCount, 0);

  let i = 0;

  const attrs = attributes.filter((attr: GeostatsAttribute) =>
    isAllowedAttribute(attr)
  );
  const columns = [...attrs.map((attr: GeostatsAttribute) => attr.attribute)];

  // pull values from cells.csv and insert into the table
  Papa.parse(createReadStream(cellsPath), {
    header: true,
    dynamicTyping: true,
    step: async (row: any) => {
      const data = row.data;
      const id = data.id;
      // insert the row into the table, using the attributes.json to determine the columns
      const values = attrs.map((attr: GeostatsAttribute) => {
        if (attr.attribute === "id") {
          return id;
        } else if (attr.type === "boolean") {
          if (data[attr.attribute] === null) {
            return null;
          } else {
            return data[attr.attribute] ? 1 : 0;
          }
        } else if (attr.type === "number") {
          return Number(data[attr.attribute]);
        } else if (
          data[attr.attribute] === null ||
          data[attr.attribute] === undefined
        ) {
          return null;
        } else {
          return data[attr.attribute].toString();
        }
      });
      await run(
        `INSERT INTO cells (${columns.join(", ")}) VALUES (${columns
          .map(() => "?")
          .join(", ")})`,
        values
      );
      i++;
      if (i % 100 === 0) {
        progressBar.update(i);
      }
    },
    complete: () => {
      progressBar.update(rowCount);
      progressBar.stop();
      // create indexes for all fields except for id
      attributes
        .filter(
          (attr: GeostatsAttribute) =>
            attr.attribute !== "id" && isAllowedAttribute(attr)
        )
        .forEach(async (attr: GeostatsAttribute) => {
          await db.run(
            `CREATE INDEX idx_${attr.attribute} ON cells (${attr.attribute});`
          );
        });
      db.close();
    },
  });
});

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
