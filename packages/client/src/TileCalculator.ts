import { OfflineTileSettings } from "@seasketch/map-tile-cache-calculator";
import area from "@turf/area";
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
    return new Promise(async (resolve, reject) => {
      if (arguments[2].region) {
        const areaKm = area(arguments[2].region) / 1000000;
        if (areaKm > 10_000_000) {
          reject(
            new Error(
              "Area of region is greater than 10 million square kilometers"
            )
          );
          return;
        }
      }
      try {
        getWorker().then((worker) =>
          worker
            // @ts-ignore
            .getTilesForScene(...arguments)
            .then((tiles) => resolve(tiles))
            .catch((e) => reject(e))
        );
      } catch (e) {
        reject(e);
      }
    });
  },
  countChildTiles: function () {
    return new Promise(async (resolve, reject) => {
      if (arguments[0].region) {
        const areaKm = area(arguments[0].region) / 1000000;
        if (areaKm > 10_000_000) {
          reject(
            new Error(
              "Area of region is greater than 10 million square kilometers"
            )
          );
          return;
        }
      }
      try {
        getWorker()
          .then((worker) => {
            worker
              // @ts-ignore
              .countChildTiles(...arguments)
              .then(resolve)
              .catch(reject);
          })
          .catch(reject);
      } catch (e) {
        reject(e);
      }
    });
  },
} as Worker;
