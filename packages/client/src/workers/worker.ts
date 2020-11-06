import gzipSize from "gzip-size";

export function gzippedSize(data: string): number {
  return gzipSize.sync(data);
}
