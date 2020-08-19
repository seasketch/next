import { rgba } from "./utils";
import esriSLS from "./esriSLS";
import { generateId } from "./utils";
/** @hidden */
export default (symbol, sourceId, imageList) => {
    const layers = [];
    switch (symbol.style) {
        case "esriSFSSolid":
            layers.push({
                id: generateId(),
                type: "fill",
                source: sourceId,
                paint: {
                    "fill-color": rgba(symbol.color),
                },
            });
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
                },
            });
            break;
        default:
            throw new Error(`Unknown fill style ${symbol.style}`);
    }
    if (symbol.outline) {
        let outline = esriSLS(symbol.outline, sourceId);
        layers.push(...outline);
    }
    return layers;
};
