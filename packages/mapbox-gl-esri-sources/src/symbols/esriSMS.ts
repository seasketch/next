import { SimpleMarkerSymbol } from "arcgis-rest-api";
import { ImageList } from "../ImageList";
import { Layer } from "mapbox-gl";
import { generateId, rgba } from "./utils";

/** @hidden */
export default (
  symbol: SimpleMarkerSymbol,
  sourceId: string,
  imageList: ImageList
) => {
  if (symbol.style === "esriSMSCircle") {
    // If it's a circle symbol, just make a gl style circle layer
    return [
      {
        id: generateId(),
        type: "circle",
        source: sourceId,
        paint: {
          "circle-color": rgba(symbol.color),
          "circle-radius": symbol.size,
          "circle-stroke-color": rgba(symbol.outline?.color || symbol.color),
          "circle-stroke-width": symbol.outline?.width || 0,
        },
        layout: {},
      } as Layer,
    ];
  } else {
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
  }
};
