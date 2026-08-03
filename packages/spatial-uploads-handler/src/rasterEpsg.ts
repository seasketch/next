import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Minimal OSR surface used for EPSG authority reads (implemented by gdal-async
 * SpatialReference).
 */
export interface GdalSpatialReferenceLike {
  clone: () => GdalSpatialReferenceLike;
  getAuthorityName: (key: string | null) => string;
  getAuthorityCode: (key: string | null) => string;
  autoIdentifyEPSG: () => void;
  morphFromESRI: () => void;
}

/**
 * Read EPSG:nnnn from OSR authority nodes (root, PROJCS, GEOGCS).
 * Caller should run `autoIdentifyEPSG()` (and optionally `morphFromESRI()`)
 * on the same SpatialReference first.
 */
export function readEpsgAuthorityFromSrs(
  srs: GdalSpatialReferenceLike,
): number | null {
  const candidateKeys: (string | null)[] = [null, "PROJCS", "GEOGCS"];
  for (const key of candidateKeys) {
    const auth = srs.getAuthorityName(key);
    const code = srs.getAuthorityCode(key);
    if (!auth || code == null || String(code).trim() === "") {
      continue;
    }
    if (auth.toUpperCase() !== "EPSG") {
      continue;
    }
    const n = parseInt(String(code), 10);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return null;
}

function tryResolveEpsgAfterPrepare(
  srs: GdalSpatialReferenceLike,
  prepare: (cloned: GdalSpatialReferenceLike) => void,
): number | null {
  const c = srs.clone();
  prepare(c);
  return readEpsgAuthorityFromSrs(c);
}

/**
 * Resolve EPSG from a GDAL SpatialReference without mutating the input:
 * 1) autoIdentifyEPSG + authority scan (OGC / GeoTIFF-native SRS)
 * 2) morphFromESRI + autoIdentifyEPSG + scan (ESRI WKT and similar)
 */
export function resolveEpsgFromSpatialReference(
  srs: GdalSpatialReferenceLike,
): number | null {
  const ogc = tryResolveEpsgAfterPrepare(srs, (c) => {
    try {
      c.autoIdentifyEPSG();
    } catch {
      // GDAL throws when it cannot identify the CRS.
    }
  });
  if (ogc != null) {
    return ogc;
  }
  return tryResolveEpsgAfterPrepare(srs, (c) => {
    try {
      c.morphFromESRI();
    } catch {
      // Not ESRI WKT; ignore.
    }
    try {
      c.autoIdentifyEPSG();
    } catch {
      // Same as above.
    }
  });
}

/** Parse root `id` from `gdalsrsinfo -o PROJJSON` output. */
export function epsgFromProjJsonText(text: string): number | null {
  try {
    const j = JSON.parse(text) as {
      id?: { authority?: string; code?: number | string };
    };
    const auth = j.id?.authority;
    const code = j.id?.code;
    if (!auth || code == null) {
      return null;
    }
    if (String(auth).toUpperCase() !== "EPSG") {
      return null;
    }
    const n = typeof code === "number" ? code : parseInt(String(code), 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** First standalone `EPSG:nnnn` line from `gdalsrsinfo -e` output. */
export function parseEpsgFromGdalsrsinfoSearchStdout(
  stdout: string,
): number | null {
  for (const line of stdout.split(/\r?\n/)) {
    const m = line.trim().match(/^EPSG:(\d+)\s*$/i);
    if (m) {
      return parseInt(m[1], 10);
    }
  }
  return null;
}

/** Parse `EPSG:4326` / `epsg:4326` style strings; rejects non-positive codes. */
export function parseEpsgCodeString(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }
  const m = value.trim().match(/^EPSG:(\d+)\s*$/i);
  if (!m) {
    return null;
  }
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * CF / ACDD NetCDF (and GeoTIFF derivatives) often declare EPSG in metadata
 * even when GDAL builds an "unknown" geographic CRS that PROJ cannot match
 * (e.g. NOAA CRW uses inverse_flattening 298.2572 vs WGS 84's 298.257223563).
 *
 * Prefer explicit CRS authority keys, then any metadata value shaped like
 * `EPSG:nnnn`.
 */
export function epsgFromGdalinfoMetadataJson(text: string): number | null {
  let info: { metadata?: unknown };
  try {
    info = JSON.parse(text) as { metadata?: unknown };
  } catch {
    return null;
  }
  const preferredKeys = /(epsg_code|geospatial_bounds_crs)$/i;
  let preferred: number | null = null;
  let any: number | null = null;

  const visit = (node: unknown) => {
    if (node == null || typeof node !== "object") {
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) {
        visit(item);
      }
      return;
    }
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const fromValue = parseEpsgCodeString(value);
      if (fromValue != null) {
        if (preferredKeys.test(key) && preferred == null) {
          preferred = fromValue;
        } else if (any == null) {
          any = fromValue;
        }
      }
      visit(value);
    }
  };

  visit(info.metadata);
  return preferred ?? any;
}

/**
 * Best-effort EPSG for a raster path: OSR (in-process), then the same GDAL
 * utilities the Lambda image ships with (`gdalsrsinfo` / `gdalinfo`), which use
 * PROJ's full CRS database and identification paths. Finally, CF/ACDD metadata
 * keys such as `crs#epsg_code` when the WKT is an unrecognized geographic CRS.
 */
export async function resolveRasterEpsg(
  path: string,
  srs: GdalSpatialReferenceLike | null,
): Promise<number | null> {
  if (srs) {
    const fromSrs = resolveEpsgFromSpatialReference(srs);
    if (fromSrs != null) {
      return fromSrs;
    }
  }
  try {
    const { stdout } = await execFileAsync(
      "gdalsrsinfo",
      ["-o", "PROJJSON", path],
      {
        maxBuffer: 10 * 1024 * 1024,
        env: process.env,
      },
    );
    const fromJson = epsgFromProjJsonText(stdout);
    if (fromJson != null) {
      return fromJson;
    }
  } catch {
    // Missing binary, non-zero exit, or invalid JSON.
  }
  try {
    const { stdout } = await execFileAsync("gdalsrsinfo", ["-e", path], {
      maxBuffer: 10 * 1024 * 1024,
      env: process.env,
    });
    const fromSearch = parseEpsgFromGdalsrsinfoSearchStdout(stdout);
    if (fromSearch != null) {
      return fromSearch;
    }
  } catch {
    // Same as above.
  }
  try {
    const { stdout } = await execFileAsync("gdalinfo", ["-json", path], {
      maxBuffer: 10 * 1024 * 1024,
      env: process.env,
    });
    const fromMeta = epsgFromGdalinfoMetadataJson(stdout);
    if (fromMeta != null) {
      return fromMeta;
    }
  } catch {
    // Same as above.
  }
  return null;
}
