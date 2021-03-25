import esriSLS from "./esriSLS";
import { PictureFillSymbol, SimpleLineSymbol } from "arcgis-rest-api";
import { Layer } from "mapbox-gl";
import { generateId } from "./utils";
import { ImageList } from "../ImageList";

// TODO: Add support for lesser-used options
// height
// width
// angle
// xoffset
// yoffset
// xscale
// yscale
/** @hidden */
export default (
  symbol: PictureFillSymbol,
  sourceId: string,
  imageList: ImageList
) => {
  const imageId = imageList.addEsriPFS(symbol);
  const layers = [
    {
      id: generateId(),
      source: sourceId,
      type: "fill",
      paint: {
        "fill-pattern": imageId,
      },
      layout: {},
    } as Layer,
  ];
  if ("outline" in symbol) {
    let outline = esriSLS(symbol.outline as SimpleLineSymbol, sourceId);
    layers.push(...outline);
  }
  return layers;
};
