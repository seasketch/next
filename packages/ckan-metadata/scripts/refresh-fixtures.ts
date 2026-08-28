import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

const FIXTURES = join(__dirname, "..", "__tests__", "fixtures");

const CANADA_RECORDS: Array<{ id: string; slug: string }> = [
  { id: "0bc73892-e41f-41d0-8d8e-828c16139337", slug: "canada-natural-resource-districts" },
  { id: "3544ad91-0cf2-4926-a08a-bfe42d9a031d", slug: "canada-crown-tenures" },
  { id: "61d0864e-d795-4d20-8aa0-718f9fd6fb5f", slug: "canada-surveyed-parcels" },
  { id: "d1aff64e-dbfe-45a6-af97-582b7f6418b9", slug: "canada-regional-districts" },
  { id: "e3c3c580-996a-4668-8bc5-6aa7c7dc4932", slug: "canada-municipalities" },
];

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }
  return response.json();
}

async function writeJson(name: string, data: unknown) {
  const path = join(FIXTURES, name);
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`wrote ${name}`);
}

async function main() {
  await mkdir(FIXTURES, { recursive: true });

  const canadaSchema = await fetchJson(
    "https://open.canada.ca/data/en/api/3/action/scheming_dataset_schema_show?type=dataset"
  );
  await writeJson("canada-scheming-dataset.json", canadaSchema);

  for (const record of CANADA_RECORDS) {
    const data = await fetchJson(
      `https://open.canada.ca/data/en/api/3/action/package_show?id=${record.id}`
    );
    await writeJson(`${record.slug}.json`, data);
  }

  const bcSchema = await fetchJson(
    "https://catalogue.data.gov.bc.ca/api/3/action/scheming_dataset_schema_show?type=bcdc_dataset"
  );
  await writeJson("bc-scheming-bcdc-dataset.json", bcSchema);

  const bcRecord = await fetchJson(
    "https://catalogue.data.gov.bc.ca/api/3/action/package_show?id=natural-resource-nr-district"
  );
  await writeJson("bc-natural-resource-districts.json", bcRecord);

  const noSchemaRecord = await fetchJson(
    "https://data.humdata.org/api/3/action/package_show?id=tunisia-healthsites"
  );
  await writeJson("hdx-tunisia-healthsites.json", noSchemaRecord);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
