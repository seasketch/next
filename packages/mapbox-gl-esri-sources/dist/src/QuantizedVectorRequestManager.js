"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuantizedVectorRequestManager = void 0;
exports.getOrCreateQuantizedVectorRequestManager = getOrCreateQuantizedVectorRequestManager;
const EventEmitter = require("eventemitter3");
const tilebelt = require("@mapbox/tilebelt");
const debounce = require("lodash.debounce");
const DEBUG = false;
class QuantizedVectorRequestManager extends EventEmitter {
    constructor(map) {
        super();
        this.removeEventListeners = (map) => {
            map.off("moveend", this.updateSources);
            map.off("move", this.debouncedUpdateSources);
            map.off("remove", this.removeEventListeners);
            try {
                this.removeDebugLayer();
            }
            catch (e) {
                // do nothing
            }
        };
        this.displayedTiles = "";
        this._viewPortDetails = {
            tiles: [],
            tolerance: 0,
        };
        this.updateSources = () => {
            const bounds = this.map.getBounds();
            const boundsArray = bounds.toArray();
            const tiles = this.getTilesForBounds(bounds);
            const key = tiles
                .map((t) => tilebelt.tileToQuadkey(t))
                .sort()
                .join(",");
            if (key !== this.displayedTiles) {
                this.displayedTiles = key;
                const mapWidth = Math.abs(boundsArray[1][0] - boundsArray[0][0]);
                const tolerance = (mapWidth / this.map.getCanvas().width) * 0.4;
                this._viewPortDetails = {
                    tiles,
                    tolerance,
                };
                this.emit("update", { tiles });
            }
            if (DEBUG) {
                this.updateDebugLayer(tiles);
            }
        };
        this.debouncedUpdateSources = debounce(this.updateSources, 100, {
            maxWait: 200,
        });
        this.map = map;
        this.addEventListeners(map);
        if (DEBUG) {
            this.addDebugLayer();
        }
    }
    addDebugLayer() {
        this.map.addSource("debug-quantized-vector-request-manager", {
            type: "geojson",
            data: {
                type: "FeatureCollection",
                features: [],
            },
        });
        this.map.addLayer({
            id: "debug-quantized-vector-request-manager",
            type: "line",
            source: "debug-quantized-vector-request-manager",
            paint: {
                "line-color": "red",
                "line-width": 2,
            },
        });
    }
    removeDebugLayer() {
        this.map.removeLayer("debug-quantized-vector-request-manager");
        this.map.removeSource("debug-quantized-vector-request-manager");
    }
    addEventListeners(map) {
        map.on("moveend", this.updateSources);
        map.on("move", this.debouncedUpdateSources);
        map.on("remove", this.removeEventListeners);
    }
    get viewportDetails() {
        if (!this._viewPortDetails.tiles.length) {
            this.intializeViewportDetails();
        }
        return this._viewPortDetails;
    }
    intializeViewportDetails() {
        if (!this._viewPortDetails.tiles.length) {
            const bounds = this.map.getBounds();
            const boundsArray = bounds.toArray();
            const tiles = this.getTilesForBounds(bounds);
            const key = tiles
                .map((t) => tilebelt.tileToQuadkey(t))
                .sort()
                .join(",");
            this.displayedTiles = key;
            const mapWidth = Math.abs(boundsArray[1][0] - boundsArray[0][0]);
            const tolerance = (mapWidth / this.map.getCanvas().width) * 0.4;
            this._viewPortDetails = {
                tiles,
                tolerance,
            };
        }
    }
    updateDebugLayer(tiles) {
        const source = this.map.getSource("debug-quantized-vector-request-manager");
        const fc = {
            type: "FeatureCollection",
            features: tiles.map((t) => ({
                type: "Feature",
                properties: { label: `${t[2]}/${t[0]}/${1}` },
                geometry: tilebelt.tileToGeoJSON(t),
            })),
        };
        source.setData(fc);
    }
    getTilesForBounds(bounds) {
        const z = this.map.getZoom();
        const boundsArray = bounds.toArray();
        const primaryTile = tilebelt.bboxToTile([
            boundsArray[0][0],
            boundsArray[0][1],
            boundsArray[1][0],
            boundsArray[1][1],
        ]);
        const zoomLevel = 2 * Math.floor(z / 2);
        const tilesToRequest = [];
        if (primaryTile[2] < zoomLevel) {
            let candidateTiles = tilebelt.getChildren(primaryTile);
            let minZoomOfCandidates = candidateTiles[0][2];
            while (minZoomOfCandidates < zoomLevel) {
                const newCandidateTiles = [];
                candidateTiles.forEach((t) => newCandidateTiles.push(...tilebelt.getChildren(t)));
                candidateTiles = newCandidateTiles;
                minZoomOfCandidates = candidateTiles[0][2];
            }
            for (let index = 0; index < candidateTiles.length; index++) {
                if (this.doesTileOverlapBbox(candidateTiles[index], boundsArray)) {
                    tilesToRequest.push(candidateTiles[index]);
                }
            }
        }
        else {
            tilesToRequest.push(primaryTile);
        }
        return tilesToRequest;
    }
    doesTileOverlapBbox(tile, bbox) {
        const tileBounds = tile.length === 4 ? tile : tilebelt.tileToBBOX(tile);
        if (tileBounds[2] < bbox[0][0])
            return false;
        if (tileBounds[0] > bbox[1][0])
            return false;
        if (tileBounds[3] < bbox[0][1])
            return false;
        if (tileBounds[1] > bbox[1][1])
            return false;
        return true;
    }
}
exports.QuantizedVectorRequestManager = QuantizedVectorRequestManager;
const managers = new WeakMap();
function getOrCreateQuantizedVectorRequestManager(map) {
    if (!managers.has(map)) {
        managers.set(map, new QuantizedVectorRequestManager(map));
    }
    return managers.get(map);
}
//# sourceMappingURL=QuantizedVectorRequestManager.js.map