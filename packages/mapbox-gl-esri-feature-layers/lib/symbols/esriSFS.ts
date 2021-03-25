import { ptToPx, rgba } from "./utils";
import esriSLS from "./esriSLS";
import { SimpleFillSymbol } from "arcgis-rest-api";
import { Layer } from "mapbox-gl";
import { generateId } from "./utils";
import { ImageList } from "../ImageList";

/** @hidden */
export default (
  symbol: SimpleFillSymbol,
  sourceId: string,
  imageList: ImageList
): Layer[] => {
  const layers: Layer[] = [];
  let useFillOutlineColor =
    symbol.outline &&
    ptToPx(symbol.outline.width || 1) === 1 &&
    symbol.outline.style === "esriSLSSolid";
  switch (symbol.style) {
    case "esriSFSSolid":
      if (symbol.color && symbol.color[3] === 0) {
        useFillOutlineColor = false;
      } else {
        layers.push({
          id: generateId(),
          type: "fill",
          source: sourceId,
          paint: {
            "fill-color": rgba(symbol.color!),
            ...(useFillOutlineColor
              ? { "fill-outline-color": rgba(symbol.outline!.color) }
              : {}),
          },
        });
      }
      break;
    case "esriSFSNull":
      // leave empty
      break;
    case "esriSFSBackwardDiagonal":
    case "esriSFSCross":
    case "esriSFSDiagonalCross":
    case "esriSFSForwardDiagonal":
    case "esriSFSHorizontal":
    case "esriSFSVertical":
      const imageId = imageList.addEsriSFS(symbol);
      layers.push({
        id: generateId(),
        source: sourceId,
        type: "fill",
        paint: {
          "fill-pattern": imageId,
          ...(useFillOutlineColor
            ? { "fill-outline-color": rgba(symbol.outline!.color) }
            : {}),
        },
      });
      break;
    default:
      throw new Error(`Unknown fill style ${symbol.style}`);
  }
  if (symbol.outline && !useFillOutlineColor) {
    let outline = esriSLS(symbol.outline, sourceId);
    layers.push(...outline);
  }
  return layers;
};
