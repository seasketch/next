"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_WATER_PATH_RESULTS = exports.DEFAULT_WATER_PATH_DISTANCE_KM = exports.DEFAULT_WATER_PATH_MAX_RESULTS = exports.MAX_DISTANCE_TO_FEATURES_KM = void 0;
exports.searchWaterPathNearest = searchWaterPathNearest;
const client_1 = require("@seasketch/h3-land/client");
const bitmapSearch_1 = require("./bitmapSearch");
const bboxUtils_1 = require("../utils/bboxUtils");
exports.MAX_DISTANCE_TO_FEATURES_KM = 400;
exports.DEFAULT_WATER_PATH_MAX_RESULTS = 3;
/** Default search radius: 200 statute miles, stored in kilometres. */
exports.DEFAULT_WATER_PATH_DISTANCE_KM = 200 * 1.609344;
exports.MAX_WATER_PATH_RESULTS = 25;
const openings = new Map();
function landArchive(url) {
    const existing = openings.get(url);
    if (existing)
        return existing;
    const pending = (0, client_1.openLandOccupancy)(url, {
        cacheBytes: 64 * 1024 * 1024,
    }).catch((error) => {
        openings.delete(url);
        throw error;
    });
    openings.set(url, pending);
    return pending;
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
function pointPositions(feature) {
    const geometry = feature.geometry;
    if (!geometry)
        return [];
    if (geometry.type === "Point")
        return [geometry.coordinates];
    if (geometry.type === "MultiPoint")
        return geometry.coordinates;
    return [];
}
async function loadPoints(source, minX, minY, maxX, maxY) {
    const parts = (0, bboxUtils_1.splitBBoxAntimeridian)((0, bboxUtils_1.cleanBBox)([minX, minY, maxX, maxY]));
    const found = [];
    const seen = new Set();
    for (const part of parts) {
        const envelope = (0, bboxUtils_1.bboxToEnvelope)(part);
        for await (const feature of source.getFeaturesAsync(envelope)) {
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
function textProp(properties, key) {
    const value = properties[key];
    return typeof value === "string" ? value : "";
}
/**
 * Water-path distance from a sketch to the nearest point features.
 * The ocean bitmap is classified from the H3 land archive. The land
 * polygons are the caller's shoreline source, the same file distance-to-shore
 * uses, and they carry a port out of a harbor the archive has filled in.
 */
async function searchWaterPathNearest(feature, points, land, options) {
    if (!feature.geometry) {
        throw new Error("searchWaterPathNearest: feature.geometry is required");
    }
    const maxResults = Math.min(exports.MAX_WATER_PATH_RESULTS, Math.max(1, options?.maxResults ?? exports.DEFAULT_WATER_PATH_MAX_RESULTS));
    const requestedKm = options?.maxDistanceKm ?? exports.DEFAULT_WATER_PATH_DISTANCE_KM;
    const maxMeters = Math.min(requestedKm, exports.MAX_DISTANCE_TO_FEATURES_KM) * 1000;
    const resolution = options?.resolution ?? "high";
    const degrees = bitmapSearch_1.WATER_PATH_RESOLUTION_DEGREES[resolution];
    const origin = (0, bitmapSearch_1.centroid)(feature);
    const rings = (0, bitmapSearch_1.geometryRings)(feature);
    const latPad = maxMeters / 111320;
    const lngPad = latPad / Math.max(0.2, Math.cos((origin[1] * Math.PI) / 180));
    const pointFeatures = await loadPoints(points, origin[0] - lngPad, origin[1] - latPad, origin[0] + lngPad, origin[1] + latPad);
    const ports = [];
    for (const pointFeature of pointFeatures) {
        const properties = publicProperties(pointFeature.properties, options?.includedColumns);
        for (const position of pointPositions(pointFeature)) {
            ports.push({
                name: textProp(properties, "PORT_NAME") || textProp(properties, "name"),
                country: textProp(properties, "COUNTRY"),
                lng: position[0],
                lat: position[1],
                id: featureId(pointFeature, position),
                properties,
            });
        }
    }
    const archiveUrl = options?.archiveUrl ??
        process.env.H3_LAND_URL ??
        (0, bitmapSearch_1.archiveFor)((0, bitmapSearch_1.sampleResolution)(degrees));
    const occupancy = await landArchive(archiveUrl);
    const goalPool = Math.min(24, maxResults * 6);
    const deadline = options?.deadline;
    const result = await (0, bitmapSearch_1.searchBitmap)(occupancy, origin, ports, {
        degrees,
        margin: 1,
        maxMeters,
        maxExpansions: 250000,
        maxGoals: goalPool,
        maxResults,
        rings,
        landPolygons: (0, bitmapSearch_1.landPolygonsFromSource)(land),
        trace: options?.trace ?? false,
        cancelled: () => deadline != null && Date.now() > deadline,
        onProgress: options?.onProgress,
    });
    const features = result.routes.map((route) => ({
        __id: route.port.id ?? featureId({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [route.port.lng, route.port.lat] } }, [route.port.lng, route.port.lat]),
        meters: route.pathMeters,
        properties: route.port.properties ?? {
            ...(route.port.name ? { PORT_NAME: route.port.name } : {}),
            ...(route.port.country ? { COUNTRY: route.port.country } : {}),
        },
        geojsonLine: {
            type: "Feature",
            properties: {},
            geometry: {
                type: "LineString",
                coordinates: route.smoothed,
            },
        },
    }));
    const routed = new Map(features.map((hit) => [hit.__id, hit.meters]));
    const candidates = result.goals.map((goal) => ({
        __id: 0,
        position: [goal.lng, goal.lat],
        properties: goal.name ? { PORT_NAME: goal.name } : {},
        geodesicMeters: 0,
        meters: undefined,
    }));
    for (const route of result.routes) {
        const candidate = candidates.find((item) => item.properties.PORT_NAME === route.port.name && item.position[0] === route.port.lng);
        if (!candidate)
            continue;
        candidate.__id = route.port.id ?? 0;
        candidate.meters = route.pathMeters;
        candidate.properties = route.port.properties ?? candidate.properties;
    }
    return {
        features,
        exceededLimit: ports.length > features.length || result.stop === "expansions",
        candidates: candidates.map((candidate) => ({
            ...candidate,
            meters: routed.get(candidate.__id) ?? candidate.meters,
        })),
    };
}
//# sourceMappingURL=waterPathNearest.js.map