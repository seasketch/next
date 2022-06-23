import pako from "pako";

export function jsonGzippedSize(obj: JSON) {
  const output = pako.deflate(new TextEncoder().encode(JSON.stringify(obj)));
  return output.byteLength;
}
