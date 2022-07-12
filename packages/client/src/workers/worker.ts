import { SceneTileCalculator } from "../offline/MapTileCache";
import pako from "pako";

export function gzippedSize(data: string) {
  const output = pako.deflate(new TextEncoder().encode(data));
  return output.byteLength;
}

export const mapTileCache = new SceneTileCalculator();
