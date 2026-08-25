import { execFile } from "child_process";
import { promisify } from "util";
import { readdirSync } from "fs";
import { join } from "path";
import { BBox, bboxLonLatToMercator } from "./webmercator";

const execFileAsync = promisify(execFile);

const GMW_NAME =
  /GMW_([NS])(\d{1,2})([EW])(\d{3})_v\d+_mng_ext\.tif$/i;

export type GmwSource = {
  name: string;
  /** GDAL path, possibly `/vsizip/{zip}/file.tif`. */
  path: string;
  /** WGS84 [west, south, east, north] of the 1° cell. */
  wgs84: [number, number, number, number];
  mercator: BBox;
};

/**
 * GMW 1° cells are named by the **north-west** corner (the GeoTIFF origin),
 * not the south-west corner. `GMW_N25W081` is lon −81…−80, lat 24…25.
 * Using SW naming shifts every coverage bbox 1° north and drops the southern
 * fringe of isolated cells.
 */
export function parseGmwCellName(
  filename: string,
): [number, number, number, number] | null {
  const base = filename.split("/").pop() ?? filename;
  const m = GMW_NAME.exec(base);
  if (!m) return null;
  const lat = Number(m[2]);
  const lon = Number(m[4]);
  const north = m[1] === "S" ? -lat : lat;
  const west = m[3] === "W" ? -lon : lon;
  return [west, north - 1, west + 1, north];
}

export function vsizipPath(zipPath: string, inner: string): string {
  return `/vsizip/{${zipPath}}/${inner}`;
}

export async function listGmwSources(zipOrDir: string): Promise<GmwSource[]> {
  const names = zipOrDir.toLowerCase().endsWith(".zip")
    ? await listZipTifs(zipOrDir)
    : readdirSync(zipOrDir).filter((n) => /_mng_ext\.tif$/i.test(n));

  const sources: GmwSource[] = [];
  for (const name of names) {
    const wgs84 = parseGmwCellName(name);
    if (!wgs84) continue;
    const path = zipOrDir.toLowerCase().endsWith(".zip")
      ? vsizipPath(zipOrDir, name)
      : join(zipOrDir, name);
    sources.push({
      name,
      path,
      wgs84,
      mercator: bboxLonLatToMercator(wgs84[0], wgs84[1], wgs84[2], wgs84[3]),
    });
  }
  sources.sort((a, b) => a.name.localeCompare(b.name));
  if (sources.length === 0) {
    throw new Error(`No GMW GeoTIFFs found in ${zipOrDir}`);
  }
  return sources;
}

async function listZipTifs(zipPath: string): Promise<string[]> {
  const { stdout } = await execFileAsync("unzip", ["-Z", "-1", zipPath], {
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => /_mng_ext\.tif$/i.test(s));
}

export function unionWgs84(
  sources: GmwSource[],
): [number, number, number, number] {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const s of sources) {
    west = Math.min(west, s.wgs84[0]);
    south = Math.min(south, s.wgs84[1]);
    east = Math.max(east, s.wgs84[2]);
    north = Math.max(north, s.wgs84[3]);
  }
  return [west, south, east, north];
}
