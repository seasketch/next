import { readFileSync, writeFileSync } from "fs";
import * as path from "path";

function isValidUtf8(buffer: Buffer): boolean {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

/**
 * DuckDB's CSV reader requires valid UTF-8. Many legacy exports (Excel, R, etc.)
 * are Latin-1 / Windows-1252. Reinterpret single-byte encodings as Latin-1 and
 * write UTF-8 so every byte 0x00–0xFF round-trips without parse failures.
 */
export function normalizeCsvEncodingIfNeeded(
  csvPath: string,
  normalizedPath?: string,
): { path: string; normalized: boolean } {
  const buffer = readFileSync(csvPath);
  if (isValidUtf8(buffer)) {
    return { path: csvPath, normalized: false };
  }

  const out =
    normalizedPath ||
    path.join(
      path.dirname(csvPath),
      `${path.basename(csvPath, path.extname(csvPath))}.utf8${path.extname(csvPath) || ".csv"}`,
    );
  writeFileSync(out, buffer.toString("latin1"), "utf8");
  return { path: out, normalized: true };
}
