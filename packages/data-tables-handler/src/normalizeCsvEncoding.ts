import {
  closeSync,
  createReadStream,
  createWriteStream,
  openSync,
  readSync,
} from "fs";
import * as path from "path";
import { Transform } from "stream";
import { pipeline } from "stream/promises";

/** Scan / convert in 1MB chunks so we never build a JS string of the whole file. */
const SCAN_CHUNK_BYTES = 1024 * 1024;

export type CsvFileEncoding = "utf-8" | "windows-1252";

/**
 * DuckDB's CSV reader requires valid UTF-8. Legacy Excel/R exports are often
 * Windows-1252 (a Latin-1 superset). DuckDB's built-in `encoding='latin-1'`
 * rejects bytes 0x80–0x9F, so non-UTF-8 files are rewritten as UTF-8 using
 * Windows-1252. Conversion is streamed; Node cannot stringify a 1GB+ buffer.
 */
export function detectCsvEncoding(csvPath: string): CsvFileEncoding {
  return isValidUtf8File(csvPath) ? "utf-8" : "windows-1252";
}

export async function normalizeCsvEncodingIfNeeded(
  csvPath: string,
  normalizedPath?: string,
): Promise<{ path: string; normalized: boolean }> {
  if (detectCsvEncoding(csvPath) === "utf-8") {
    return { path: csvPath, normalized: false };
  }

  const out =
    normalizedPath ||
    path.join(
      path.dirname(csvPath),
      `${path.basename(csvPath, path.extname(csvPath))}.utf8${path.extname(csvPath) || ".csv"}`,
    );
  await writeWindows1252AsUtf8(csvPath, out);
  return { path: out, normalized: true };
}

function isValidUtf8File(csvPath: string): boolean {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const fd = openSync(csvPath, "r");
  const buffer = Buffer.alloc(SCAN_CHUNK_BYTES);
  try {
    let bytesRead = 0;
    while ((bytesRead = readSync(fd, buffer, 0, SCAN_CHUNK_BYTES, null)) > 0) {
      decoder.decode(buffer.subarray(0, bytesRead), { stream: true });
    }
    decoder.decode();
    return true;
  } catch {
    return false;
  } finally {
    closeSync(fd);
  }
}

function writeWindows1252AsUtf8(src: string, dest: string): Promise<void> {
  const decoder = new TextDecoder("windows-1252");
  const transform = new Transform({
    transform(chunk, _enc, cb) {
      try {
        const text = decoder.decode(chunk as Buffer, { stream: true });
        cb(null, Buffer.from(text, "utf8"));
      } catch (err) {
        cb(err as Error);
      }
    },
    flush(cb) {
      try {
        const tail = decoder.decode();
        cb(null, tail ? Buffer.from(tail, "utf8") : undefined);
      } catch (err) {
        cb(err as Error);
      }
    },
  });
  return pipeline(createReadStream(src), transform, createWriteStream(dest));
}
