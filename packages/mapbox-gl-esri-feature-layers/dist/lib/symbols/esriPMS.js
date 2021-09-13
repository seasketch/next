"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils");
/** @hidden */
exports.default = (symbol, sourceId, imageList, serviceBaseUrl, sublayer, legendIndex) => {
    const imageId = imageList.addEsriPMS(symbol, serviceBaseUrl, sublayer, legendIndex);
    return [
        {
            id: utils_1.generateId(),
            source: sourceId,
            type: "symbol",
            paint: {},
            layout: {
                "icon-allow-overlap": true,
                "icon-rotate": symbol.angle,
                "icon-offset": [symbol.xoffset || 0, symbol.yoffset || 0],
                "icon-image": imageId,
            },
        },
    ];
};
