import { SceneTileCalculator } from "../offline/MapTileCache";
import pako from "pako";

export function gzippedSize(data: string) {
  const output = pako.deflate(new TextEncoder().encode(data));
  return output.byteLength;
}

let sceneCalculator: SceneTileCalculator;
export function getSceneTileCalculator() {
  if (!sceneCalculator) {
    sceneCalculator = new SceneTileCalculator();
  }
  return sceneCalculator;
}

export async function getTilesForScene() {
  return getSceneTileCalculator().getTilesForScene.apply(
    getSceneTileCalculator(),
    // @ts-ignore
    arguments
  );
}

export async function countChildTiles() {
  const calculator = getSceneTileCalculator().calculator;
  return calculator.countChildTiles.apply(
    calculator,
    // @ts-ignore
    arguments
  );
}
