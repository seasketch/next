import { PictureMarkerSymbol } from "arcgis-rest-api";
import { Layer } from "mapbox-gl";
import { generateId } from "./utils";
import { ImageSet, ImageList } from "../ImageList";

/** @hidden */
export default (
  symbol: PictureMarkerSymbol,
  sourceId: string,
  imageList: ImageList,
  serviceBaseUrl: string,
  sublayer: number,
  legendIndex: number
) => {
  const imageId = imageList.addEsriPMS(
    symbol,
    serviceBaseUrl,
    sublayer,
    legendIndex
  );
  return [
    {
      id: generateId(),
      source: sourceId,
      type: "symbol",
      paint: {},
      layout: {
        "icon-allow-overlap": true,
        "icon-rotate": symbol.angle,
        "icon-offset": [symbol.xoffset || 0, symbol.yoffset || 0],
        "icon-image": imageId,
      },
    } as Layer,
  ];
};
