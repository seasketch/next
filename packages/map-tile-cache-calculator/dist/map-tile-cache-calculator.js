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
exports.MapTileCacheCalculator = void 0;
exports.isDetailedShorelineSetting = isDetailedShorelineSetting;
const tilebelt_1 = __importStar(require("@mapbox/tilebelt"));
const boolean_intersects_1 = __importDefault(require("@turf/boolean-intersects"));
const vector_data_source_1 = require("@seasketch/vector-data-source");
function isDetailedShorelineSetting(settings) {
    return (settings.maxShorelineZ !==
        undefined &&
        settings.maxShorelineZ !== null);
}
const X = 0;
const Y = 1;
const Z = 2;
class MapTileCacheCalculator {
    constructor(vectorDataSourceUrl) {
        this.landFeatures = new vector_data_source_1.VectorDataSource(vectorDataSourceUrl);
        return this;
    }
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
    async traverseOfflineTiles(settings, visitFn, viewport) {
        // Traverse the world tiles from z 1.
        for (const tile of Z_ONE_TILES) {
            await this.traverseChildrenRecursive(tile, settings, visitFn, viewport);
        }
    }
    async tileInCache(tile, settings) {
        let match = null;
        const qk = (0, tilebelt_1.tileToQuadkey)(tile);
        await this.traverseOfflineTiles(settings, (t, stop) => {
            if (match) {
                stop();
            }
            else {
                const tqk = tilebelt_1.default.tileToQuadkey(t);
                if (tqk === qk) {
                    match = t;
                    stop();
                }
                else if (!new RegExp(`^${tqk}`).test(qk)) {
                    stop();
                }
            }
        });
        return !!match;
    }
    async countChildTiles(settings) {
        let count = 0;
        await this.traverseOfflineTiles(settings, (tile, stop) => {
            count++;
            if (isDetailedShorelineSetting(settings) && count > 50000) {
                throw new Error("Number of tiles exceeds maximum (50 thousand) while considering shoreline");
            }
        });
        return count;
    }
    async traverseChildrenRecursive(tile, settings, visitFn, viewport, parentIntersectsLand, grandparentIntersectsLand) {
        // Hard limit on max zoom levels for tiles in different categories
        if (!parentIntersectsLand && tile[Z] > settings.maxZ) {
            return;
        }
        else if (isDetailedShorelineSetting(settings) &&
            tile[Z] > settings.maxShorelineZ) {
            return;
        }
        const tileGeoJSON = tilebelt_1.default.tileToGeoJSON(tile);
        // If a viewport is set, only visit tiles that overlap the viewport
        if (viewport && !(0, boolean_intersects_1.default)(viewport, tileGeoJSON)) {
            return;
        }
        // If a tile is processed to this point, it will be added to the traversal
        let stop = false;
        await visitFn(tile, () => {
            stop = true;
        });
        if (stop) {
            return;
        }
        // Beyond this point now considers whether to evaluate the tiles's children
        grandparentIntersectsLand = parentIntersectsLand;
        if (isDetailedShorelineSetting(settings) && tile[Z] >= settings.maxZ) {
            const shoreFeatures = await this.landFeatures.fetchOverlapping({
                type: "Feature",
                properties: {},
                geometry: tileGeoJSON,
            });
            if (shoreFeatures.length === 0 && !parentIntersectsLand) {
                parentIntersectsLand = false;
                return;
            }
            else if (shoreFeatures.length === 0) {
                parentIntersectsLand = false;
            }
            else {
                parentIntersectsLand = true;
            }
        }
        // Visit all tiles to a depth of 2, then proceed to only visit tiles if they
        // intersect the project bounds.
        if (tile[Z] > 2 && !(0, boolean_intersects_1.default)(tileGeoJSON, settings.region)) {
            return;
        }
        for (const child of tilebelt_1.default.getChildren(tile)) {
            await this.traverseChildrenRecursive(child, settings, visitFn, viewport, parentIntersectsLand, grandparentIntersectsLand);
        }
        return;
    }
}
exports.MapTileCacheCalculator = MapTileCacheCalculator;
const Z_ONE_TILES = [
    [0, 0, 1],
    [1, 0, 1],
    [0, 1, 1],
    [1, 1, 1],
];
//# sourceMappingURL=map-tile-cache-calculator.js.map