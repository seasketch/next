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
exports.computeBufferedSubjectAndCollar = computeBufferedSubjectAndCollar;
const buffer_1 = __importDefault(require("@turf/buffer"));
const bbox_1 = __importDefault(require("@turf/bbox"));
const clipping = __importStar(require("polyclip-ts"));
/**
 * Computes the buffered subject and its boundary **collar** used for
 * buffered fragment `overlay_area` overlap detection.
 *
 * Collar = `buffer(subject, d) − erode(subject, d)`. When erode yields an
 * empty geometry (fragment thinner than 2d), the collar is the whole buffer.
 *
 * Called only when `bufferDistanceKm > 0` on a fragment subject. Unbuffered
 * `overlay_area` never invokes this helper.
 *
 * @see OverlayAreaOverlapInfo in `./metrics` for how collar metadata is used.
 */
function computeBufferedSubjectAndCollar(subject, bufferKm) {
    const bufferedRaw = (0, buffer_1.default)(subject, bufferKm, { units: "kilometers" });
    if (!bufferedRaw?.geometry ||
        (bufferedRaw.geometry.type !== "Polygon" &&
            bufferedRaw.geometry.type !== "MultiPolygon")) {
        throw new Error("Failed to buffer subject for overlay_area collar");
    }
    const buffered = bufferedRaw;
    let eroded = null;
    try {
        const erodedRaw = (0, buffer_1.default)(subject, -bufferKm, { units: "kilometers" });
        if (erodedRaw?.geometry &&
            (erodedRaw.geometry.type === "Polygon" ||
                erodedRaw.geometry.type === "MultiPolygon")) {
            eroded = erodedRaw;
        }
    }
    catch {
        eroded = null;
    }
    let collar;
    if (!eroded) {
        collar = buffered;
    }
    else {
        const diff = clipping.difference(buffered.geometry.coordinates, eroded.geometry.coordinates);
        if (!diff || (Array.isArray(diff) && diff.length === 0)) {
            collar = buffered;
        }
        else {
            collar = {
                type: "Feature",
                properties: {},
                geometry: {
                    type: "MultiPolygon",
                    coordinates: diff,
                },
            };
        }
    }
    const box = (0, bbox_1.default)(buffered);
    return { buffered, collar, bbox: box };
}
//# sourceMappingURL=computeSubjectCollar.js.map