// import * as sqlite from "sqlite3";
import { readFileSync, createReadStream, createWriteStream } from "node:fs";
import { GeostatsAttribute } from "@seasketch/geostats-types";
import * as Papa from "papaparse";
import { countLines } from "./src/countLines";
import * as cliProgress from "cli-progress";
import pg from "pg";

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
    "Please provide a path to the highest resolution cells.csv file.\nUsage: npx ts-node build-db.ts path/to/attributes.json path/to/cells.csv"
  );
  process.exit(1);
}
// // third argument should be a path to the output database
// const dbPath = process.argv[4];
// // ensure argument is passed
// if (!dbPath) {
//   console.error(
//     "Please provide a path to the output database.\nUsage: npx ts-node build-db.ts path/to/attributes.json path/to/cells.csv path/to/output.sqlite"
//   );
//   process.exit(1);
// }

// const db = new sqlite.Database(dbPath);
const pgClient = new pg.Client({
  database: "crdss",
});

function isAllowedAttribute(attr: GeostatsAttribute) {
  return (
    ["string", "number", "boolean"].includes(attr.type) &&
    (attr.type !== "string" || (attr.countDistinct || 0) < 100)
  );
}

// create the table based on attributes.json
const createTable = `DROP TABLE IF EXISTS cells; CREATE TABLE cells (
  id h3index NOT NULL PRIMARY KEY,
  ${attributes
    .filter(
      (attr: GeostatsAttribute) =>
        attr.attribute !== "id" && isAllowedAttribute(attr)
    )
    .map((attr: GeostatsAttribute) => {
      if (attr.type === "number") {
        return `${attr.attribute} REAL`;
      } else if (attr.type === "boolean") {
        return `${attr.attribute} boolean`;
      } else {
        return `${attr.attribute} TEXT`;
      }
    })
    .join(",\n")}
)`;

const outputSqlFile = "output/cells.sql";
const outputSqlStream = createWriteStream(outputSqlFile);

countLines(cellsPath).then(async (rowCount) => {
  await pgClient.connect();
  try {
    await pgClient.query(createTable, []);
  } catch (e) {
    console.error(e);
    return;
  }
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
      const values = attrs.map((attr: GeostatsAttribute) => {
        if (attr.attribute === "id") {
          return id;
        } else if (attr.type === "boolean") {
          if (data[attr.attribute] === null) {
            return null;
          } else {
            return Boolean(data[attr.attribute]);
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
      // console.log(
      //   `INSERT INTO cells (id, ${columns.join(
      //     ",\n"
      //   )}) VALUES ('${id}', ${columns.map((c, i) => `\$${i + 1}`).join(", ")})`
      // );
      // console.log(id);
      // parser.pause();
      await run(
        `INSERT INTO cells (id, ${columns.join(
          ", "
        )}) VALUES ('${id}', ${columns
          .map((c, i) => `\$${i + 1}`)
          .join(", ")})`,
        values
      );
      i++;
      if (i % 100 === 0) {
        progressBar.update(i);
      }
      // parser.resume();
      stream.resume();
    },
    complete: async () => {
      progressBar.update(rowCount);
      progressBar.stop();
      // create indexes for all fields except for id
      attributes
        .filter(
          (attr: GeostatsAttribute) =>
            attr.attribute !== "id" && isAllowedAttribute(attr)
        )
        .forEach(async (attr: GeostatsAttribute) => {
          // await pgClient.query(
          //   `CREATE INDEX idx_${attr.attribute} ON cells (${attr.attribute});`
          // );
        });
      await outputSqlStream.end();
      console.log(`SQL file written to ${outputSqlFile}`);
      // await pgClient.end();
    },
  });
});

function run(statement: string, values: any[]) {
  let output = statement;
  values.forEach((value, i) => {
    output = output.replace(`$${i + 1}`, escape(value));
  });
  return outputSqlStream.write(`${output};\n`);
  // return pgClient.query(statement, values);
  // return new Promise((resolve, reject) => {
  //   pgClient.query(statement, values, (err) => {
  //     if (err) {
  //       reject(err);
  //     } else {
  //       console.log("resolved");
  //       resolve(true);
  //     }
  //   });
  // });
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
