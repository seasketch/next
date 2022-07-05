import { BBox, Feature, MultiPolygon, Polygon } from "geojson";
import bboxPolygon from "@turf/bbox-polygon";
import splitGeojson from "geojson-antimeridian-cut";
import { cleanCoords } from "../workers/utils";
import { AnySourceData, Style } from "mapbox-gl";
import { MapTileCacheCalculator as Calculator } from "@seasketch/map-tile-cache-calculator";

export type SimpleOfflineTileSettings = {
  region: Feature<Polygon | MultiPolygon>;
  maxZ: number;
};

export type DetailedShorelineOfflineTileSettings = SimpleOfflineTileSettings & {
  maxShorelineZ: number;
  levelOfDetail: 0 | 1 | 2;
};

export type OfflineTileSettings =
  | SimpleOfflineTileSettings
  | DetailedShorelineOfflineTileSettings;

export function isDetailedShorelineSetting(
  settings: OfflineTileSettings
): settings is DetailedShorelineOfflineTileSettings {
  return (
    (settings as DetailedShorelineOfflineTileSettings).maxShorelineZ !==
    undefined
  );
}

export type OfflineTileCacheStatus = {
  /** Combined size of cached tiles */
  bytes: number;
  cachedTileCount: number;
  totalTiles: number;
  cacheNames: string[];
};

const X = 0;
const Y = 1;
const Z = 2;

export class MapTileCache {
  public calculator: Calculator;

  constructor() {
    this.calculator = new Calculator("https://d3p1dsef9f0gjr.cloudfront.net/");
    return this;
  }

  async getTilesForScene(
    bbox: BBox,
    z: number,
    settings: DetailedShorelineOfflineTileSettings | OfflineTileSettings
  ): Promise<number[][]> {
    const tiles: number[][] = [];
    const viewport = splitGeojson(
      cleanCoords(bboxPolygon(bbox)) as Feature<Polygon>
    );
    await this.calculator.traverseOfflineTiles(
      settings,
      (tile, stop) => {
        if (tile[Z] > z + 4) {
          stop();
        } else {
          tiles.push(tile);
        }
      },
      viewport.geometry
    );
    return tiles;
  }

  async cacheStatusForMap(
    settings: OfflineTileSettings,
    basemapId: number,
    style: Style
  ) {
    const status: OfflineTileCacheStatus = {
      bytes: 0,
      totalTiles: 0,
      cachedTileCount: 0,
      cacheNames: [],
    };
    const sources: { type: "mapbox"; url: string }[] = [];
    for (const source of Object.values(style.sources)) {
      const cacheName = this.cacheNameForSource(source);
      const url = this.urlForSource(source);
      sources.push({
        type: "mapbox",
        // cache: await caches.open(cacheName),
        url,
      });
      status.cacheNames.push(cacheName);
    }
    await this.calculator.traverseOfflineTiles(settings, async (tile, stop) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for (const source of sources) {
        status.totalTiles++;
      }
    });
    return status;
  }

  // async populateCache(
  //   settings: OfflineTileSettings,
  //   basemapId: number,
  //   style: Style,
  //   accessToken: string
  // ) {
  //   const status: OfflineTileCacheStatus = {
  //     bytes: 0,
  //     totalTiles: await this.countChildTiles(settings),
  //     cachedTileCount: 0,
  //     cacheNames: [],
  //   };
  //   if (!style.sources?.composite) {
  //     throw new Error(
  //       "MapTileCache currently only supports mapbox-hosted maps with a single composite source."
  //     );
  //   }
  //   const sources: { type: "mapbox"; cache: Cache; url: string }[] = [];
  //   const cacheName = this.cacheNameForSource(basemapId, "composite");
  //   status.cacheNames.push(cacheName);
  //   sources.push({
  //     type: "mapbox",
  //     cache: await caches.open(cacheName),
  //     url: (style.sources!["composite"] as VectorSourceImpl).url!,
  //   });
  //   let batch: string[] = [];
  //   await this.traverseOfflineTiles(settings, async (tile, stop) => {
  //     for (const { cache, type, url } of sources) {
  //       if (type === "mapbox") {
  //         const tileUrl = this.tileUrlForMapBoxVectorSource(url, tile);
  //         const cachedResponse = await cache.match(tileUrl);
  //         if (cachedResponse) {
  //           status.cachedTileCount++;
  //           status.bytes += (await cachedResponse.blob()).size;
  //           return;
  //         } else {
  //           batch.push(tileUrl + "?access_token=" + accessToken);
  //           if (batch.length >= 30) {
  //             try {
  //               await Promise.all(
  //                 batch.map((url) => this.fetchTile(url, cache))
  //               );
  //               status.cachedTileCount += batch.length;
  //               batch = [];
  //               // console.log(status.cachedTileCount / status.totalTiles);
  //               return;
  //             } catch (e) {
  //               console.error(e);
  //               stop();
  //               throw e;
  //             }
  //           }
  //         }
  //       }
  //     }
  //   });
  //   return status;
  // }

  // private async fetchTile(url: string, cache: Cache) {
  //   const clone = new URL(url);
  //   clone.searchParams.delete("access_token");
  //   const cacheKey = clone.toString();
  //   if (!(await cache.match(cacheKey))) {
  //     // console.log("no match", cacheKey);
  //     const response = await fetch(url.toString());
  //     if (response.ok) {
  //       await cache.put(cacheKey, response);
  //     } else {
  //       throw new Error(`Error fetching tile: ${response.statusText}`);
  //     }
  //   } else {
  //     // console.log("in cache already");
  //   }
  // }

  private cacheNameForSource(source: AnySourceData) {
    // eslint-disable-next-line i18next/no-literal-string
    return `data-source-${encodeURIComponent(this.urlForSource(source))}`;
  }

  private urlForSource(source: AnySourceData) {
    switch (source.type) {
      case "vector":
      case "raster":
      case "raster-dem":
        return source.tiles ? source.tiles[0] : source.url!;
      default:
        throw new Error(`Source of type ${source.type} not supported`);
    }
  }

  tileUrlForMapBoxVectorSource(mapboxProtocolUrl: string, tile: number[]) {
    const sources = mapboxProtocolUrl.replace("mapbox://", "");
    // eslint-disable-next-line i18next/no-literal-string
    return `https://api.mapbox.com/v4/${sources}/${tile[Z]}/${tile[X]}/${tile[Y]}.vector.pbf`;
  }

  handleSimulatorRequest(
    url: URL,
    event: FetchEvent,
    settings: OfflineTileSettings
  ) {
    const realUrl = url.toString().replace("-offline", "");
    const match = url.pathname.match(/\/(\d+)\/(\d+)\/(\d+).+$/);
    if (match && match.length) {
      const z = parseInt(match[1]);
      const x = parseInt(match[2]);
      const y = parseInt(match[3]);
      return this.calculator
        .tileInCache([x, y, z], settings)
        .then((inCache) => {
          if (inCache) {
            return fetch(realUrl);
          } else {
            return new Response("", { status: 500 });
          }
        });
    } else {
      return fetch(event.request);
    }
  }
}

export function isSimulatorUrl(url: URL) {
  return /api.mapbox-offline/.test(url.host);
}
