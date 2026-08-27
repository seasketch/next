"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.samplePositionsFromGeometry = samplePositionsFromGeometry;
exports.densifiedPositionsFromGeometry = densifiedPositionsFromGeometry;
exports.cellsCoveringGeometry = cellsCoveringGeometry;
const distance_1 = __importDefault(require("@turf/distance"));
const h3_js_1 = require("h3-js");
/**
 * Sample vertex (and interpolated) positions from a geometry.
 */
function samplePositionsFromGeometry(geometry) {
    switch (geometry.type) {
        case "Point":
            return [geometry.coordinates];
        case "MultiPoint":
            return geometry.coordinates;
        case "LineString":
            return geometry.coordinates;
        case "MultiLineString":
            return geometry.coordinates.flat();
        case "Polygon":
            return geometry.coordinates.flat();
        case "MultiPolygon":
            return geometry.coordinates.flat(2);
        default:
            throw new Error(`Unsupported geometry type: ${geometry.type}`);
    }
}
/**
 * Vertices plus interpolated points along edges, used as origin samples
 * for H3 lower bounds. Spacing should be no larger than half a fine hex
 * edge so the bound stays admissible on long line/polygon sides.
 */
function densifiedPositionsFromGeometry(geometry, spacingMeters) {
    const spacing = Math.max(spacingMeters, 1);
    switch (geometry.type) {
        case "Point":
            return [geometry.coordinates];
        case "MultiPoint":
            return geometry.coordinates;
        case "LineString":
            return densifyRing(geometry.coordinates, spacing);
        case "MultiLineString":
            return geometry.coordinates.flatMap((line) => densifyRing(line, spacing));
        case "Polygon":
            return geometry.coordinates.flatMap((ring) => densifyRing(ring, spacing));
        case "MultiPolygon":
            return geometry.coordinates.flatMap((poly) => poly.flatMap((ring) => densifyRing(ring, spacing)));
        default:
            throw new Error(`Unsupported geometry type: ${geometry.type}`);
    }
}
function lerpLngLat(a, b, t) {
    let aLng = a[0];
    let bLng = b[0];
    let dLng = bLng - aLng;
    if (dLng > 180)
        bLng -= 360;
    if (dLng < -180)
        bLng += 360;
    const lng = aLng + (bLng - aLng) * t;
    const lat = a[1] + (b[1] - a[1]) * t;
    const wrap = ((((lng + 180) % 360) + 360) % 360) - 180;
    return [wrap, lat];
}
function densifyRing(ring, spacingMeters) {
    if (ring.length === 0)
        return [];
    const out = [ring[0]];
    for (let i = 0; i < ring.length - 1; i++) {
        const a = ring[i];
        const b = ring[i + 1];
        const meters = (0, distance_1.default)(a, b, { units: "meters" });
        const steps = Math.max(1, Math.ceil(meters / spacingMeters));
        for (let s = 1; s <= steps; s++) {
            out.push(lerpLngLat(a, b, s / steps));
        }
    }
    return out;
}
/**
 * H3 cells that cover the origin geometry at `resolution`.
 *
 * Vertices are always included. Lines are densified at half the hex edge
 * length so long segments cannot skip cells. Polygons also use
 * `polygonToCells`.
 */
function cellsCoveringGeometry(geometry, resolution) {
    const cells = new Set();
    const addPoint = (lng, lat) => {
        cells.add((0, h3_js_1.latLngToCell)(lat, lng, resolution));
    };
    const edgeMeters = (0, h3_js_1.getHexagonEdgeLengthAvg)(resolution, "m");
    const spacing = Math.max(edgeMeters / 2, 1);
    switch (geometry.type) {
        case "Point": {
            const [lng, lat] = geometry.coordinates;
            addPoint(lng, lat);
            break;
        }
        case "MultiPoint": {
            for (const [lng, lat] of geometry.coordinates) {
                addPoint(lng, lat);
            }
            break;
        }
        case "LineString": {
            for (const [lng, lat] of densifyRing(geometry.coordinates, spacing)) {
                addPoint(lng, lat);
            }
            break;
        }
        case "MultiLineString": {
            for (const line of geometry.coordinates) {
                for (const [lng, lat] of densifyRing(line, spacing)) {
                    addPoint(lng, lat);
                }
            }
            break;
        }
        case "Polygon": {
            const coords = geometry.coordinates;
            for (const ring of coords) {
                for (const [lng, lat] of densifyRing(ring, spacing)) {
                    addPoint(lng, lat);
                }
            }
            try {
                for (const cell of (0, h3_js_1.polygonToCells)(coords, resolution, true)) {
                    cells.add(cell);
                }
            }
            catch {
                // Degenerate / too-small polygons: vertex coverage is enough.
            }
            break;
        }
        case "MultiPolygon": {
            for (const poly of geometry.coordinates) {
                for (const ring of poly) {
                    for (const [lng, lat] of densifyRing(ring, spacing)) {
                        addPoint(lng, lat);
                    }
                }
                try {
                    for (const cell of (0, h3_js_1.polygonToCells)(poly, resolution, true)) {
                        cells.add(cell);
                    }
                }
                catch {
                    // ignore
                }
            }
            break;
        }
        default:
            throw new Error(`Unsupported geometry type for H3 coverage: ${geometry.type}`);
    }
    return Array.from(cells);
}
//# sourceMappingURL=coverGeometry.js.map