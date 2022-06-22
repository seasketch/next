import pako from "pako";

export function gzippedSize(data: string) {
  const output = pako.deflate(new TextEncoder().encode(data));
  return output.byteLength;
}
