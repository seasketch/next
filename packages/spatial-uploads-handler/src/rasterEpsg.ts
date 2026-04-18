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

/**
 * Best-effort EPSG for a raster path: OSR (in-process), then the same GDAL
 * utilities the Lambda image ships with (`gdalsrsinfo`), which use PROJ's full
 * CRS database and identification paths.
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
  return null;
}
