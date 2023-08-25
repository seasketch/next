import esriSLS from "./esriSLS";
import { generateId } from "./utils";
// TODO: Add support for lesser-used options
// height
// width
// angle
// xoffset
// yoffset
// xscale
// yscale
/** @hidden */
export default (symbol, sourceId, imageList) => {
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
        },
    ];
    if ("outline" in symbol) {
        let outline = esriSLS(symbol.outline, sourceId);
        layers.push(...outline);
    }
    return layers;
};
