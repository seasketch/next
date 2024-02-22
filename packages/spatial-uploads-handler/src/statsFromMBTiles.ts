// @ts-ignore
import MB from "@mapbox/mbtiles";
import { GeostatsLayer } from "./geostats";

export async function statsFromMBTiles(mbtilesPath: string) {
  const mbtiles = await new Promise<MB>((resolve, reject) => {
    new MB(mbtilesPath!, (err: Error, mb: MB) => {
      if (err) {
        reject(err);
      } else {
        resolve(mb);
      }
    });
  });
  const info = await new Promise<any>((resolve, reject) => {
    mbtiles.getInfo(function (err: Error | null | undefined, info: any) {
      if (err) {
        reject(err);
      } else {
        resolve(info);
      }
    });
  });
  return {
    geostats: info?.tilestats?.layers?.length
      ? (info.tilestats.layers[0] as GeostatsLayer)
      : null,
    bounds: info.bounds,
  };
}
