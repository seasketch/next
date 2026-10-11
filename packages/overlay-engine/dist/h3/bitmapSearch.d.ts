/**
 * Client-side ocean-bitmap search, the method used by
 * https://github.com/arcnautical/maritime-routing
 *
 * Cells are classified from the land archive as the search reaches them, so a
 * fine grid does not read the whole window. Land and mixed are walls. A* walks
 * eight neighbors. A diagonal is open only when both cells beside it are
 * water, so the segment cannot clip a land or mixed corner. Edge length
 * follows latitude, and the heuristic is the great-circle distance to the
 * nearest remaining port cell. After a port is reached, the cell chain is
 * string-pulled: a bend is dropped when every cell the straight segment
 * touches is water, however far the grid path bowed. An offshore 8-connected
 * elbow may slide toward the chord only while both new legs stay water.
 *
 * A polygon or line does not start at its centroid. Every water cell the
 * boundary crosses is a departure with cost zero, so each port leaves from the
 * boundary cell that minimizes the water path. The drawn string begins at the
 * point on that boundary, inside the chosen cell, closest to the next bend.
 *
 * Land polygons are split at ±180 before they are written into the resolution-9
 * archive, and the cells on that cut are left out, so they read as water. A
 * bitmap cell on the cut stays water only when a short walk east and west,
 * still in that same archive, fails to find land on both sides. Land on both
 * sides is the missing strip, and the cell becomes a wall.
 *
 * A port is not the nearest water cell. That cell may be a lake, or mixed
 * cells may stand between the point and the sea. Water connected to the
 * departure is the ocean. Each port may cross a few kilometers of land, and a
 * longer stretch of mixed cells, to an ocean cell. Mixed distance counts more
 * than water, so the walk stays in a channel, but a nearer mouth still beats
 * a thinner gap at the far end of a sound. Water along the way, including a
 * sealed inlet, spends neither budget. A cell already claimed by another port
 * yields the neighboring ocean cell, so the next port stays in that entrance.
 * The search itself stays on ocean water. The crossing is appended after the
 * string pull, so the line reaches the point.
 *
 * The walk is recorded so it can be replayed, or timed cold with nothing drawn.
 */
import { Feature, MultiPolygon, Polygon, Position } from "geojson";
import { LandOccupancy } from "@seasketch/h3-land/client";
import { FlatGeobufSource } from "fgb-source";
import { LandPolygons, VectorExitDebug, VectorExitStats } from "./vectorExit";
export declare const LAND_POLYGONS_URL = "https://uploads.seasketch.org/land-big-2.fgb";
/**
 * Land polygons from the OSM land FlatGeobuf, opened on first use. Boxes
 * may sit outside ±180; they are wrapped and split at the antimeridian.
 */
/** Land polygons from a source the caller already opened. */
export declare function landPolygonsFromSource(land: FlatGeobufSource<Feature<Polygon | MultiPolygon>>): LandPolygons;
export declare function landPolygonsFrom(url?: string): LandPolygons;
export declare function kindName(kind: number): "land" | "mixed" | "inland" | "water" | null;
export declare const RANK_COLOR: string[];
export type Port = {
    name: string;
    country: string;
    lng: number;
    lat: number;
    /** Stable feature id, when the caller has one. The viewer omits it. */
    id?: number;
    properties?: Record<string, unknown>;
};
/** One bitmap cell the exit asked about: flood water or not. */
export type ProbeDecision = {
    position: Position;
    ok: boolean;
};
/** How each port in the goal pool got its target cell. */
export type ExitReport = {
    port: string;
    lng: number;
    lat: number;
    /**
     * `open`: the port sits on flood water. `vector`: routed out over the land
     * polygons. `shore`: the budgeted bitmap walk. `none`: nothing worked.
     */
    method: "open" | "vector" | "shore" | "none";
    /** False when the port ended with no target. */
    found: boolean;
    /** The walk ran twice because a port in flight at the same time took its cell. */
    retried?: boolean;
    /** `water` followed polygon water; `land` crossed filled land. */
    phase?: "water" | "land" | "none";
    landMeters: number;
    waterMeters: number;
    ms: number;
    stats: VectorExitStats | null;
    probes: ProbeDecision[];
    /** Set on traced runs for vector exits. */
    debug: VectorExitDebug | null;
};
export type Node = {
    index: number;
    g: number;
    h: number;
    parent: number;
    expanded: number;
};
type Step = {
    node: number;
    discovered: number[];
};
export type Route = {
    rank: number;
    port: Port;
    pathMeters: number;
    rawMeters: number;
    raw: Position[];
    smoothed: Position[];
    rawVerts: number;
    smoothVerts: number;
    step: number;
};
type Stop = "found" | "exhausted" | "distance" | "expansions" | "cancelled";
export type SearchOptions = {
    degrees: number;
    margin: number;
    maxMeters: number;
    maxExpansions: number;
    maxGoals: number;
    maxResults: number;
    /**
     * Outer rings of a polygon, or the parts of a line. When set, every route
     * leaves the boundary instead of `origin`. A point start omits this.
     */
    rings?: Position[][];
    /** Land polygons for ports the shore walk cannot reach. Without it those ports are skipped. */
    landPolygons?: LandPolygons;
    /** Record the grid walk, the raw centerline, and exit rasters. Off for the worker. */
    trace?: boolean;
    cancelled: () => boolean;
    onProgress?: (text: string) => void;
};
export type Grid = {
    originLng: number;
    originLat: number;
    degrees: number;
    cols: number;
    rows: number;
    /** 0 ocean, 1 land, 2 mixed, 3 inland water. */
    kinds: Uint8Array;
};
export type SearchResult = {
    grid: Grid;
    nodes: Node[];
    steps: Step[];
    routes: Route[];
    goals: Array<{
        lng: number;
        lat: number;
        name: string;
        reached: boolean;
        /** Center of the ocean cell the search aims at, or null if this port was not given one. */
        target: Position | null;
        /** Shore crossing from that ocean cell to the catalog point. */
        approach: Position[] | null;
    }>;
    start: Position;
    /** Water cells seeded at cost zero. One for a point start. */
    starts: number;
    expansions: number;
    classified: number;
    uniqueCells: number;
    classifyMs: number;
    /** Ocean label plus the walk from each port. Includes cells read for that. */
    shoreMs: number;
    /** How every port in the goal pool got its target, and the time the pool took. Part of shoreMs. */
    exits: ExitReport[];
    exitMs: number;
    searchMs: number;
    smoothMs: number;
    /** Water cells connected to the departure. */
    reachable: number;
    requests: number;
    bytes: number;
    stop: Stop;
    land: number;
    mixed: number;
    inland: number;
    ocean: number;
};
export declare function wrapLng(lng: number): number;
export declare function km(meters: number): string;
export declare const WATER_PATH_RESOLUTION_DEGREES: {
    readonly low: 0.02;
    readonly medium: 0.01;
    readonly high: 0.005;
};
export type WaterPathResolution = keyof typeof WATER_PATH_RESOLUTION_DEGREES;
export declare function sampleResolution(degrees: number): number;
export declare function archiveFor(resolution: number): string;
export declare function centroid(feature: Feature): Position;
/** Outer rings of a polygon, or the parts of a line. Empty for a point. */
export declare function geometryRings(feature: Feature): Position[][];
export declare function searchBitmap(land: LandOccupancy, origin: Position, ports: Port[], options: SearchOptions): Promise<SearchResult>;
export {};
//# sourceMappingURL=bitmapSearch.d.ts.map