"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INLAND_WATER = void 0;
exports.findVectorExit = findVectorExit;
const METERS_PER_DEGREE = 111320;
const RAD = Math.PI / 180;
const UNLOADED = 0;
const WATER = 1;
const LAND = 2;
/** Probe result: bitmap water that does not join the ocean flood. */
exports.INLAND_WATER = -2;
/** Extra water meters to keep looking for an inlet after the first ocean. */
const INLET_SLACK_METERS = 8000;
/** Four edge neighbors, then four corner neighbors. */
const DIR_X = [1, -1, 0, 0, 1, 1, -1, -1];
const DIR_Y = [0, 0, 1, -1, 1, -1, 1, -1];
/** Each tile is one request to the land source, so a crossing takes a handful. */
const TILE_METERS = 8000;
const YIELD_EVERY = 4096;
/** Binary min-heap over typed arrays. `popKey` holds the key of the last pop. */
class Heap {
    constructor() {
        this.ids = new Int32Array(1024);
        this.keys = new Float64Array(1024);
        this.size = 0;
        this.popKey = 0;
    }
    push(id, key) {
        if (this.size === this.ids.length) {
            const ids = new Int32Array(this.size * 2);
            ids.set(this.ids);
            this.ids = ids;
            const keys = new Float64Array(this.size * 2);
            keys.set(this.keys);
            this.keys = keys;
        }
        let i = this.size++;
        const ids = this.ids;
        const keys = this.keys;
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (keys[parent] <= key)
                break;
            ids[i] = ids[parent];
            keys[i] = keys[parent];
            i = parent;
        }
        ids[i] = id;
        keys[i] = key;
    }
    pop() {
        const ids = this.ids;
        const keys = this.keys;
        const out = ids[0];
        this.popKey = keys[0];
        const n = --this.size;
        if (n > 0) {
            const id = ids[n];
            const key = keys[n];
            let i = 0;
            for (;;) {
                let child = 2 * i + 1;
                if (child >= n)
                    break;
                if (child + 1 < n && keys[child + 1] < keys[child])
                    child++;
                if (keys[child] >= key)
                    break;
                ids[i] = ids[child];
                keys[i] = keys[child];
                i = child;
            }
            ids[i] = id;
            keys[i] = key;
        }
        return out;
    }
}
function yieldToBrowser() {
    const scheduler = globalThis.scheduler;
    if (scheduler?.yield)
        return scheduler.yield();
    return new Promise((resolve) => setTimeout(resolve, 0));
}
function wrapLng(lng) {
    return ((((lng + 180) % 360) + 360) % 360) - 180;
}
function polygonRings(feature) {
    const geometry = feature.geometry;
    if (!geometry)
        return [];
    if (geometry.type === "Polygon")
        return [geometry.coordinates];
    if (geometry.type === "MultiPolygon")
        return geometry.coordinates;
    return [];
}
/**
 * Walk from `port` to the first water the probe accepts. Returns null only
 * when cancelled; a walk that gives up returns `goal: -1` with its stats.
 *
 * `port.lng` may sit outside ±180 when the caller frames longitudes around
 * its own grid. Output positions use the same frame.
 */
async function findVectorExit(port, land, probe, options) {
    const { stepMeters: step, landCost } = options;
    const cosLat = Math.max(0.05, Math.cos(port.lat * RAD));
    const metersPerLng = METERS_PER_DEGREE * cosLat;
    const half = Math.ceil(options.reachMeters / step);
    const n = half * 2 + 1;
    const count = n * n;
    const kinds = new Uint8Array(count);
    const tileCells = Math.max(1, Math.round(TILE_METERS / step));
    const tilesAcross = Math.ceil(n / tileCells);
    const loaded = new Uint8Array(tilesAcross * tilesAcross);
    const features = [];
    const seen = new Set();
    const tileRects = [];
    const debugTiles = [];
    const debugFeatures = [];
    let loadedIx0 = Infinity;
    let loadedIy0 = Infinity;
    let loadedIx1 = -Infinity;
    let loadedIy1 = -Infinity;
    const stats = {
        tiles: 0,
        features: 0,
        vertices: 0,
        fetchMs: 0,
        rasterMs: 0,
        walkMs: 0,
        probeMs: 0,
        expansions: 0,
        probes: 0,
    };
    const toX = (lng) => {
        let d = lng - port.lng;
        while (d > 180)
            d -= 360;
        while (d < -180)
            d += 360;
        return d * metersPerLng;
    };
    const toY = (lat) => (lat - port.lat) * METERS_PER_DEGREE;
    const cellX = (ix) => (ix - half) * step;
    const cellY = (iy) => (iy - half) * step;
    const lngOf = (x) => port.lng + x / metersPerLng;
    const latOf = (y) => port.lat + y / METERS_PER_DEGREE;
    const featureKey = (feature) => {
        const offset = feature.properties
            ?.__offset;
        if (typeof offset === "number")
            return `o${offset}`;
        if (feature.id != null)
            return `i${String(feature.id)}`;
        return JSON.stringify(feature.geometry).slice(0, 200);
    };
    const addFeature = (feature) => {
        const key = featureKey(feature);
        if (seen.has(key))
            return;
        seen.add(key);
        if (options.debug)
            debugFeatures.push(feature);
        for (const polygon of polygonRings(feature)) {
            const rings = [];
            let minX = Infinity;
            let minY = Infinity;
            let maxX = -Infinity;
            let maxY = -Infinity;
            for (const ring of polygon) {
                const local = [];
                for (const position of ring) {
                    const x = toX(position[0]);
                    const y = toY(position[1]);
                    local.push({ x, y });
                    if (x < minX)
                        minX = x;
                    if (y < minY)
                        minY = y;
                    if (x > maxX)
                        maxX = x;
                    if (y > maxY)
                        maxY = y;
                }
                stats.vertices += local.length;
                rings.push(local);
            }
            if (rings.length === 0)
                continue;
            const local = { rings, minX, minY, maxX, maxY };
            features.push(local);
            // A polygon fetched later can overlap a tile that is already water.
            for (const tile of tileRects) {
                if (local.maxX < cellX(tile.ix0) ||
                    local.minX > cellX(tile.ix1) ||
                    local.maxY < cellY(tile.iy0) ||
                    local.minY > cellY(tile.iy1)) {
                    continue;
                }
                paint(local, tile.ix0, tile.iy0, tile.ix1, tile.iy1);
            }
        }
        stats.features++;
    };
    /** Paint one polygon's land into the rows and columns of a tile. */
    const paint = (feature, ix0, iy0, ix1, iy1) => {
        const crossings = [];
        for (let iy = iy0; iy <= iy1; iy++) {
            const y = cellY(iy);
            if (y < feature.minY || y > feature.maxY)
                continue;
            crossings.length = 0;
            for (const ring of feature.rings) {
                for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                    const a = ring[j];
                    const b = ring[i];
                    if (a.y > y === b.y > y)
                        continue;
                    crossings.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
                }
            }
            if (crossings.length < 2)
                continue;
            crossings.sort((p, q) => p - q);
            for (let k = 0; k + 1 < crossings.length; k += 2) {
                const from = Math.max(ix0, Math.ceil(crossings[k] / step) + half);
                const to = Math.min(ix1, Math.ceil(crossings[k + 1] / step) - 1 + half);
                const row = iy * n;
                for (let ix = from; ix <= to; ix++)
                    kinds[row + ix] = LAND;
            }
        }
    };
    const loadTile = async (tx, ty) => {
        const tile = ty * tilesAcross + tx;
        if (loaded[tile])
            return;
        loaded[tile] = 1;
        stats.tiles++;
        const ix0 = tx * tileCells;
        const iy0 = ty * tileCells;
        const ix1 = Math.min(n - 1, ix0 + tileCells - 1);
        const iy1 = Math.min(n - 1, iy0 + tileCells - 1);
        const pad = step;
        const west = lngOf(cellX(ix0) - pad);
        const east = lngOf(cellX(ix1) + pad);
        const south = latOf(cellY(iy0) - pad);
        const north = latOf(cellY(iy1) + pad);
        if (ix0 < loadedIx0)
            loadedIx0 = ix0;
        if (iy0 < loadedIy0)
            loadedIy0 = iy0;
        if (ix1 > loadedIx1)
            loadedIx1 = ix1;
        if (iy1 > loadedIy1)
            loadedIy1 = iy1;
        tileRects.push({ ix0, iy0, ix1, iy1 });
        if (options.debug)
            debugTiles.push([west, south, east, north]);
        const started = performance.now();
        const fetched = await land.fetch(west, south, east, north);
        stats.fetchMs += performance.now() - started;
        for (const feature of fetched)
            addFeature(feature);
        const painting = performance.now();
        const minX = cellX(ix0) - pad;
        const maxX = cellX(ix1) + pad;
        const minY = cellY(iy0) - pad;
        const maxY = cellY(iy1) + pad;
        for (const feature of features) {
            if (feature.maxX < minX ||
                feature.minX > maxX ||
                feature.maxY < minY ||
                feature.minY > maxY) {
                continue;
            }
            paint(feature, ix0, iy0, ix1, iy1);
        }
        for (let iy = iy0; iy <= iy1; iy++) {
            const row = iy * n;
            for (let ix = ix0; ix <= ix1; ix++) {
                if (kinds[row + ix] === UNLOADED)
                    kinds[row + ix] = WATER;
            }
        }
        stats.rasterMs += performance.now() - painting;
    };
    const ensure = async (index) => {
        if (kinds[index] !== UNLOADED)
            return;
        const ix = index % n;
        const iy = (index - ix) / n;
        await loadTile(Math.floor(ix / tileCells), Math.floor(iy / tileCells));
    };
    const cost = new Float32Array(count);
    const landOf = new Float32Array(count);
    const wetOf = new Uint8Array(count);
    const inlandOf = new Uint8Array(count);
    const parent = new Int32Array(count);
    const closed = new Uint8Array(count);
    const start = half * n + half;
    const diagonalStep = step * Math.SQRT2;
    const splashMeters = options.splashMeters ?? 800;
    let goalCell = -1;
    let goalId = -1;
    let phase = "none";
    let bestDirect = -1;
    let bestDirectId = -1;
    let bestDirectCost = Infinity;
    let seenInland = false;
    const walk = async (allowLandAfterWater, maxLand) => {
        cost.fill(Infinity);
        landOf.fill(0);
        wetOf.fill(0);
        inlandOf.fill(0);
        parent.fill(-1);
        closed.fill(0);
        cost[start] = 0;
        if (!allowLandAfterWater) {
            bestDirect = -1;
            bestDirectId = -1;
            bestDirectCost = Infinity;
            seenInland = false;
        }
        const heap = new Heap();
        heap.push(start, 0);
        const cap = stats.expansions + options.maxExpansions;
        while (heap.size > 0) {
            const index = heap.pop();
            if (closed[index])
                continue;
            if (heap.popKey > cost[index] + 1e-6)
                continue;
            if (!allowLandAfterWater &&
                !seenInland &&
                bestDirect >= 0 &&
                heap.popKey > bestDirectCost + INLET_SLACK_METERS) {
                goalCell = bestDirect;
                goalId = bestDirectId;
                return true;
            }
            closed[index] = 1;
            stats.expansions++;
            if (stats.expansions > cap)
                break;
            if (stats.expansions % YIELD_EVERY === 0) {
                options.onProgress?.(`exit · ${stats.expansions.toLocaleString()} cells · ${stats.tiles} tiles`);
                await yieldToBrowser();
                if (options.cancelled())
                    return false;
            }
            if (kinds[index] === UNLOADED) {
                await ensure(index);
                if (options.cancelled())
                    return false;
            }
            const ix = index % n;
            const iy = (index - ix) / n;
            const wet = wetOf[index] === 1 || kinds[index] === WATER;
            if (wet)
                wetOf[index] = 1;
            if (kinds[index] === WATER && index !== start) {
                stats.probes++;
                let id = probe(lngOf(cellX(ix)), latOf(cellY(iy)));
                if (typeof id !== "number") {
                    const probing = performance.now();
                    id = await id;
                    stats.probeMs += performance.now() - probing;
                    if (options.cancelled())
                        return false;
                }
                if (id >= 0) {
                    // Ocean reached only over land is a beach crossing, not a channel.
                    if (allowLandAfterWater || inlandOf[index] === 1) {
                        goalCell = index;
                        goalId = id;
                        return true;
                    }
                    if (cost[index] < bestDirectCost) {
                        bestDirectCost = cost[index];
                        bestDirect = index;
                        bestDirectId = id;
                    }
                    continue;
                }
                if (id === exports.INLAND_WATER) {
                    inlandOf[index] = 1;
                    seenInland = true;
                }
            }
            const here = cost[index];
            const landHere = landOf[index];
            for (let d = 0; d < 8; d++) {
                const nx = ix + DIR_X[d];
                const ny = iy + DIR_Y[d];
                if (nx < 0 || ny < 0 || nx >= n || ny >= n)
                    continue;
                const next = ny * n + nx;
                if (closed[next])
                    continue;
                if (kinds[next] === UNLOADED) {
                    await ensure(next);
                    if (options.cancelled())
                        return false;
                }
                let kind = kinds[next];
                const diagonal = d >= 4;
                if (diagonal && kind === WATER) {
                    const sideA = iy * n + nx;
                    const sideB = ny * n + ix;
                    if (kinds[sideA] === UNLOADED)
                        await ensure(sideA);
                    if (kinds[sideB] === UNLOADED)
                        await ensure(sideB);
                    if (kinds[sideA] === LAND || kinds[sideB] === LAND)
                        kind = LAND;
                }
                if (kind === LAND && wet && !allowLandAfterWater)
                    continue;
                const length = diagonal ? diagonalStep : step;
                const nextLand = landHere + (kind === LAND ? length : 0);
                if (nextLand > maxLand)
                    continue;
                const nextCost = here + (kind === LAND ? length * landCost : length);
                if (nextCost >= cost[next])
                    continue;
                cost[next] = nextCost;
                landOf[next] = nextLand;
                wetOf[next] = wet || kind === WATER ? 1 : 0;
                inlandOf[next] = inlandOf[index] === 1 ? 1 : 0;
                parent[next] = index;
                heap.push(next, nextCost);
            }
        }
        return false;
    };
    const walkStarted = performance.now();
    // Harbor and inlet first: get off the dock, then stay in polygon water.
    if (await walk(false, Math.min(splashMeters, options.maxLandMeters))) {
        phase = "water";
    }
    else if (bestDirect >= 0) {
        // No inlet. The nearest ocean the probe already accepted — not a
        // leftover cell found after a mixed shoreline was treated as a harbor.
        goalCell = bestDirect;
        goalId = bestDirectId;
        phase = "water";
    }
    else if (!options.cancelled()) {
        goalCell = -1;
        goalId = -1;
        if (await walk(true, options.maxLandMeters))
            phase = "land";
    }
    stats.walkMs = performance.now() - walkStarted;
    if (options.cancelled())
        return null;
    // Cells from the accepted water back to the port.
    const cells = [];
    for (let cursor = goalCell; cursor >= 0; cursor = parent[cursor]) {
        cells.push(cursor);
        if (cells.length > count)
            break;
    }
    const centerOf = (index) => {
        const ix = index % n;
        const iy = (index - ix) / n;
        return [lngOf(cellX(ix)), latOf(cellY(iy))];
    };
    /** The raster and the walk over it, cropped to the tiles that were loaded. */
    const buildDebug = () => {
        if (!options.debug)
            return null;
        if (!Number.isFinite(loadedIx0)) {
            return {
                tiles: debugTiles,
                features: debugFeatures,
                raster: {
                    width: 0,
                    height: 0,
                    bounds: [port.lng, port.lat, port.lng, port.lat],
                    kinds: new Uint8Array(0),
                    visited: new Uint8Array(0),
                },
                chain: [],
                phase,
            };
        }
        const width = loadedIx1 - loadedIx0 + 1;
        const height = loadedIy1 - loadedIy0 + 1;
        const rasterKinds = new Uint8Array(width * height);
        const visited = new Uint8Array(width * height);
        for (let row = 0; row < height; row++) {
            // Image rows run north to south; raster rows run south to north.
            const iy = loadedIy1 - row;
            const from = iy * n + loadedIx0;
            rasterKinds.set(kinds.subarray(from, from + width), row * width);
            const closedRow = closed.subarray(from, from + width);
            for (let col = 0; col < width; col++) {
                if (closedRow[col])
                    visited[row * width + col] = 1;
            }
        }
        for (const index of cells) {
            const ix = index % n;
            const iy = (index - ix) / n;
            visited[(loadedIy1 - iy) * width + (ix - loadedIx0)] = 2;
        }
        const half = step / 2;
        return {
            tiles: debugTiles,
            features: debugFeatures,
            raster: {
                width,
                height,
                bounds: [
                    lngOf(cellX(loadedIx0) - half),
                    latOf(cellY(loadedIy0) - half),
                    lngOf(cellX(loadedIx1) + half),
                    latOf(cellY(loadedIy1) + half),
                ],
                kinds: rasterKinds,
                visited,
            },
            chain: cells.map(centerOf),
            phase,
        };
    };
    if (goalCell < 0) {
        return {
            goal: -1,
            approach: [],
            landMeters: 0,
            waterMeters: 0,
            stats,
            phase,
            debug: buildDebug(),
        };
    }
    const isLand = (index) => kinds[index] === LAND;
    // Every cell a straight segment between two cell centers touches.
    const segmentLand = (a, b) => {
        const ax = a % n;
        const ay = (a - ax) / n;
        const bx = b % n;
        const by = (b - bx) / n;
        const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 3;
        for (let s = 0; s <= steps; s++) {
            const t = steps === 0 ? 0 : s / steps;
            const ix = Math.round(ax + (bx - ax) * t);
            const iy = Math.round(ay + (by - ay) * t);
            const index = iy * n + ix;
            if (kinds[index] !== WATER)
                return true;
        }
        return false;
    };
    // Pull water and land separately. A shortcut from ocean to the port would
    // otherwise jump the island and hide the inlet the walk just found.
    const pulled = [cells[0]];
    let i = 0;
    while (i < cells.length - 1) {
        const land0 = isLand(cells[i]);
        let best = i + 1;
        for (let j = i + 2; j < cells.length && isLand(cells[j]) === land0; j++) {
            if (land0 || !segmentLand(cells[i], cells[j]))
                best = j;
        }
        pulled.push(cells[best]);
        i = best;
    }
    const approach = pulled.map(centerOf);
    approach[approach.length - 1] = [port.lng, port.lat];
    let landMeters = 0;
    let waterMeters = 0;
    for (let k = 1; k < cells.length; k++) {
        const a = cells[k - 1];
        const b = cells[k];
        const diagonal = Math.abs((a % n) - (b % n)) === 1 &&
            Math.abs(Math.floor(a / n) - Math.floor(b / n)) === 1;
        const length = diagonal ? step * Math.SQRT2 : step;
        if (isLand(b))
            landMeters += length;
        else
            waterMeters += length;
    }
    return {
        goal: goalId,
        approach,
        landMeters,
        waterMeters,
        stats,
        phase,
        debug: buildDebug(),
    };
}
//# sourceMappingURL=vectorExit.js.map