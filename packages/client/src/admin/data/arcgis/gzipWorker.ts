import pako from "pako";

export function jsonGzippedSize(obj: JSON) {
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const output = pako.deflate(data);
  return output.byteLength;
}
