import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import {
  gdalBuildVrt,
  gdalInfo,
  gdalTranslate,
  gdalWarp,
} from "../../raster-array/src/gdal";
import {
  CrwProduct,
  MERCATOR_LAT_MAX,
  PRODUCTS,
  reusesStack,
  sourceProduct,
} from "./products";
import { downloadPath } from "./download";

export type StackResult = {
  warpedPath: string;
  bands: string[];
  width: number;
  height: number;
  nodata: number | null;
};

function bandVrtPath(workDir: string, product: CrwProduct, bandId: string): string {
  return join(workDir, "years", product.id, `${bandId}.vrt`);
}

function bandMercatorPath(
  workDir: string,
  product: CrwProduct,
  bandId: string,
): string {
  return join(workDir, "years-3857", product.id, `${bandId}.tif`);
}

export function warpedPath(workDir: string, product: CrwProduct): string {
  if (reusesStack(product) && product.aliasOf) {
    return warpedPath(workDir, PRODUCTS[product.aliasOf]);
  }
  return join(workDir, `${product.id}.3857.vrt`);
}

function pickSubdataset(subdatasets: string[], variable: string): string | null {
  const exact = subdatasets.find((id) => {
    const tail = id.split(":").pop() ?? id;
    return tail === variable || tail === `/${variable}` || tail.endsWith(`/${variable}`);
  });
  if (exact) return exact;
  return (
    subdatasets.find((id) => id.includes(`:${variable}`) || id.includes(`/${variable}`)) ??
    null
  );
}

async function resolveVariableSource(
  ncPath: string,
  product: CrwProduct,
): Promise<string> {
  const info = await gdalInfo(ncPath);
  if (info.subdatasets.length > 0) {
    const chosen = pickSubdataset(info.subdatasets, product.variable);
    if (!chosen) {
      throw new Error(
        `No subdataset "${product.variable}" in ${ncPath}. Found: ${info.subdatasets.join(", ")}`,
      );
    }
    return chosen;
  }
  if (info.bands.length > 0) {
    return ncPath;
  }
  throw new Error(`No bands or subdatasets in ${ncPath}`);
}

async function extractAndWarp(
  ncPath: string,
  vrtPath: string,
  dest: string,
  product: CrwProduct,
  keepExisting: boolean,
): Promise<void> {
  if (keepExisting && existsSync(dest)) return;
  mkdirSync(dirname(vrtPath), { recursive: true });
  mkdirSync(dirname(dest), { recursive: true });
  const src = await resolveVariableSource(ncPath, product);
  const args = ["-of", "VRT", "-a_srs", "EPSG:4326"];
  if (product.applyUnscale) {
    args.push("-unscale", "-ot", product.outputType);
  } else {
    args.push("-ot", product.outputType);
  }
  args.push("-a_nodata", String(product.nodata));
  await gdalTranslate(src, vrtPath, args);
  const clipped = `${dest}.clip.vrt`;
  await gdalTranslate(vrtPath, clipped, [
    "-of",
    "VRT",
    "-projwin",
    "-180",
    String(MERCATOR_LAT_MAX),
    "180",
    String(-MERCATOR_LAT_MAX),
    "-a_nodata",
    String(product.nodata),
  ]);
  await gdalWarp(clipped, dest, [
    "-overwrite",
    "-t_srs",
    "EPSG:3857",
    "-r",
    product.resampling,
    "-of",
    "GTiff",
    "-co",
    "TILED=YES",
    "-co",
    "COMPRESS=DEFLATE",
    "-co",
    "PREDICTOR=2",
    "-co",
    "ZLEVEL=1",
    "-co",
    "NUM_THREADS=ALL_CPUS",
    "-wo",
    "NUM_THREADS=ALL_CPUS",
    "-srcnodata",
    String(product.nodata),
    "-dstnodata",
    String(product.nodata),
  ]);
}

async function mapPool<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      await fn(items[i]!);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
}

export async function stackProduct(
  product: CrwProduct,
  bands: string[],
  downloadsDir: string,
  workDir: string,
  options: {
    keepExisting?: boolean;
    concurrency?: number;
    onProgress?: (message: string) => void;
  } = {},
): Promise<StackResult> {
  const log = options.onProgress ?? (() => undefined);
  const keep = options.keepExisting ?? true;
  const out = warpedPath(workDir, product);
  const concurrency = options.concurrency ?? 8;

  const filesFrom = sourceProduct(product);
  const present = bands.filter((bandId) =>
    existsSync(downloadPath(downloadsDir, product, bandId)),
  );
  if (present.length === 0) {
    throw new Error(`No downloaded files for ${product.id}. Run download first.`);
  }

  const warpReuse: CrwProduct[] = [];
  if (product.reuseWarpsOf) warpReuse.push(PRODUCTS[product.reuseWarpsOf]);
  if (product.reuseDownloadsOf) {
    const extra = PRODUCTS[product.reuseDownloadsOf];
    if (!warpReuse.some((p) => p.id === extra.id)) warpReuse.push(extra);
  } else if (filesFrom !== product) {
    warpReuse.push(filesFrom);
  }

  function mercatorFor(bandId: string): string {
    const own = bandMercatorPath(workDir, product, bandId);
    if (existsSync(own)) return own;
    for (const reuse of warpReuse) {
      const reused = bandMercatorPath(workDir, reuse, bandId);
      if (existsSync(reused)) return reused;
    }
    return own;
  }

  const mercatorTifs = present.map((bandId) => mercatorFor(bandId));
  await mapPool(present, concurrency, async (bandId) => {
    const dest = mercatorFor(bandId);
    if (keep && existsSync(dest)) {
      log(`Warp ${bandId} exists`);
      return;
    }
    log(`Extract+warp ${product.variable} ${bandId}`);
    await extractAndWarp(
      downloadPath(downloadsDir, product, bandId),
      bandVrtPath(workDir, product, bandId),
      dest,
      product,
      keep,
    );
  });

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(`${out}.files.txt`, mercatorTifs.join("\n") + "\n");
  await gdalBuildVrt(out, mercatorTifs, ["-separate"]);

  const info = await gdalInfo(out);
  log(`Stacked VRT ${out}: ${info.width}×${info.height}, ${info.bands.length} bands`);
  return {
    warpedPath: out,
    bands: present,
    width: info.width,
    height: info.height,
    nodata: info.bands[0]?.noDataValue ?? product.nodata,
  };
}
