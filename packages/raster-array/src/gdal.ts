import { execFile, spawn } from "child_process";
import { writeFileSync } from "fs";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

function gdalEnv(extra?: Record<string, string>): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GDAL_CACHEMAX: process.env.GDAL_CACHEMAX || "256",
    ...extra,
  };
}

export async function runGdal(
  command: string,
  args: string[],
  errorMessage: string,
): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      maxBuffer: 64 * 1024 * 1024,
      env: gdalEnv(),
    });
    if (process.env.DEBUG) {
      console.error(`$ ${command} ${args.join(" ")}`);
      if (stderr) console.error(stderr);
    }
    return stdout;
  } catch (err) {
    const extra =
      err && typeof err === "object" && "stderr" in err
        ? String((err as { stderr: string }).stderr)
        : String(err);
    throw new Error(`${errorMessage}\n${extra}`);
  }
}

export type GdalBandInfo = {
  band: number;
  type: string;
  noDataValue: number | null;
  description?: string;
  metadata: Record<string, string>;
  minimum?: number;
  maximum?: number;
};

export type GdalDatasetInfo = {
  path: string;
  driver: string;
  width: number;
  height: number;
  bands: GdalBandInfo[];
  wgs84Extent: [number, number, number, number] | null;
  geoTransform: number[] | null;
  projection: string | null;
  metadata: Record<string, Record<string, string>>;
  subdatasets: string[];
};

type GdalInfoJson = {
  driverShortName?: string;
  size?: number[];
  geoTransform?: number[];
  wgs84Extent?: { type: string; coordinates: number[][][] };
  cornerCoordinates?: {
    upperLeft: number[];
    lowerLeft: number[];
    upperRight: number[];
    lowerRight: number[];
  };
  coordinateSystem?: { wkt?: string; dataAxisToSRSAxisMapping?: number[] };
  metadata?: Record<string, Record<string, string> | string>;
  bands?: Array<{
    band: number;
    type: string;
    description?: string;
    noDataValue?: number;
    metadata?: Record<string, Record<string, string> | string>;
    minimum?: number | string;
    maximum?: number | string;
    computedMin?: number;
    computedMax?: number;
  }>;
  stac?: unknown;
};

function flattenMetadata(
  raw: Record<string, Record<string, string> | string> | undefined,
): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  if (!raw) return out;
  for (const [domain, value] of Object.entries(raw)) {
    if (typeof value === "string") {
      out[domain] = { "": value };
    } else {
      out[domain] = value;
    }
  }
  return out;
}

function bandMetadata(
  raw: Record<string, Record<string, string> | string> | undefined,
): Record<string, string> {
  if (!raw) return {};
  const nested = flattenMetadata(raw);
  return { ...(nested[""] ?? nested["IMAGE_STRUCTURE"] ?? {}), ...Object.values(nested)[0] };
}

export async function gdalInfo(path: string): Promise<GdalDatasetInfo> {
  const stdout = await runGdal(
    "gdalinfo",
    ["-json", path],
    `gdalinfo failed for ${path}`,
  );
  const json = JSON.parse(stdout) as GdalInfoJson;
  const extent = json.wgs84Extent?.coordinates?.[0];
  let wgs84Extent: [number, number, number, number] | null = null;
  if (extent && extent.length >= 4) {
    const xs = extent.map((c) => c[0]!);
    const ys = extent.map((c) => c[1]!);
    wgs84Extent = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  } else if (json.cornerCoordinates) {
    const pts = [
      json.cornerCoordinates.upperLeft,
      json.cornerCoordinates.lowerLeft,
      json.cornerCoordinates.upperRight,
      json.cornerCoordinates.lowerRight,
    ];
    const xs = pts.map((p) => p[0]!);
    const ys = pts.map((p) => p[1]!);
    wgs84Extent = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }

  const metadata = flattenMetadata(
    json.metadata as Record<string, Record<string, string> | string> | undefined,
  );
  const subdatasets: string[] = [];
  const sd = metadata["SUBDATASETS"] ?? {};
  for (const [key, value] of Object.entries(sd)) {
    if (/_NAME$/i.test(key)) subdatasets.push(value);
  }

  return {
    path,
    driver: json.driverShortName ?? "",
    width: json.size?.[0] ?? 0,
    height: json.size?.[1] ?? 0,
    geoTransform: json.geoTransform ?? null,
    projection: json.coordinateSystem?.wkt ?? null,
    wgs84Extent,
    metadata,
    subdatasets,
    bands: (json.bands ?? []).map((b) => ({
      band: b.band,
      type: b.type,
      description: b.description,
      noDataValue:
        b.noDataValue === undefined || Number.isNaN(b.noDataValue)
          ? null
          : b.noDataValue,
      metadata: bandMetadata(b.metadata),
      minimum:
        b.minimum !== undefined
          ? Number(b.minimum)
          : b.computedMin,
      maximum:
        b.maximum !== undefined
          ? Number(b.maximum)
          : b.computedMax,
    })),
  };
}

export async function gdalTranslate(
  src: string,
  dst: string,
  extraArgs: string[] = [],
): Promise<string> {
  await runGdal(
    "gdal_translate",
    [...extraArgs, src, dst],
    `gdal_translate failed (${src} → ${dst})`,
  );
  return dst;
}

export async function gdalWarp(
  src: string,
  dst: string,
  extraArgs: string[] = [],
): Promise<string> {
  await runGdal(
    "gdalwarp",
    [...extraArgs, src, dst],
    `gdalwarp failed (${src} → ${dst})`,
  );
  return dst;
}

/** Stream GDAL stderr so long mosaics show per-source progress. */
export async function runGdalStreaming(
  command: string,
  args: string[],
  errorMessage: string,
  envExtra?: Record<string, string>,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { env: gdalEnv(envExtra) });
    let errTail = "";
    const append = (buf: Buffer) => {
      const text = buf.toString();
      process.stderr.write(text);
      errTail = (errTail + text).slice(-8000);
    };
    child.stdout?.on("data", append);
    child.stderr?.on("data", append);
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${errorMessage}\n${errTail || `exit ${code}`}`));
    });
  });
}

/**
 * Warp one or many sources into a single destination. Uses `--optfile` so a
 * mosaic of thousands of files does not hit the process argument limit.
 */
export async function gdalWarpMosaic(
  sources: string[],
  dst: string,
  extraArgs: string[] = [],
): Promise<string> {
  if (sources.length === 0) {
    throw new Error("gdalwarp mosaic needs at least one source");
  }
  const optPath = `${dst}.optfile`;
  writeFileSync(optPath, [...extraArgs, ...sources, dst].join("\n") + "\n");
  await runGdalStreaming(
    "gdalwarp",
    ["--optfile", optPath],
    `gdalwarp mosaic failed (${dst})`,
    { GDAL_CACHEMAX: process.env.GDAL_CACHEMAX || "1024" },
  );
  return dst;
}

export async function gdalBuildVrt(
  dst: string,
  sources: string[],
  extraArgs: string[] = [],
): Promise<string> {
  if (sources.length === 0) {
    throw new Error("gdalbuildvrt needs at least one source");
  }
  if (sources.length > 32) {
    const listPath = `${dst}.files.txt`;
    writeFileSync(listPath, sources.join("\n") + "\n");
    await runGdal(
      "gdalbuildvrt",
      [...extraArgs, "-input_file_list", listPath, dst],
      `gdalbuildvrt failed (${dst})`,
    );
    return dst;
  }
  await runGdal(
    "gdalbuildvrt",
    [...extraArgs, dst, ...sources],
    `gdalbuildvrt failed (${dst})`,
  );
  return dst;
}

export async function gdalAddo(
  path: string,
  resampling: string,
  levels: number[],
): Promise<void> {
  if (levels.length === 0) return;
  await runGdal(
    "gdaladdo",
    ["-r", resampling, path, ...levels.map(String)],
    `gdaladdo failed for ${path}`,
  );
}

export function isNetCdf(path: string): boolean {
  return /\.nc$/i.test(path);
}

export function isGeoTiff(path: string): boolean {
  return /\.tif{1,2}$/i.test(path);
}
