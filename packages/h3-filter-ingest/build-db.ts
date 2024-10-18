// import * as sqlite from "sqlite3";
import { readFileSync, createReadStream, createWriteStream } from "node:fs";
import { GeostatsAttribute } from "@seasketch/geostats-types";
import * as Papa from "papaparse";
import { countLines } from "./src/countLines";
import * as cliProgress from "cli-progress";
import { stops } from "./src/stops";
import { cellToParent } from "h3-js";

const usage = `Please provide a path to the highest resolution cells.csv file.
Usage: npx ts-node build-db.ts path/to/attributes.json path/to/cells.csv postgres|sqlite`;

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
  console.error(usage);
  process.exit(1);
}

const dbType = process.argv[4];
if (!dbType || !["postgres", "sqlite"].includes(dbType)) {
  console.error(usage);
  process.exit(1);
}

const engine = dbType === "postgres" ? "pg" : "sqlite";

function isAllowedAttribute(attr: GeostatsAttribute) {
  return (
    ["string", "number", "boolean"].includes(attr.type) &&
    (attr.type !== "string" || (attr.countDistinct || 0) < 100)
  );
}

const resolutions = stops.map((stop) => stop.h3Resolution);

// create the table based on attributes.json
const createTable = `DROP TABLE IF EXISTS cells;\nCREATE TABLE cells (
  id ${engine === "pg" ? "h3index" : "text"} NOT NULL PRIMARY KEY,
  ${resolutions
    .filter((r) => r !== 11)
    .map((r) => `r${r}_id TEXT`)
    .join(",\n")},
  ${attributes
    .filter(
      (attr: GeostatsAttribute) =>
        attr.attribute !== "id" && isAllowedAttribute(attr)
    )
    .map((attr: GeostatsAttribute) => {
      if (attr.type === "number") {
        return `${attr.attribute} REAL`;
      } else if (attr.type === "boolean") {
        return `${attr.attribute} ${engine === "pg" ? "BOOLEAN" : "INTEGER"}`;
      } else {
        return `${attr.attribute} TEXT`;
      }
    })
    .join(",\n")}
)`;

const createIndexes = `
CREATE INDEX IF NOT EXISTS idx_cells_id ON cells (id);
${resolutions
  .filter((r) => r !== 11)
  .map(
    (r) => `CREATE INDEX IF NOT EXISTS idx_cells_r${r}_id ON cells (r${r}_id);`
  )
  .join("\n")}
${attributes
  .filter(
    (attr: GeostatsAttribute) =>
      attr.attribute !== "id" && isAllowedAttribute(attr)
  )
  .map((attr: GeostatsAttribute) => {
    if (engine === "sqlite" && attr.type === "boolean") {
      // create two partial indexes where value is 1 or 0
      return `
CREATE INDEX IF NOT EXISTS idx_cells_${attr.attribute}_true ON cells (${attr.attribute}) WHERE ${attr.attribute} = 1;
CREATE INDEX IF NOT EXISTS idx_cells_${attr.attribute}_false ON cells (${attr.attribute}) WHERE ${attr.attribute} = 0;`;
    } else {
      return `CREATE INDEX IF NOT EXISTS idx_cells_${attr.attribute} ON cells (${attr.attribute});`;
    }
  })
  .join("\n")}`;

const outputSqlFile = `output/cells.${engine}.sql`;
const outputSqlStream = createWriteStream(outputSqlFile);

countLines(cellsPath).then(async (rowCount) => {
  const createDbOutput = `output/create-db.${engine}.sql`;
  const createDbStream = createWriteStream(createDbOutput);
  createDbStream.write(createTable);
  createDbStream.end();
  console.log(`CREATE DATABASE SQL file written to ${createDbOutput}`);

  const createIndexesOutput = `output/create-indexes.${engine}.sql`;
  const createIndexesStream = createWriteStream(createIndexesOutput);
  createIndexesStream.write(createIndexes);
  createIndexesStream.end();
  console.log(`CREATE INDEXES SQL file written to ${createIndexesOutput}`);

  // await run(createTable, []);
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

  const stream = createReadStream(cellsPath);
  // pull values from cells.csv and insert into the table
  Papa.parse(stream, {
    header: true,
    dynamicTyping: true,
    step: async (row: any, parser) => {
      stream.pause();
      // console.log("data", row.data);
      const data = row.data;
      const id = data.id;
      // insert the row into the table, using the attributes.json to determine the columns

      const values = [
        id,
        ...resolutions.filter((r) => r !== 11).map((r) => cellToParent(id, r)),
        ...attrs
          .filter((a: GeostatsAttribute) => a.attribute !== "id")
          .map((attr: GeostatsAttribute) => {
            if (attr.attribute === "id") {
              return id;
            } else if (attr.type === "boolean") {
              if (data[attr.attribute] === null) {
                return null;
              } else {
                if (engine === "pg") {
                  return Boolean(data[attr.attribute]);
                } else {
                  return Boolean(data[attr.attribute]) ? 1 : 0;
                }
              }
            } else if (attr.type === "number") {
              if (isNaN(data[attr.attribute])) {
                return null;
              } else {
                return Number(data[attr.attribute]);
              }
            } else if (
              data[attr.attribute] === null ||
              data[attr.attribute] === undefined
            ) {
              return null;
            } else {
              return data[attr.attribute].toString();
            }
          }),
      ];
      await run(
        `INSERT INTO cells (id, ${resolutions
          .filter((r) => r !== 11)
          .map((r) => `r${r}_id`)
          .join(", ")}, ${columns.join(", ")}) VALUES ('${id}', ${resolutions
          .filter((r) => r !== 11)
          .map((r, i) => {
            return `\$${i + 1}`;
          })
          .join(", ")}, ${columns
          .map(
            (c, i) => `\$${i + 1 + resolutions.filter((r) => r !== 11).length}`
          )
          .join(", ")})`,
        values
      );
      i++;
      if (i % 100 === 0) {
        progressBar.update(i);
      }
      stream.resume();
    },
    complete: async () => {
      progressBar.update(rowCount);
      progressBar.stop();
      await outputSqlStream.end();
      console.log(`SQL file written to ${outputSqlFile}`);
      // print usage info (depending on engine)
      if (engine === "sqlite") {
        console.log(
          `Usage: sqlite3 path/to/database.sqlite < ${outputSqlFile}`
        );
      } else {
        console.log(`Usage: psql -U postgres -d crdss -a -f ${outputSqlFile}`);
      }
    },
  });
});

function run(statement: string, values: any[]) {
  let output = statement;
  values.forEach((value, i) => {
    output = output.replace(`$${i + 1}`, escape(value));
  });
  return outputSqlStream.write(`${output};\n`);
}

function escape(value: any) {
  if (value === null) {
    return "NULL";
  } else if (typeof value === "string") {
    return `'${value.replace(/'/g, "''")}'`;
  } else {
    return value;
  }
}
