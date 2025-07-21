import { Feature, MultiPolygon, Polygon } from "geojson";
export type SimpleOfflineTileSettings = {
    region: Feature<Polygon | MultiPolygon>;
    maxZ: number;
};
export type DetailedShorelineOfflineTileSettings = SimpleOfflineTileSettings & {
    maxShorelineZ: number;
    levelOfDetail: 0 | 1 | 2;
};
export type OfflineTileSettings = SimpleOfflineTileSettings | DetailedShorelineOfflineTileSettings;
export declare function isDetailedShorelineSetting(settings: OfflineTileSettings): settings is DetailedShorelineOfflineTileSettings;
export type OfflineTileCacheStatus = {
    /** Combined size of cached tiles */
    bytes: number;
    cachedTileCount: number;
    totalTiles: number;
    cacheNames: string[];
};
type TileVisitFn = (tile: number[], stop: () => void) => void;
export declare class MapTileCacheCalculator {
    private landFeatures;
    constructor(vectorDataSourceUrl: string);
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
    traverseOfflineTiles(settings: OfflineTileSettings, visitFn: TileVisitFn, viewport?: Polygon | MultiPolygon): Promise<void>;
    tileInCache(tile: number[], settings: OfflineTileSettings): Promise<boolean>;
    countChildTiles(settings: OfflineTileSettings): Promise<number>;
    private traverseChildrenRecursive;
}
export {};
//# sourceMappingURL=map-tile-cache-calculator.d.ts.map