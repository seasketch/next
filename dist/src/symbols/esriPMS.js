import { generateId } from "./utils";
/** @hidden */
export default (symbol, sourceId, imageList, serviceBaseUrl, sublayer, legendIndex) => {
    const imageId = imageList.addEsriPMS(symbol, serviceBaseUrl, sublayer, legendIndex);
    return [
        {
            id: generateId(),
            source: sourceId,
            type: "symbol",
            paint: {},
            layout: {
                "icon-allow-overlap": true,
                "icon-rotate": symbol.angle || 0,
                "icon-offset": [symbol.xoffset || 0, symbol.yoffset || 0],
                "icon-image": imageId,
            },
        },
    ];
};
