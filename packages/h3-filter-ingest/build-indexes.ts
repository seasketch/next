import { createWriteStream, readFileSync } from "node:fs";

// expect first argument to be attributes.json, second to be desired
// output path for sql statements
const attributesPath = process.argv[2];
const outputPath = process.argv[3];
// ensure that arguments are provided, and if not print usage
if (!attributesPath || !outputPath) {
  console.error(
    "Please provide a path to the attributes.json file and a path to the desired output file.\nUsage: npx ts-node build-indexes.ts path/to/attributes.json path/to/output.sql"
  );
  process.exit(1);
}

// read the attributes.json file
const data = readFileSync(attributesPath, "utf8");
// parse the json
const attributes = JSON.parse(data);

// write the sql to the output file
const outputSqlStream = createWriteStream(outputPath);

for (const attribute of attributes) {
  if (attribute.attribute !== "id") {
    const statement = `CREATE INDEX if not exists idx_cells_${attribute.attribute} ON cells (${attribute.attribute});`;
    outputSqlStream.write(statement + "\n");
  }
}

outputSqlStream.end();

console.log(`Wrote indexes to ${outputPath}`);
// describe how to use sql file to populate indexes in postgres
console.log(`Usage: psql -U postgres -d crdss -a -f ${outputPath}`);
