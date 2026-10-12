/**
 * Exit for a port the bitmap cannot reach.
 *
 * The ocean bitmap samples the land archive at about 500 m. A port up a
 * river, behind a spit, or in a harbor the land polygons close off sits on
 * land or mixed cells with no ocean water inside the short shore budget.
 * This module finds the way out with the land polygons themselves.
 *
 * The polygons near the port are fetched a tile at a time, only where the
 * walk goes, and painted into a fine local raster. Two Dijkstra walks leave
 * the port over that raster. The first may take a short hop off a dock, then
 * stays in polygon water until the caller accepts a cell — in practice a
 * bitmap ocean cell. That is the harbor or inlet path. Only when no such
 * water exists (the land file filled the basin) does a second walk cross
 * land. The cells on the way are string-pulled, water spans and land spans
 * separately, so the drawn approach is a few straight legs.
 */
import { Feature, MultiPolygon, Polygon, Position } from "geojson";
export type LandPolygons = {
    /** Open the source ahead of the first fetch. */
    warm?(): Promise<void>;
    /** Polygon features touching a lng/lat box. Called once per tile. */
    fetch(minLng: number, minLat: number, maxLng: number, maxLat: number): Promise<Array<Feature<Polygon | MultiPolygon>>>;
};
/**
 * Asked for vector-water cells as the walk pops them.
 *
 * - `>= 0` — a bitmap ocean cell that may end the approach
 * - `-1` — not a goal (land, mixed, already taken)
 * - `INLAND_WATER` — water that is not the ocean (a lake or sealed inlet).
 *   Only this counts as inland for the harbor gate. A mixed shoreline is
 *   not a harbor; treating it as one sends the goal miles down the beach.
 *
 * The caller is expected to cache by its own cell so a bitmap cell covering
 * forty raster cells is checked once, and to answer a cached cell
 * synchronously so the walk is not slowed by a promise per cell.
 */
export type ExitProbe = (lng: number, lat: number) => number | Promise<number>;
/** Probe result: bitmap water that does not join the ocean flood. */
export declare const INLAND_WATER = -2;
export type VectorExitOptions = {
    /** Half-size of the local raster, in meters. */
    reachMeters: number;
    /** Raster cell size, in meters. */
    stepMeters: number;
    /** One meter of land costs this many meters of water. */
    landCost: number;
    /** Land the approach may cross in total on the land-crossing walk. */
    maxLandMeters: number;
    /**
     * Land the water-first walk may cross to get off a dock. After the path
     * first touches water it will not step on land again.
     */
    splashMeters?: number;
    /** Cells the walk may settle before giving up on the port. */
    maxExpansions: number;
    /** Keep the fetched polygons, the raster, and the raw chain for display. */
    debug?: boolean;
    cancelled: () => boolean;
    onProgress?: (text: string) => void;
};
export type VectorExit = {
    /** Goal id returned by the probe, or -1 when the walk gave up. */
    goal: number;
    /** From the accepted water cell to the port. */
    approach: Position[];
    landMeters: number;
    waterMeters: number;
    stats: VectorExitStats;
    /** `water` stayed in polygon water; `land` had to cross filled land. */
    phase: "water" | "land" | "none";
    debug: VectorExitDebug | null;
};
/** What the exit built, in the caller's longitude frame. */
export type VectorExitDebug = {
    /** Boxes fetched from the land source, [west, south, east, north]. */
    tiles: Array<[number, number, number, number]>;
    /** Polygons as fetched. One entry per distinct feature. */
    features: Array<Feature<Polygon | MultiPolygon>>;
    /** The land raster, cropped to the loaded tiles. */
    raster: ExitRaster;
    /** Centers of the Dijkstra chain, accepted water first, before the pull. */
    chain: Position[];
    /** `water` stayed in polygon water; `land` had to cross filled land. */
    phase: "water" | "land" | "none";
};
export type ExitRaster = {
    width: number;
    height: number;
    /** [west, south, east, north] of the cropped image. */
    bounds: [number, number, number, number];
    /** Row-major from the north-west corner. 0 unloaded, 1 water, 2 land. */
    kinds: Uint8Array;
    /** Same layout. 1 where the walk settled the cell, 2 on the chain. */
    visited: Uint8Array;
};
export type VectorExitStats = {
    tiles: number;
    features: number;
    vertices: number;
    fetchMs: number;
    rasterMs: number;
    /** Walk time including fetches, painting, and probes. */
    walkMs: number;
    /** Time inside the caller's probe (bitmap reads and the ocean label). */
    probeMs: number;
    expansions: number;
    probes: number;
};
/**
 * Walk from `port` to the first water the probe accepts. Returns null only
 * when cancelled; a walk that gives up returns `goal: -1` with its stats.
 *
 * `port.lng` may sit outside ±180 when the caller frames longitudes around
 * its own grid. Output positions use the same frame.
 */
export declare function findVectorExit(port: {
    lng: number;
    lat: number;
}, land: LandPolygons, probe: ExitProbe, options: VectorExitOptions): Promise<VectorExit | null>;
//# sourceMappingURL=vectorExit.d.ts.map