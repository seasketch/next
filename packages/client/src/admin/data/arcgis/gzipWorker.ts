import gzipSize from "gzip-size";

export function jsonGzippedSize(obj: JSON) {
  return gzipSize.sync(obj.toString());
}
