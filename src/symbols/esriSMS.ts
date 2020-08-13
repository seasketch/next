import { SimpleMarkerSymbol } from "arcgis-rest-api";
import { ImageList } from "../ImageList";
import { Layer } from "mapbox-gl";
import { generateId } from "./utils";

export default (
  symbol: SimpleMarkerSymbol,
  sourceId: string,
  imageList: ImageList
) => {
  const imageId = imageList.addEsriSMS(symbol);
  return [
    {
      id: generateId(),
      type: "symbol",
      source: sourceId,
      paint: {},
      layout: {
        "icon-allow-overlap": true,
        "icon-rotate": symbol.angle,
        "icon-offset": [symbol.xoffset || 0, symbol.yoffset || 0],
        "icon-image": imageId,
        "icon-size": 1,
      },
    } as Layer,
  ];
};
