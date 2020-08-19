import esriSLS from "./esriSLS";
import esriSFS from "./esriSFS";
import esriPMS from "./esriPMS";
import esriSMS from "./esriSMS";
import esriPFS from "./esriPFS";
import {
  Symbol,
  SimpleFillSymbol,
  PictureFillSymbol,
  SimpleLineSymbol,
  SimpleMarkerSymbol,
  PictureMarkerSymbol,
} from "arcgis-rest-api";
import { ImageSet, ImageList } from "../ImageList";

/** @hidden */
export function symbolToLayers(
  symbol: Symbol,
  sourceId: string,
  imageList: ImageList,
  serviceBaseUrl: string,
  sublayer: number,
  legendIndex: number
) {
  var layers;
  switch (symbol.type) {
    case "esriSFS":
      layers = esriSFS(symbol as SimpleFillSymbol, sourceId, imageList);
      break;
    case "esriPFS":
      layers = esriPFS(symbol as PictureFillSymbol, sourceId, imageList);
      break;
    case "esriSLS":
      layers = esriSLS(symbol as SimpleLineSymbol, sourceId);
      break;
    case "esriPMS":
      layers = esriPMS(
        symbol as PictureMarkerSymbol,
        sourceId,
        imageList,
        serviceBaseUrl,
        sublayer,
        legendIndex
      );
      break;
    case "esriSMS":
      layers = esriSMS(symbol as SimpleMarkerSymbol, sourceId, imageList);
      break;
    default:
      throw new Error(`Unknown symbol type ${symbol.type}`);
  }
  return layers;
}
