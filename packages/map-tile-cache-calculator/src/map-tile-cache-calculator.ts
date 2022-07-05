import tilebelt, { tileToQuadkey } from "@mapbox/tilebelt";
import { Feature, MultiPolygon, Polygon } from "geojson";
import booleanIntersects from "@turf/boolean-intersects";
import { VectorDataSource } from "@seasketch/vector-data-source";

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
      undefined &&
    (settings as DetailedShorelineOfflineTileSettings).maxShorelineZ !== null
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

  constructor(vectorDataSourceUrl: string) {
    this.landFeatures = new VectorDataSource(vectorDataSourceUrl);
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

  async countChildTiles(settings: OfflineTileSettings) {
    let count = 0;
    await this.traverseOfflineTiles(settings, (tile, stop) => {
      count++;
    });
    return count;
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
}

const Z_ONE_TILES = [
  [0, 0, 1],
  [1, 0, 1],
  [0, 1, 1],
  [1, 1, 1],
];
