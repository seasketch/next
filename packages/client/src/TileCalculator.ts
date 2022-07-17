import { OfflineTileSettings } from "@seasketch/map-tile-cache-calculator";
import { BBox } from "geojson";

interface Worker {
  getTilesForScene: (
    bbox: BBox,
    z: number,
    settings: OfflineTileSettings
  ) => Promise<number[][]>;
  countChildTiles: (settings: OfflineTileSettings) => Promise<number>;
}

let worker: Worker;

async function getWorker(): Promise<Worker> {
  if (worker) {
    return worker!;
  } else {
    if (process.env.NODE_ENV === "test") {
      worker = {
        getTilesForScene: () => Promise.resolve([[0, 0]]),
        countChildTiles: () => Promise.resolve(0),
      };
      return worker!;
    } else {
      return new Promise((resolve, reject) => {
        import("./workers/index").then((mod) => {
          worker = new mod.default() as unknown as Worker;
          return worker!;
        });
      });
    }
  }
}

export default {
  getTilesForScene: function () {
    return getWorker().then((worker) =>
      // @ts-ignore
      worker.getTilesForScene(...arguments)
    );
  },
  countChildTiles: function () {
    // @ts-ignore
    return getWorker().then((worker) => worker.countChildTiles(...arguments));
  },
} as Worker;
