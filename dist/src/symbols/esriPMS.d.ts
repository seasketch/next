import { PictureMarkerSymbol } from "arcgis-rest-api";
import { Layer } from "mapbox-gl";
import { ImageList } from "../ImageList";
declare const _default: (symbol: PictureMarkerSymbol, sourceId: string, imageList: ImageList, serviceBaseUrl: string, sublayer: number, legendIndex: number) => Layer[];
export default _default;
