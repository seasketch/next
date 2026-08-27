"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.nearestPointsBetweenGeometryAndPolygon = nearestPointsBetweenGeometryAndPolygon;
const nearest_point_on_line_1 = __importDefault(require("@turf/nearest-point-on-line"));
const distance_1 = __importDefault(require("@turf/distance"));
const coverGeometry_1 = require("./coverGeometry");
function normalizePositionLongitude(pos, referenceLng) {
    const [lng, lat] = pos;
    if (!Number.isFinite(referenceLng)) {
        return pos;
    }
    let adj = lng;
    while (adj - referenceLng > 180)
        adj -= 360;
    while (adj - referenceLng < -180)
        adj += 360;
    return [adj, lat];
}
function normalizeGeometryLongitudes(geometry, referenceLng) {
    switch (geometry.type) {
        case "Point":
            return {
                type: "Point",
                coordinates: normalizePositionLongitude(geometry.coordinates, referenceLng),
            };
        case "MultiPoint":
            return {
                type: "MultiPoint",
                coordinates: geometry.coordinates.map((p) => normalizePositionLongitude(p, referenceLng)),
            };
        case "LineString":
            return {
                type: "LineString",
                coordinates: geometry.coordinates.map((p) => normalizePositionLongitude(p, referenceLng)),
            };
        case "MultiLineString":
            return {
                type: "MultiLineString",
                coordinates: geometry.coordinates.map((line) => line.map((p) => normalizePositionLongitude(p, referenceLng))),
            };
        case "Polygon":
            return {
                type: "Polygon",
                coordinates: geometry.coordinates.map((ring) => ring.map((p) => normalizePositionLongitude(p, referenceLng))),
            };
        case "MultiPolygon":
            return {
                type: "MultiPolygon",
                coordinates: geometry.coordinates.map((poly) => poly.map((ring) => ring.map((p) => normalizePositionLongitude(p, referenceLng)))),
            };
        default:
            return geometry;
    }
}
function addRingSegments(ring, target) {
    for (let i = 0; i < ring.length - 1; i++) {
        target.push({ a: ring[i], b: ring[i + 1] });
    }
}
function segmentsFromGeometryEdges(geometry) {
    const segments = [];
    switch (geometry.type) {
        case "LineString":
            addRingSegments(geometry.coordinates, segments);
            break;
        case "MultiLineString":
            for (const line of geometry.coordinates) {
                addRingSegments(line, segments);
            }
            break;
        case "Polygon":
            for (const ring of geometry.coordinates) {
                addRingSegments(ring, segments);
            }
            break;
        case "MultiPolygon":
            for (const poly of geometry.coordinates) {
                for (const ring of poly) {
                    addRingSegments(ring, segments);
                }
            }
            break;
        default:
            break;
    }
    return segments;
}
function closestPointsOnSegments(segA, segB) {
    const [x1, y1] = segA.a;
    const [x2, y2] = segA.b;
    const [x3, y3] = segB.a;
    const [x4, y4] = segB.b;
    const ux = x2 - x1;
    const uy = y2 - y1;
    const vx = x4 - x3;
    const vy = y4 - y3;
    const wx = x1 - x3;
    const wy = y1 - y3;
    const a = ux * ux + uy * uy;
    const b = ux * vx + uy * vy;
    const c = vx * vx + vy * vy;
    const d = ux * wx + uy * wy;
    const e = vx * wx + vy * wy;
    const D = a * c - b * b;
    const EPS = 1e-12;
    let sN;
    let sD = D;
    let tN;
    let tD = D;
    if (D < EPS) {
        sN = 0.0;
        sD = 1.0;
        tN = e;
        tD = c;
    }
    else {
        sN = b * e - c * d;
        tN = a * e - b * d;
        if (sN < 0.0) {
            sN = 0.0;
            tN = e;
            tD = c;
        }
        else if (sN > sD) {
            sN = sD;
            tN = e + b;
            tD = c;
        }
    }
    if (tN < 0.0) {
        tN = 0.0;
        if (-d < 0.0) {
            sN = 0.0;
        }
        else if (-d > a) {
            sN = sD;
        }
        else {
            sN = -d;
            sD = a;
        }
    }
    else if (tN > tD) {
        tN = tD;
        if (-d + b < 0.0) {
            sN = 0;
        }
        else if (-d + b > a) {
            sN = sD;
        }
        else {
            sN = -d + b;
            sD = a;
        }
    }
    const sc = Math.abs(sN) < EPS ? 0.0 : sN / sD;
    const tc = Math.abs(tN) < EPS ? 0.0 : tN / tD;
    const cx = wx + sc * ux - tc * vx;
    const cy = wy + sc * uy - tc * vy;
    const origin = [x1 + sc * ux, y1 + sc * uy];
    const shoreline = [x3 + tc * vx, y3 + tc * vy];
    return { origin, shoreline, dist2: cx * cx + cy * cy };
}
/**
 * Closest points between the subject geometry and a land polygon, in meters.
 */
function nearestPointsBetweenGeometryAndPolygon(subjectGeom, landFeature) {
    const landGeom = landFeature.geometry;
    if (!landGeom) {
        return { meters: Infinity, origin: null, shoreline: null };
    }
    if (subjectGeom.type === "Point" || subjectGeom.type === "MultiPoint") {
        const samples = (0, coverGeometry_1.samplePositionsFromGeometry)(subjectGeom);
        const rings = [];
        if (landGeom.type === "Polygon") {
            for (const ring of landGeom.coordinates) {
                if (ring.length >= 2)
                    rings.push(ring);
            }
        }
        else if (landGeom.type === "MultiPolygon") {
            for (const poly of landGeom.coordinates) {
                for (const ring of poly) {
                    if (ring.length >= 2)
                        rings.push(ring);
                }
            }
        }
        let bestMeters = Infinity;
        let bestOrigin = null;
        let bestShoreline = null;
        for (const [lng, lat] of samples) {
            const originPoint = {
                type: "Feature",
                geometry: { type: "Point", coordinates: [lng, lat] },
                properties: {},
            };
            for (const ring of rings) {
                if (ring.length < 2)
                    continue;
                const line = {
                    type: "Feature",
                    geometry: { type: "LineString", coordinates: ring },
                    properties: {},
                };
                const snapped = (0, nearest_point_on_line_1.default)(line, originPoint, {
                    units: "meters",
                });
                const meters = snapped.properties && typeof snapped.properties.dist === "number"
                    ? snapped.properties.dist
                    : Infinity;
                if (meters < bestMeters) {
                    bestMeters = meters;
                    bestOrigin = originPoint.geometry.coordinates;
                    bestShoreline = snapped.geometry.coordinates;
                    if (bestMeters === 0)
                        break;
                }
            }
            if (bestMeters === 0)
                break;
        }
        return {
            meters: bestMeters,
            origin: bestOrigin,
            shoreline: bestShoreline,
        };
    }
    const subjectSamples = (0, coverGeometry_1.samplePositionsFromGeometry)(subjectGeom);
    const referenceLng = subjectSamples.length > 0 ? subjectSamples[0][0] : 0;
    const normalizedSubject = normalizeGeometryLongitudes(subjectGeom, referenceLng);
    const normalizedLand = normalizeGeometryLongitudes(landGeom, referenceLng);
    const subjectSegments = segmentsFromGeometryEdges(normalizedSubject);
    const shorelineSegments = segmentsFromGeometryEdges(normalizedLand);
    if (subjectSegments.length === 0 || shorelineSegments.length === 0) {
        return { meters: Infinity, origin: null, shoreline: null };
    }
    let bestDist2 = Infinity;
    let bestOrigin = null;
    let bestShoreline = null;
    for (const segA of subjectSegments) {
        for (const segB of shorelineSegments) {
            const { origin, shoreline, dist2 } = closestPointsOnSegments(segA, segB);
            if (dist2 < bestDist2) {
                bestDist2 = dist2;
                bestOrigin = origin;
                bestShoreline = shoreline;
            }
        }
    }
    if (bestOrigin && bestShoreline) {
        const wrapLng = (lng) => ((((lng + 180) % 360) + 360) % 360) - 180;
        const denormalizedOrigin = [
            wrapLng(bestOrigin[0]),
            bestOrigin[1],
        ];
        const denormalizedShoreline = [
            wrapLng(bestShoreline[0]),
            bestShoreline[1],
        ];
        const meters = (0, distance_1.default)(denormalizedOrigin, denormalizedShoreline, { units: "meters" });
        return {
            meters,
            origin: denormalizedOrigin,
            shoreline: denormalizedShoreline,
        };
    }
    return { meters: Infinity, origin: null, shoreline: null };
}
//# sourceMappingURL=nearestShorelinePath.js.map