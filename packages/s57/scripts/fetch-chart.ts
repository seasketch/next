import { createWriteStream } from "fs";
import { mkdir, open, readdir, rename, stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { cellsMeetingBox, type CatalogCell } from "./catalog.js";
import { CHANNEL_CLIP, NOAA_ENC_CATALOG_URL, channelCellsDir } from "./channel.js";

const USER_AGENT = "seasketch-s57-demo";

async function readCatalog(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "application/xml,text/xml" },
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    throw new Error(`NOAA catalog responded ${response.status} from ${url}`);
  }
  return response.text();
}

async function fileSize(file: string): Promise<number | null> {
  try {
    return (await stat(file)).size;
  } catch {
    return null;
  }
}

async function downloadZip(cell: CatalogCell, dest: string): Promise<"kept" | "fetched"> {
  const size = await fileSize(dest);
  if (size !== null && cell.bytes > 0 && size === cell.bytes) return "kept";
  const response = await fetch(cell.url, {
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok || !response.body) {
    throw new Error(`${cell.name}: download failed (${response.status}) ${cell.url}`);
  }
  const partial = `${dest}.partial`;
  await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
  const written = await fileSize(partial);
  const handle = await open(partial, "r");
  const header = Buffer.alloc(2);
  await handle.read(header, 0, 2, 0);
  await handle.close();
  if (written === null || written < 22 || header.toString() !== "PK") {
    throw new Error(`${cell.name}: ${cell.url} did not return a zip`);
  }
  await rename(partial, dest);
  return "fetched";
}

async function pooled<T>(
  items: T[],
  limit: number,
  run: (item: T) => Promise<void>
): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await run(item);
    }
  });
  await Promise.all(workers);
}

async function zipsOnDisk(): Promise<string[]> {
  try {
    const names = (await readdir(channelCellsDir)).filter((name) => name.endsWith(".zip"));
    return names.sort().map((name) => path.join(channelCellsDir, name));
  } catch {
    return [];
  }
}

/**
 * Download every active NOAA ENC cell whose coverage meets the channel box.
 * Zips already the size NOAA published are left in place. Returns the zip paths
 * the chart build should read.
 */
export async function fetchChannelCells(): Promise<string[]> {
  await mkdir(channelCellsDir, { recursive: true });
  let selected: CatalogCell[];
  try {
    const xml = await readCatalog(NOAA_ENC_CATALOG_URL);
    selected = cellsMeetingBox(xml, CHANNEL_CLIP);
  } catch (error) {
    const existing = await zipsOnDisk();
    const message = error instanceof Error ? error.message : String(error);
    if (existing.length > 0) {
      console.warn(
        `Could not refresh the NOAA catalog (${message}). Using the ${existing.length} zips already in ${channelCellsDir}.`
      );
      return existing;
    }
    throw new Error(
      `Could not download the NOAA ENC catalog from ${NOAA_ENC_CATALOG_URL}. ${message}`
    );
  }
  if (selected.length === 0) {
    throw new Error(
      `The NOAA catalog has no active ENC cell meeting ${CHANNEL_CLIP.join(", ")}.`
    );
  }
  console.log(
    `${selected.length} active NOAA ENC cells meet the Santa Barbara Channel box. Source: ${NOAA_ENC_CATALOG_URL}`
  );
  let fetched = 0;
  let kept = 0;
  await pooled(selected, 4, async (cell) => {
    const dest = path.join(channelCellsDir, `${cell.name}.zip`);
    const outcome = await downloadZip(cell, dest);
    if (outcome === "fetched") {
      fetched += 1;
      console.log(`downloaded ${cell.name}`);
    } else {
      kept += 1;
    }
  });
  console.log(
    `${fetched} downloaded, ${kept} already current, in ${channelCellsDir}. Not for navigation.`
  );
  return selected.map((cell) => path.join(channelCellsDir, `${cell.name}.zip`));
}

async function main(): Promise<void> {
  const paths = await fetchChannelCells();
  console.log(paths.map((file) => path.basename(file)).join("\n"));
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
