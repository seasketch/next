import { Map } from "mapbox-gl";
declare const EventEmitter: any;
export declare class QuantizedVectorRequestManager extends EventEmitter {
    map: Map;
    constructor(map: Map);
    private addDebugLayer;
    private removeDebugLayer;
    private addEventListeners;
    private removeEventListeners;
    private displayedTiles;
    _viewPortDetails: {
        tiles: Tile[];
        tolerance: number;
    };
    get viewportDetails(): {
        tiles: Tile[];
        tolerance: number;
    };
    intializeViewportDetails(): void;
    private updateSources;
    private updateDebugLayer;
    private getTilesForBounds;
    private doesTileOverlapBbox;
    private debouncedUpdateSources;
}
export declare function getOrCreateQuantizedVectorRequestManager(map: Map): QuantizedVectorRequestManager | undefined;
type Tile = [number, number, number];
export {};
//# sourceMappingURL=QuantizedVectorRequestManager.d.ts.map