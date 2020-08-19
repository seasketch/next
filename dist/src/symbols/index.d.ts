/// <reference types="mapbox-gl" />
import { Symbol } from "arcgis-rest-api";
import { ImageList } from "../ImageList";
export declare function symbolToLayers(symbol: Symbol, sourceId: string, imageList: ImageList, serviceBaseUrl: string, sublayer: number, legendIndex: number): import("mapbox-gl").Layer[];
