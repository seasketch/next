import tilebelt, { tileToQuadkey } from "@mapbox/tilebelt";
import { BBox, Feature, MultiPolygon, Polygon } from "geojson";
import booleanIntersects from "@turf/boolean-intersects";
import bboxPolygon from "@turf/bbox-polygon";
import { VectorDataSource } from "../VectorDataSource";
import splitGeojson from "geojson-antimeridian-cut";
import { cleanCoords } from "../workers/utils";
import { Style, VectorSourceImpl } from "mapbox-gl";
type OsmLandFeature = Feature<Polygon, { gid: number }>;

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

type TileVisitFn = (tile: number[], stop: () => void) => void;

export class MapTileCacheCalculator {
  private landFeatures: VectorDataSource<OsmLandFeature>;

  constructor() {
    this.landFeatures = new VectorDataSource(
      "https://d3p1dsef9f0gjr.cloudfront.net/"
    );
    return this;
  }

  /**
   * From the given settings, yields tiles that should be cached offline to the
   * visit function. This should be considered the canonical algorithm for
   * performing this task. Tools to visualize the results, estimate tile counts
   * and dataset sizes, and do the actual caching can all use this algorithm by
   * tapping into the visit function.
   *
   * The visit function recieves a stop() argument that can prevent further
   * traversal into higher zoom levels. This is useful if you need to visualize
   * what tiles are to be cached but want to limit the tiles shown on the map
   * based on the current zoom level.
   *
   * An additional argument useful for building visualizations is viewportBBox. If
   * supplied, the algorithm will start at the broadest tile which overlaps the
   * viewport, limiting traversal to just tiles relevant to the given view.
   *
   * @param settings
   * @param visitFn
   * @param viewportBBox
   */
  async traverseOfflineTiles(
    settings: OfflineTileSettings,
    visitFn: TileVisitFn,
    viewport?: Polygon | MultiPolygon
  ) {
    // Traverse the world tiles from z 1.
    for (const tile of Z_ONE_TILES) {
      await this.traverseChildrenRecursive(tile, settings, visitFn, viewport);
    }
  }

  async tileInCache(tile: number[], settings: OfflineTileSettings) {
    // const parents:string[] = [];
    // let parent = tilebelt.getParent(tile)
    // for (var i = tile[Z]; i > 0; i++) {
    //   parents.push(tilebelt.getParent(i))
    // }
    // while(true) {

    //   parents.push()
    // }
    let match: number[] | null = null;
    const qk = tileToQuadkey(tile);
    await this.traverseOfflineTiles(settings, (t, stop) => {
      if (match) {
        stop();
      } else {
        const tqk = tilebelt.tileToQuadkey(t);
        if (tqk === qk) {
          match = t;
          stop();
        } else if (!new RegExp(`^${tqk}`).test(qk)) {
          stop();
        }
      }
    });
    return !!match;
  }

  async getTilesForScene(
    bbox: BBox,
    z: number,
    settings: DetailedShorelineOfflineTileSettings | OfflineTileSettings
  ): Promise<number[][]> {
    const tiles: number[][] = [];
    // const viewport = bboxPolygon(bbox);
    const viewport = splitGeojson(
      cleanCoords(bboxPolygon(bbox)) as Feature<Polygon>
    );
    await this.traverseOfflineTiles(
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

  async countChildTiles(settings: OfflineTileSettings) {
    let count = 0;
    await this.traverseOfflineTiles(settings, (tile, stop) => {
      count++;
    });
    return count;
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
    if (!style.sources?.composite) {
      throw new Error(
        "MapTileCache currently only supports mapbox-hosted maps with a single composite source."
      );
    }
    const sources: { type: "mapbox"; cache: Cache; url: string }[] = [];
    const cacheName = this.cacheNameForSource(basemapId, "composite");
    sources.push({
      type: "mapbox",
      cache: await caches.open(cacheName),
      url: (style.sources!["composite"] as VectorSourceImpl).url!,
    });
    status.cacheNames.push(cacheName);
    await this.traverseOfflineTiles(settings, async (tile, stop) => {
      for (const { cache, type, url } of sources) {
        status.totalTiles++;
        if (type === "mapbox") {
          const cachedResponse = await cache.match(
            this.tileUrlForMapBoxVectorSource(url, tile)
          );
          if (cachedResponse) {
            status.cachedTileCount++;
            status.bytes += (await cachedResponse.blob()).size;
          }
        }
      }
    });
    return status;
  }

  async populateCache(
    settings: OfflineTileSettings,
    basemapId: number,
    style: Style,
    accessToken: string
  ) {
    const status: OfflineTileCacheStatus = {
      bytes: 0,
      totalTiles: await this.countChildTiles(settings),
      cachedTileCount: 0,
      cacheNames: [],
    };
    if (!style.sources?.composite) {
      throw new Error(
        "MapTileCache currently only supports mapbox-hosted maps with a single composite source."
      );
    }
    const sources: { type: "mapbox"; cache: Cache; url: string }[] = [];
    const cacheName = this.cacheNameForSource(basemapId, "composite");
    status.cacheNames.push(cacheName);
    sources.push({
      type: "mapbox",
      cache: await caches.open(cacheName),
      url: (style.sources!["composite"] as VectorSourceImpl).url!,
    });
    let batch: string[] = [];
    await this.traverseOfflineTiles(settings, async (tile, stop) => {
      for (const { cache, type, url } of sources) {
        if (type === "mapbox") {
          const tileUrl = this.tileUrlForMapBoxVectorSource(url, tile);
          const cachedResponse = await cache.match(tileUrl);
          if (cachedResponse) {
            status.cachedTileCount++;
            status.bytes += (await cachedResponse.blob()).size;
            return;
          } else {
            batch.push(tileUrl + "?access_token=" + accessToken);
            if (batch.length >= 30) {
              try {
                await Promise.all(
                  batch.map((url) => this.fetchTile(url, cache))
                );
                status.cachedTileCount += batch.length;
                batch = [];
                // console.log(status.cachedTileCount / status.totalTiles);
                return;
              } catch (e) {
                console.error(e);
                stop();
                throw e;
              }
            }
          }
        }
      }
    });
    return status;
  }

  private async fetchTile(url: string, cache: Cache) {
    const clone = new URL(url);
    clone.searchParams.delete("access_token");
    const cacheKey = clone.toString();
    if (!(await cache.match(cacheKey))) {
      // console.log("no match", cacheKey);
      const response = await fetch(url.toString());
      if (response.ok) {
        await cache.put(cacheKey, response);
      } else {
        throw new Error(`Error fetching tile: ${response.statusText}`);
      }
    } else {
      // console.log("in cache already");
    }
  }

  private cacheNameForSource(basemapId: number, sourceId: string) {
    // eslint-disable-next-line i18next/no-literal-string
    return `basemaps-${basemapId}-${sourceId}`;
  }

  tileUrlForMapBoxVectorSource(mapboxProtocolUrl: string, tile: number[]) {
    const sources = mapboxProtocolUrl.replace("mapbox://", "");
    // eslint-disable-next-line i18next/no-literal-string
    return `https://api.mapbox.com/v4/${sources}/${tile[Z]}/${tile[X]}/${tile[Y]}.vector.pbf`;
  }

  private async traverseChildrenRecursive(
    tile: number[],
    settings: DetailedShorelineOfflineTileSettings | OfflineTileSettings,
    visitFn: TileVisitFn,
    viewport?: Polygon | MultiPolygon,
    parentIntersectsLand?: boolean,
    grandparentIntersectsLand?: boolean
  ) {
    // Hard limit on max zoom levels for tiles in different categories
    if (!parentIntersectsLand && tile[Z] > settings.maxZ) {
      return;
    } else if (
      isDetailedShorelineSetting(settings) &&
      tile[Z] > settings.maxShorelineZ
    ) {
      return;
    }

    const tileGeoJSON = tilebelt.tileToGeoJSON(tile);

    // If a viewport is set, only visit tiles that overlap the viewport
    if (viewport && !booleanIntersects(viewport, tileGeoJSON)) {
      return;
    }

    // If a tile is processed to this point, it will be added to the traversal
    let stop = false;
    await visitFn(tile, () => {
      stop = true;
    });
    if (stop) {
      return;
    }

    // Beyond this point now considers whether to evaluate the tiles's children
    grandparentIntersectsLand = parentIntersectsLand;

    if (isDetailedShorelineSetting(settings) && tile[Z] >= settings.maxZ) {
      const shoreFeatures = await this.landFeatures.fetchOverlapping({
        type: "Feature",
        properties: {},
        geometry: tileGeoJSON,
      });
      if (shoreFeatures.length === 0 && !parentIntersectsLand) {
        return;
      } else if (shoreFeatures.length === 0) {
        parentIntersectsLand = false;
      } else {
        parentIntersectsLand = true;
      }
    }

    // Visit all tiles to a depth of 2, then proceed to only visit tiles if they
    // intersect the project bounds.
    if (tile[Z] > 2 && !booleanIntersects(tileGeoJSON, settings.region)) {
      return;
    }

    for (const child of tilebelt.getChildren(tile)) {
      await this.traverseChildrenRecursive(
        child,
        settings,
        visitFn,
        viewport,
        parentIntersectsLand,
        grandparentIntersectsLand
      );
    }
    return;
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
      return this.tileInCache([x, y, z], settings).then((inCache) => {
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

const Z_ONE_TILES = [
  [0, 0, 1],
  [1, 0, 1],
  [0, 1, 1],
  [1, 1, 1],
];

export function isSimulatorUrl(url: URL) {
  return /api.mapbox-offline/.test(url.host);
}
