/**
 * Rebuild the public WoRMS parquet snapshot used by organism enrichment.
 *
 *   npx tsx scripts/buildWormsParquet.ts /path/to/dwca
 *   npx tsx scripts/buildWormsParquet.ts /path/to/dwca --upload
 *
 * Expects an extracted Darwin Core Archive from ChecklistBank dataset 2011
 * (https://www.checklistbank.org/dataset/2011) with Taxon.tsv,
 * VernacularName.tsv, and SpeciesProfile.tsv. Writes taxa / ids / names
 * parquet plus manifest.json, then
 * optionally uploads them to the public ssn-tiles prefix worms/v1/
 * (no map-access token). Do not use /taxonomy/ (JWT proxy) or /dataLibrary/
 * (PMTiles TileJSON).
 *
 * Cite WoRMS when redistributing: see WORMS_CITATION in src/wormsParquet.ts.
 */
import { writeFileSync } from "fs";
import { resolve } from "path";
import { config as loadEnv } from "dotenv";
import { putObject } from "../src/remotes";
import {
  buildWormsParquet,
  wormsParquetPaths,
  WORMS_IDS_R2_REMOTE,
  WORMS_MANIFEST_R2_REMOTE,
  WORMS_NAMES_R2_REMOTE,
  WORMS_TAXA_R2_REMOTE,
} from "../src/wormsParquet";

loadEnv();

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  let upload = false;
  let outDir = resolve("tmp/worms-parquet");
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--upload") {
      upload = true;
    } else if (arg === "--out") {
      const next = argv[++i];
      if (!next) throw new Error("--out requires a directory");
      outDir = resolve(next);
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown flag ${arg}`);
    } else {
      positional.push(arg);
    }
  }
  if (positional.length !== 1) {
    throw new Error(
      "Usage: npx tsx scripts/buildWormsParquet.ts <dwca-dir> [--out dir] [--upload]"
    );
  }
  return { dwcaDir: resolve(positional[0]), outDir, upload };
}

async function main() {
  const { dwcaDir, outDir, upload } = parseArgs(process.argv.slice(2));
  console.log(`building WoRMS parquet from ${dwcaDir}`);
  const manifest = await buildWormsParquet(dwcaDir, outDir);
  const paths = wormsParquetPaths(outDir);
  writeFileSync(paths.manifest, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `wrote ${manifest.taxaRows} taxa, ${manifest.idRows} ids, ${manifest.nameRows} names → ${outDir}`
  );

  if (!upload) {
    return;
  }
  await putObject(paths.taxa, WORMS_TAXA_R2_REMOTE, "application/vnd.apache.parquet");
  await putObject(paths.ids, WORMS_IDS_R2_REMOTE, "application/vnd.apache.parquet");
  await putObject(paths.names, WORMS_NAMES_R2_REMOTE, "application/vnd.apache.parquet");
  await putObject(paths.manifest, WORMS_MANIFEST_R2_REMOTE, "application/json");
  console.log(`uploaded ${WORMS_TAXA_R2_REMOTE}`);
  console.log(`uploaded ${WORMS_IDS_R2_REMOTE}`);
  console.log(`uploaded ${WORMS_NAMES_R2_REMOTE}`);
  console.log(`uploaded ${WORMS_MANIFEST_R2_REMOTE}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
