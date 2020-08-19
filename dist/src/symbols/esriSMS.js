import { generateId } from "./utils";
export default (symbol, sourceId, imageList) => {
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
        },
    ];
};
