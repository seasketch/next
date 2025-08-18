"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.coverWithRectangles = coverWithRectangles;
exports.buildIndexes = buildIndexes;
exports.classifyCandidate = classifyCandidate;
const pc = __importStar(require("polygon-clipping"));
const rbush_1 = __importDefault(require("rbush"));
// Helper function to extract 2D coordinates from Position
function to2D(pos) {
    return [pos[0], pos[1]];
}
// GeoJSON MultiPolygon/Polygon -> ring arrays in polygon-clipping format
function toPC(geojson) {
    if (geojson.type === "Polygon") {
        return [geojson.coordinates.map((ring) => ring.map(to2D))];
    }
    if (geojson.type === "MultiPolygon") {
        return geojson.coordinates.map((poly) => poly.map((ring) => ring.map(to2D)));
    }
    throw new Error("Polygon or MultiPolygon only");
}
function rectToPoly(rect) {
    const [minX, minY, maxX, maxY] = rect;
    return [
        [
            [minX, minY],
            [maxX, minY],
            [maxX, maxY],
            [minX, maxY],
            [minX, minY],
        ],
    ];
}
function rectArea(rect) {
    const [minX, minY, maxX, maxY] = rect;
    return (maxX - minX) * (maxY - minY);
}
// Classify a rectangle against the polygon using polygon-clipping
function classifyRect(rect, poly, eps = 1e-12) {
    const I = pc.intersection(poly, [rectToPoly(rect)]);
    if (!I || I.length === 0)
        return "outside";
    // pc returns a MultiPolygon; compute union area of I in degree^2:
    let areaI = 0;
    for (const mp of I)
        for (const ringSet of mp) {
            // outer ring only; holes rare for axis-aligned rect ∩ simple poly
            const ring = ringSet[0];
            for (let i = 0, a = 0; i < ring.length - 1; i++) {
                // @ts-ignore
                const point1 = ring[i];
                // @ts-ignore
                const point2 = ring[i + 1];
                const x1 = point1[0];
                const y1 = point1[1];
                const x2 = point2[0];
                const y2 = point2[1];
                areaI += x1 * y2 - x2 * y1;
            }
        }
    areaI = Math.abs(areaI) / 2; // shoelace in "degree^2"
    const aR = rectArea(rect);
    if (Math.abs(areaI - aR) <= eps * Math.max(1, aR))
        return "inside";
    return "mixed";
}
// Split a rect at midpoint along 'x' or 'y'
function splitRect(rect, axis = "x") {
    const [minX, minY, maxX, maxY] = rect;
    if (axis === "x") {
        const midX = (minX + maxX) / 2;
        return [
            [minX, minY, midX, maxY],
            [midX, minY, maxX, maxY],
        ];
    }
    else {
        const midY = (minY + maxY) / 2;
        return [
            [minX, minY, maxX, midY],
            [minX, midY, maxX, maxY],
        ];
    }
}
// Helper function to convert BBox to Rect (2D only)
function bboxToRect(bbox) {
    var _a, _b, _c, _d;
    // BBox is [minX, minY, minZ?, maxX, maxY, maxZ?] - we only use 2D
    // Ensure we have valid numbers
    const minX = (_a = bbox[0]) !== null && _a !== void 0 ? _a : 0;
    const minY = (_b = bbox[1]) !== null && _b !== void 0 ? _b : 0;
    const maxX = (_c = bbox[3]) !== null && _c !== void 0 ? _c : 0;
    const maxY = (_d = bbox[4]) !== null && _d !== void 0 ? _d : 0;
    return [minX, minY, maxX, maxY];
}
// Build cover
function coverWithRectangles(geojson, { target = 100, minWidth = 1e-4, // degrees
minHeight = 1e-4, bbox = null, } = {}) {
    const poly = toPC(geojson);
    // start from overall bbox (or given)
    const B = bbox
        ? bboxToRect(bbox)
        : geojson.bbox
            ? bboxToRect(geojson.bbox)
            : (() => {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                for (const c of geojson.type === "Polygon"
                    ? [geojson.coordinates]
                    : geojson.coordinates)
                    for (const ring of c)
                        for (const pos of ring) {
                            const [x, y] = to2D(pos);
                            if (x < minX)
                                minX = x;
                            if (y < minY)
                                minY = y;
                            if (x > maxX)
                                maxX = x;
                            if (y > maxY)
                                maxY = y;
                        }
                return [minX, minY, maxX, maxY];
            })();
    const inside = [], outside = [], queue = [];
    // Seed
    queue.push(B);
    while (queue.length && inside.length < target) {
        console.log("queue", queue.length, inside.length, outside.length);
        // Pick the largest rect left to work on (simple heuristic)
        queue.sort((a, b) => rectArea(b) - rectArea(a));
        const R = queue.shift();
        const [minX, minY, maxX, maxY] = R;
        if (maxX - minX < minWidth || maxY - minY < minHeight)
            continue;
        const cls = classifyRect(R, poly);
        if (cls === "inside") {
            inside.push(R);
            continue;
        }
        if (cls === "outside") {
            outside.push(R);
            continue;
        }
        // Try both split directions; pick the one that seems to yield more "inside"
        const [r1x, r2x] = splitRect(R, "x");
        const [r1y, r2y] = splitRect(R, "y");
        const gainX = scoreSplit(r1x, r2x, poly);
        const gainY = scoreSplit(r1y, r2y, poly);
        const chosen = gainX >= gainY ? [r1x, r2x] : [r1y, r2y];
        queue.push(chosen[0], chosen[1]);
    }
    return { inside, outside };
}
function scoreSplit(a, b, poly) {
    // Quick optimistic score: count how many children are fully inside,
    // breaking ties by preferring larger intersection areas.
    const ca = classifyRect(a, poly);
    const cb = classifyRect(b, poly);
    let s = 0;
    if (ca === "inside")
        s += rectArea(a);
    if (cb === "inside")
        s += rectArea(b);
    return s;
}
// Build R-trees for later queries
function buildIndexes(inside, outside) {
    const mkItem = (r) => ({
        minX: r[0],
        minY: r[1],
        maxX: r[2],
        maxY: r[3],
        r,
    });
    const inTree = new rbush_1.default().load(inside.map(mkItem));
    const outTree = new rbush_1.default().load(outside.map(mkItem));
    return { inTree, outTree };
}
// Classify a candidate polygon by its bbox using the precomputed rectangles
function classifyCandidate(candidateGeoJSON, indexes) {
    const [minX, minY, maxX, maxY] = candidateGeoJSON.bbox
        ? bboxToRect(candidateGeoJSON.bbox)
        : (() => {
            let miX = Infinity, miY = Infinity, maX = -Infinity, maY = -Infinity;
            // Handle both Polygon and MultiPolygon coordinates
            const coords = candidateGeoJSON.type === "Polygon"
                ? [candidateGeoJSON.coordinates]
                : candidateGeoJSON.coordinates;
            for (const poly of coords) {
                for (const ring of poly) {
                    for (const pos of ring) {
                        const [x, y] = to2D(pos);
                        miX = Math.min(miX, x);
                        miY = Math.min(miY, y);
                        maX = Math.max(maX, x);
                        maY = Math.max(maY, y);
                    }
                }
            }
            return [miX, miY, maX, maY];
        })();
    // "Definitely inside" if candidate bbox is contained in any inside rect
    const hits = indexes.inTree.search({ minX, minY, maxX, maxY });
    for (const h of hits) {
        if (minX >= h.minX && maxX <= h.maxX && minY >= h.minY && maxY <= h.maxY)
            return "inside_fast";
    }
    // "Definitely outside" if bbox is contained in any outside rect
    const outs = indexes.outTree.search({ minX, minY, maxX, maxY });
    for (const h of outs) {
        if (minX >= h.minX && maxX <= h.maxX && minY >= h.minY && maxY <= h.maxY)
            return "outside_fast";
    }
    return "uncertain"; // fall back to exact polygon clip check only for these
}
//# sourceMappingURL=coverWithRectangles.js.map