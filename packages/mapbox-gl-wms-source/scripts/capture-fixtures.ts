/**
 * Refresh WMS fixtures from live ocean services.
 * Usage: npm run capture-fixtures
 */
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { EXAMPLE_WMS_SERVICES } from "../src/exampleServices";
import { fetchCapabilities } from "../src/catalog";

const outDir = join(__dirname, "..", "src", "__fixtures__", "live");

async function main() {
  mkdirSync(outDir, { recursive: true });
  for (const service of EXAMPLE_WMS_SERVICES) {
    try {
      console.log(`Fetching ${service.name}...`);
      const result = await fetchCapabilities(service.url);
      const filename = `${service.id}-capabilities.xml`;
      writeFileSync(join(outDir, filename), result.raw, "utf8");
      console.log(`  saved ${filename}`);
    } catch (e) {
      console.warn(`  skipped ${service.name}:`, e);
    }
  }
}

main();
