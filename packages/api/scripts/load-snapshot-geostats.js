// Loads snapshots/geostats/<TEMPLATE_ID>.json onto each library template's
// data source. vector_geometry_type, feature_count, and column_details are
// generated from that document.
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const {
  SNAPSHOT_DATA_LIBRARY_TEMPLATE_IDS,
} = require("../src/DataLibrary/snapshotTemplateIds");

async function main() {
  const connectionString = process.env.SOURCE_URL;
  if (!connectionString) {
    console.error("SOURCE_URL is required.");
    process.exit(1);
  }
  const dir = path.join(__dirname, "../snapshots/geostats");
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.slice(0, -".json".length))
    .sort();
  const expected = [...SNAPSHOT_DATA_LIBRARY_TEMPLATE_IDS].sort();
  if (files.join(",") !== expected.join(",")) {
    console.error(
      `snapshots/geostats has ${files.join(
        ","
      )}, but snapshotTemplateIds.js lists ${expected.join(",")}.`
    );
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();
  try {
    for (const templateId of expected) {
      const geostats = JSON.parse(
        fs.readFileSync(path.join(dir, `${templateId}.json`), "utf8")
      );
      const layer = geostats && geostats.layers && geostats.layers[0];
      if (!layer || typeof layer.geometry !== "string" || layer.count == null) {
        console.error(
          `${templateId}.json is missing layers[0].geometry or layers[0].count.`
        );
        process.exit(1);
      }
      const result = await client.query(
        `update data_sources
         set geostats = $1::jsonb
         where data_library_template_id = $2`,
        [JSON.stringify(geostats), templateId]
      );
      if (result.rowCount !== 1) {
        console.error(
          `Expected to update 1 data source for ${templateId}, updated ${result.rowCount}.`
        );
        process.exit(1);
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
