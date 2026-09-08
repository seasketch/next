import {
  closeSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  openSync,
  readSync,
  renameSync,
  statSync,
} from "fs";
import { finished } from "stream/promises";
import { Readable } from "stream";
import { dirname, join } from "path";
import { CrwProduct, sourceFilename, sourceUrl } from "./products";

const HDF5_MAGIC = Buffer.from([0x89, 0x48, 0x44, 0x46, 0x0d, 0x0a, 0x1a, 0x0a]);

export type DownloadResult = {
  bandId: string;
  path: string;
  bytes: number;
  skipped: boolean;
  missing?: boolean;
};

export function downloadPath(
  downloadsDir: string,
  product: CrwProduct,
  bandId: string | number,
): string {
  const folder = product.reuseDownloadsOf ?? product.id;
  return join(downloadsDir, folder, sourceFilename(product, String(bandId)));
}

export function looksLikeNetCdf(path: string): boolean {
  if (!existsSync(path)) return false;
  const { size } = statSync(path);
  if (size < 64) return false;
  const fd = openSync(path, "r");
  const buf = Buffer.alloc(8);
  try {
    readSync(fd, buf, 0, 8, 0);
  } finally {
    closeSync(fd);
  }
  return buf.equals(HDF5_MAGIC) || buf.subarray(0, 3).toString("ascii") === "CDF";
}

export async function downloadBand(
  product: CrwProduct,
  bandId: string,
  dest: string,
  options: { force?: boolean; allowMissing?: boolean } = {},
): Promise<DownloadResult> {
  mkdirSync(dirname(dest), { recursive: true });
  if (!options.force && looksLikeNetCdf(dest)) {
    return {
      bandId,
      path: dest,
      bytes: statSync(dest).size,
      skipped: true,
    };
  }

  const url = sourceUrl(product, bandId);
  const res = await fetch(url);
  if (res.status === 404 && options.allowMissing) {
    return { bandId, path: dest, bytes: 0, skipped: true, missing: true };
  }
  if (!res.ok || !res.body) {
    throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
  }
  const tmp = `${dest}.partial`;
  const file = createWriteStream(tmp);
  await finished(Readable.fromWeb(res.body as import("stream/web").ReadableStream).pipe(file));
  if (!looksLikeNetCdf(tmp)) {
    throw new Error(`Downloaded ${url} is not a NetCDF/HDF5 file`);
  }
  renameSync(tmp, dest);
  return {
    bandId,
    path: dest,
    bytes: statSync(dest).size,
    skipped: false,
  };
}

export async function downloadProduct(
  product: CrwProduct,
  bands: string[],
  downloadsDir: string,
  options: {
    concurrency?: number;
    force?: boolean;
    allowMissing?: boolean;
    onProgress?: (message: string) => void;
  } = {},
): Promise<DownloadResult[]> {
  const concurrency = options.concurrency ?? 6;
  const log = options.onProgress ?? (() => undefined);
  const results: DownloadResult[] = new Array(bands.length);
  let next = 0;
  let done = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= bands.length) return;
      const bandId = bands[i]!;
      const dest = downloadPath(downloadsDir, product, bandId);
      const result = await downloadBand(product, bandId, dest, {
        force: options.force,
        allowMissing:
          options.allowMissing ??
          (product.cadence === "day" || product.cadence === "week"),
      });
      results[i] = result;
      done++;
      const state = result.missing
        ? "missing"
        : result.skipped
          ? "exists"
          : "downloaded";
      log(
        `${product.id} ${bandId} ${state} ${(result.bytes / 1e6).toFixed(1)} MB  (${done}/${bands.length})`,
      );
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, bands.length) }, () => worker()),
  );
  return results;
}
