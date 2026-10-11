"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_WATER_PATH_RESULTS = exports.DEFAULT_WATER_PATH_DISTANCE_KM = exports.DEFAULT_WATER_PATH_MAX_RESULTS = exports.MAX_DISTANCE_TO_FEATURES_KM = void 0;
exports.searchWaterPathNearestH3 = searchWaterPathNearestH3;
const boolean_point_in_polygon_1 = __importDefault(require("@turf/boolean-point-in-polygon"));
const distance_1 = __importDefault(require("@turf/distance"));
const h3_js_1 = require("h3-js");
const bboxUtils_1 = require("../utils/bboxUtils");
const bboxForCell_1 = require("./bboxForCell");
const constants_1 = require("./constants");
const coverGeometry_1 = require("./coverGeometry");
const landOccupancy_1 = require("./landOccupancy");
const adaptiveGrid_1 = require("./adaptiveGrid");
const minHeap_1 = require("./minHeap");
const straightenWaterPath_1 = require("./straightenWaterPath");
/**
 * Fine water-path cells (~460 m). Shore search keeps its own floor
 * (`FINE_H3_RESOLUTION`); this one is local so harbors and channels stay
 * reachable without changing that search.
 */
const WATER_PATH_FINE_RESOLUTION = 8;
/**
 * Largest radius the engine will search. A miss expands the whole disk, so
 * this stays well under the overlay worker's practical time budget.
 * Retune with the bench when the grid changes.
 */
exports.MAX_DISTANCE_TO_FEATURES_KM = 400;
/** Default number of nearest features when the caller does not set one. */
exports.DEFAULT_WATER_PATH_MAX_RESULTS = 3;
/** Default search radius: 200 statute miles, stored in kilometres. */
exports.DEFAULT_WATER_PATH_DISTANCE_KM = 200 * 1.609344;
exports.MAX_WATER_PATH_RESULTS = 25;
/**
 * Extra rough hits kept before the shoreline pull. Ports are sparse, so
 * refining a couple past `maxResults` is enough to re-rank by real distance.
 */
const ROUGH_EXTRA = 2;
const MAX_EXPANSIONS = 40000;
function wrapLng(lng) {
    return ((((lng + 180) % 360) + 360) % 360) - 180;
}
function normalizeGeometry(geometry) {
    const clone = JSON.parse(JSON.stringify(geometry));
    const walk = (coords) => {
        if (!Array.isArray(coords))
            return coords;
        if (typeof coords[0] === "number") {
            coords[0] = wrapLng(coords[0]);
            return coords;
        }
        return coords.map(walk);
    };
    clone.coordinates = walk(clone.coordinates);
    return clone;
}
function cellCenter(cell) {
    const [lat, lng] = (0, h3_js_1.cellToLatLng)(cell);
    return [wrapLng(lng), lat];
}
function unwrapCoordinates(coords) {
    if (coords.length === 0)
        return [];
    const out = [[coords[0][0], coords[0][1]]];
    for (let i = 1; i < coords.length; i++) {
        let lng = coords[i][0];
        const prev = out[i - 1][0];
        while (lng - prev > 180)
            lng -= 360;
        while (lng - prev < -180)
            lng += 360;
        out.push([lng, coords[i][1]]);
    }
    return out;
}
function positionsOf(geometry) {
    if (!geometry)
        return [];
    if (geometry.type === "Point")
        return [geometry.coordinates];
    if (geometry.type === "MultiPoint")
        return geometry.coordinates;
    return [];
}
function publicProperties(properties, includedColumns) {
    if (!properties)
        return {};
    const keys = includedColumns?.length
        ? includedColumns
        : Object.keys(properties);
    const out = {};
    for (const key of keys) {
        if (key.startsWith("__"))
            continue;
        if (key in properties)
            out[key] = properties[key];
    }
    return out;
}
function featureId(feature, position) {
    const offset = feature.properties
        ?.__offset;
    if (typeof offset === "number" && Number.isFinite(offset))
        return offset;
    return (Math.round(position[0] * 1e5) * 1000003 + Math.round(position[1] * 1e5));
}
function lineFeature(coords) {
    return {
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: coords },
    };
}
function passable(info, resolution) {
    if (info.kind === "water")
        return true;
    if (info.kind === "land")
        return false;
    return resolution >= WATER_PATH_FINE_RESOLUTION && !info.centerOnLand;
}
/**
 * True when `child` shares a border with `cell`. Used so a mixed cell is
 * entered from the near shore instead of jumping to children on the far
 * side of an island.
 */
function cellsTouch(cell, child) {
    const resolution = (0, h3_js_1.getResolution)(cell);
    const [lat, lng] = (0, h3_js_1.cellToLatLng)(child);
    const samples = [[lat, wrapLng(lng)]];
    for (const [boundaryLat, boundaryLng] of (0, h3_js_1.cellToBoundary)(child)) {
        samples.push([boundaryLat, wrapLng(boundaryLng)]);
    }
    for (const [sampleLat, sampleLng] of samples) {
        if ((0, h3_js_1.latLngToCell)(sampleLat, sampleLng, resolution) === cell)
            return true;
    }
    const limit = (0, h3_js_1.getHexagonEdgeLengthAvg)(resolution, "m") +
        (0, h3_js_1.getHexagonEdgeLengthAvg)((0, h3_js_1.getResolution)(child), "m");
    return ((0, distance_1.default)(cellCenter(cell), cellCenter(child), { units: "meters" }) <= limit);
}
/**
 * Hex-grid water path. Open ocean steps up to coarse cells; the shore stays
 * on fine cells, then the chain is pulled taut. Kept so it can be compared
 * with the tangent router.
 */
async function searchWaterPathNearestH3(feature, points, land, options) {
    if (!feature.geometry) {
        throw new Error("searchWaterPathNearest: feature.geometry is required");
    }
    const maxResults = Math.min(exports.MAX_WATER_PATH_RESULTS, Math.max(1, options?.maxResults ?? exports.DEFAULT_WATER_PATH_MAX_RESULTS));
    const requestedKm = options?.maxDistanceKm ?? exports.DEFAULT_WATER_PATH_DISTANCE_KM;
    const maxDistanceMeters = Math.min(requestedKm, exports.MAX_DISTANCE_TO_FEATURES_KM) * 1000;
    const geometry = normalizeGeometry(feature.geometry);
    const spacing = (0, h3_js_1.getHexagonEdgeLengthAvg)(WATER_PATH_FINE_RESOLUTION, "m") / 2;
    const samples = (0, coverGeometry_1.densifiedPositionsFromGeometry)(geometry, spacing);
    const occupancy = new Map();
    const classCache = new Map();
    const landRegionCache = new Map();
    const pointRegionCache = new Map();
    const pointCache = new Map();
    const landSource = land;
    function regionKey(cell) {
        const resolution = (0, h3_js_1.getResolution)(cell);
        return resolution > 6 ? (0, h3_js_1.cellToParent)(cell, 6) : cell;
    }
    function positionInCell(position, cell) {
        const [minX, minY, maxX, maxY] = (0, bboxForCell_1.bboxForCell)(cell);
        const lat = position[1];
        if (lat < minY || lat > maxY)
            return false;
        const lng = wrapLng(position[0]);
        if (minX > maxX)
            return lng >= minX || lng <= maxX;
        return lng >= minX && lng <= maxX;
    }
    async function fetchFeatures(source, cell) {
        if (source === land && !(0, landOccupancy_1.cellHasLand)(cell, landSource, occupancy)) {
            return [];
        }
        const cleaned = (0, bboxUtils_1.cleanBBox)((0, bboxForCell_1.bboxForCell)(cell));
        const parts = (0, bboxUtils_1.splitBBoxAntimeridian)(cleaned);
        const found = [];
        const seen = new Set();
        for (const part of parts) {
            const env = (0, bboxUtils_1.bboxToEnvelope)(part);
            const queryPlan = source.createPlan(env);
            for await (const feature of source.getFeaturesAsync(env, {
                queryPlan,
            })) {
                const offset = feature.properties
                    ?.__offset;
                if (typeof offset === "number") {
                    if (seen.has(offset))
                        continue;
                    seen.add(offset);
                }
                found.push(feature);
            }
        }
        return found;
    }
    function landInCell(cell) {
        const key = regionKey(cell);
        const cached = landRegionCache.get(key);
        if (cached)
            return cached;
        const pending = fetchFeatures(land, key);
        landRegionCache.set(key, pending);
        return pending;
    }
    function pointInside(sample, polys) {
        const [lng, lat] = sample;
        const candidates = [
            [lng, lat],
            [lng + 360, lat],
            [lng - 360, lat],
        ];
        return polys.some((poly) => candidates.some((candidate) => (0, boolean_point_in_polygon_1.default)(candidate, poly)));
    }
    function classify(cell) {
        const cached = classCache.get(cell);
        if (cached)
            return cached;
        const pending = (async () => {
            if (!(0, landOccupancy_1.cellHasLand)(cell, landSource, occupancy)) {
                return { kind: "water", centerOnLand: false };
            }
            if ((0, h3_js_1.getResolution)(cell) < WATER_PATH_FINE_RESOLUTION) {
                return { kind: "mixed", centerOnLand: false };
            }
            const polys = await landInCell(cell);
            if (polys.length === 0)
                return { kind: "water", centerOnLand: false };
            const [lat, lng] = (0, h3_js_1.cellToLatLng)(cell);
            const center = [wrapLng(lng), lat];
            const probes = [center];
            for (const [boundaryLat, boundaryLng] of (0, h3_js_1.cellToBoundary)(cell)) {
                probes.push([wrapLng(boundaryLng), boundaryLat]);
            }
            let inside = 0;
            for (const probe of probes) {
                if (pointInside(probe, polys))
                    inside++;
            }
            const centerOnLand = pointInside(center, polys);
            if (inside === 0)
                return { kind: "water", centerOnLand: false };
            if (inside === probes.length)
                return { kind: "land", centerOnLand: true };
            return { kind: "mixed", centerOnLand };
        })();
        classCache.set(cell, pending);
        return pending;
    }
    function pointsInRegion(cell) {
        const key = regionKey(cell);
        const cached = pointRegionCache.get(key);
        if (cached)
            return cached;
        const pending = (async () => {
            const features = await fetchFeatures(points, key);
            const indexed = [];
            const seen = new Set();
            for (const pointFeature of features) {
                const positions = positionsOf(pointFeature.geometry);
                if (positions.length === 0)
                    continue;
                const position = [
                    wrapLng(positions[0][0]),
                    positions[0][1],
                ];
                const id = featureId(pointFeature, position);
                if (seen.has(id))
                    continue;
                seen.add(id);
                indexed.push({
                    id,
                    position,
                    properties: publicProperties(pointFeature.properties, options?.includedColumns),
                });
            }
            return indexed;
        })();
        pointRegionCache.set(key, pending);
        return pending;
    }
    async function pointsInCell(cell) {
        const cached = pointCache.get(cell);
        if (cached)
            return cached;
        const region = await pointsInRegion(cell);
        const filtered = region.filter((hit) => positionInCell(hit.position, cell));
        pointCache.set(cell, filtered);
        return filtered;
    }
    const startCells = new Set();
    for (const [lng, lat] of samples) {
        if (!Number.isFinite(lng) || !Number.isFinite(lat))
            continue;
        startCells.add((0, h3_js_1.latLngToCell)(lat, wrapLng(lng), WATER_PATH_FINE_RESOLUTION));
    }
    const starts = [];
    for (const cell of startCells) {
        const info = await classify(cell);
        if (passable(info, WATER_PATH_FINE_RESOLUTION)) {
            starts.push(cell);
            continue;
        }
        for (const neighbor of (0, adaptiveGrid_1.sameResNeighbors)(cell)) {
            const neighborInfo = await classify(neighbor);
            if (passable(neighborInfo, WATER_PATH_FINE_RESOLUTION)) {
                starts.push(neighbor);
            }
        }
    }
    if (starts.length === 0) {
        return { features: [], exceededLimit: false, candidates: [] };
    }
    const best = new Map();
    const cameFrom = new Map();
    const heap = new minHeap_1.MinHeap();
    for (const cell of starts) {
        if (best.has(cell))
            continue;
        best.set(cell, 0);
        cameFrom.set(cell, null);
        heap.push(0, cell);
    }
    const hits = new Map();
    const rough = new Map();
    const expanded = new Set();
    let exceededLimit = false;
    let expansions = 0;
    const chainTo = (cell) => {
        const chain = [];
        const guard = new Set();
        let cursor = cell;
        while (cursor && !guard.has(cursor)) {
            guard.add(cursor);
            chain.push(cursor);
            cursor = cameFrom.get(cursor);
        }
        chain.reverse();
        return chain;
    };
    const consider = (node, from, g) => {
        if (node === from)
            return;
        const step = (0, distance_1.default)(cellCenter(from), cellCenter(node), {
            units: "meters",
        });
        const next = g + step;
        if (next > maxDistanceMeters)
            return;
        const prev = best.get(node);
        if (prev !== undefined && next >= prev - 0.5)
            return;
        best.set(node, next);
        cameFrom.set(node, from);
        heap.push(next, node);
    };
    async function segmentHitsLand(start, end) {
        let lng = end[0];
        while (lng - start[0] > 180)
            lng -= 360;
        while (lng - start[0] < -180)
            lng += 360;
        const span = (0, distance_1.default)(start, [lng, end[1]], { units: "meters" });
        const steps = Math.max(1, Math.ceil(span / 40));
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const sample = [
                wrapLng(start[0] + (lng - start[0]) * t),
                start[1] + (end[1] - start[1]) * t,
            ];
            const polys = await landInCell((0, h3_js_1.latLngToCell)(sample[1], sample[0], WATER_PATH_FINE_RESOLUTION));
            if (pointInside(sample, polys))
                return true;
        }
        return false;
    }
    async function edgeCrossesLand(from, to) {
        const fromFine = (0, h3_js_1.getResolution)(from) >= WATER_PATH_FINE_RESOLUTION;
        const toFine = (0, h3_js_1.getResolution)(to) >= WATER_PATH_FINE_RESOLUTION;
        if (!fromFine && !toFine)
            return false;
        return segmentHitsLand(cellCenter(from), cellCenter(to));
    }
    async function tryConsider(node, from, g) {
        if (await edgeCrossesLand(from, node))
            return;
        consider(node, from, g);
    }
    while (heap.size > 0) {
        const popped = heap.pop();
        if (!popped)
            break;
        const g = popped.key;
        const cell = popped.value;
        const known = best.get(cell);
        if (known === undefined || g > known + 0.5)
            continue;
        if (expanded.has(cell))
            continue;
        if (g > maxDistanceMeters) {
            exceededLimit = true;
            break;
        }
        if (rough.size >= maxResults + ROUGH_EXTRA) {
            const rankedRough = Array.from(rough.values()).sort((a, b) => a.graphMeters - b.graphMeters);
            const cutoff = rankedRough[maxResults + ROUGH_EXTRA - 1]?.graphMeters ?? Infinity;
            if (g >= cutoff) {
                exceededLimit = true;
                break;
            }
        }
        expanded.add(cell);
        expansions++;
        if (expansions > MAX_EXPANSIONS) {
            exceededLimit = true;
            break;
        }
        const info = await classify(cell);
        const resolution = (0, h3_js_1.getResolution)(cell);
        const canTraverse = passable(info, resolution);
        if (canTraverse && resolution >= WATER_PATH_FINE_RESOLUTION) {
            const center = cellCenter(cell);
            const searchCells = [cell, ...(0, adaptiveGrid_1.sameResNeighbors)(cell)];
            const nearLand = searchCells.some((searchCell) => (0, landOccupancy_1.cellHasLand)(searchCell, landSource, occupancy));
            const indexedCells = nearLand ? searchCells : [];
            const indexedGroups = await Promise.all(indexedCells.map((searchCell) => pointsInCell(searchCell)));
            for (const indexed of indexedGroups) {
                for (const hit of indexed) {
                    const hop = (0, distance_1.default)(center, hit.position, { units: "meters" });
                    const graphMeters = g + hop;
                    if (graphMeters > maxDistanceMeters)
                        continue;
                    const previous = rough.get(hit.id);
                    if (previous && previous.graphMeters <= graphMeters)
                        continue;
                    rough.set(hit.id, {
                        id: hit.id,
                        position: hit.position,
                        properties: hit.properties,
                        graphMeters,
                        cell,
                    });
                }
            }
        }
        if (!canTraverse)
            continue;
        const enterCoarseMixed = async (candidate) => {
            const candidateInfo = await classify(candidate);
            const candidateRes = (0, h3_js_1.getResolution)(candidate);
            if (candidateInfo.kind === "land")
                return;
            if (passable(candidateInfo, candidateRes)) {
                await tryConsider(candidate, cell, g);
                return;
            }
            if (candidateInfo.kind !== "mixed" ||
                candidateRes >= WATER_PATH_FINE_RESOLUTION) {
                return;
            }
            const children = (0, h3_js_1.cellToChildren)(candidate, candidateRes + 1).filter((child) => cellsTouch(cell, child));
            await Promise.all(children.map((child) => enterCoarseMixed(child)));
        };
        const neighborCells = (0, adaptiveGrid_1.sameResNeighbors)(cell);
        await Promise.all(neighborCells.map((neighbor) => classify(neighbor)));
        for (const neighbor of neighborCells) {
            const neighborInfo = await classify(neighbor);
            const neighborRes = (0, h3_js_1.getResolution)(neighbor);
            if (neighborInfo.kind === "mixed" &&
                neighborRes < WATER_PATH_FINE_RESOLUTION) {
                await enterCoarseMixed(neighbor);
                continue;
            }
            if (!passable(neighborInfo, neighborRes))
                continue;
            let node = neighbor;
            if (neighborInfo.kind === "water") {
                while ((0, h3_js_1.getResolution)(node) > constants_1.COARSE_H3_RESOLUTION) {
                    const parent = (0, h3_js_1.cellToParent)(node, (0, h3_js_1.getResolution)(node) - 1);
                    const parentInfo = await classify(parent);
                    if (parentInfo.kind !== "water")
                        break;
                    node = parent;
                }
            }
            await tryConsider(node, cell, g);
        }
    }
    if (process.env.WATER_PATH_DEBUG) {
        console.log("water-path expansions", expansions);
    }
    const candidates = Array.from(rough.values())
        .sort((a, b) => a.graphMeters - b.graphMeters)
        .slice(0, maxResults + ROUGH_EXTRA);
    for (const candidate of candidates) {
        const line = unwrapCoordinates(await (0, straightenWaterPath_1.straightenWaterPath)(geometry, chainTo(candidate.cell), candidate.position, segmentHitsLand));
        let meters = 0;
        for (let i = 1; i < line.length; i++) {
            meters += (0, distance_1.default)(line[i - 1], line[i], { units: "meters" });
        }
        if (meters > maxDistanceMeters || meters <= 0)
            continue;
        hits.set(candidate.id, {
            __id: candidate.id,
            meters,
            properties: candidate.properties,
            geojsonLine: lineFeature(line),
        });
    }
    const features = Array.from(hits.values())
        .sort((a, b) => a.meters - b.meters)
        .slice(0, maxResults);
    if (hits.size > maxResults)
        exceededLimit = true;
    return { features, exceededLimit, candidates: [] };
}
//# sourceMappingURL=waterPathNearestH3.js.map